-- Stage 1. Apply ONLY after all legacy SQL through receipt-eligible-statuses.sql.
-- No historical replay, recipients, scheduler, credentials or HTTP calls.
begin;
do $$ begin
 if exists(select 1 from public.zzws_users where active and profile->>'role'='admin')
 and not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.active and u.profile->>'role'='admin' and s.scope='owner')
 then raise exception 'Explicitly review and assign an existing owner before deploying fail-closed authorization';end if;
end $$;

create function public.zzws_bootstrap_admin(p_id uuid,p_login text,p_profile jsonb) returns void
language plpgsql security invoker set search_path='' as $$ begin
 perform pg_advisory_xact_lock(9302801);
 if exists(select 1 from public.zzws_users where profile->>'role'='admin') or p_profile->>'role' is distinct from 'admin' then raise sqlstate 'PT403' using message='Bootstrap unavailable';end if;
 insert into public.zzws_users(id,login,profile,active,needs_password_setup) values(p_id,p_login,p_profile,true,false);
 insert into public.zzws_admin_scopes(user_id,scope) values(p_id,'owner');
end $$;
revoke all on function public.zzws_bootstrap_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_bootstrap_admin(uuid,text,jsonb) to service_role;

create table public.zzws_order_activity(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 order_id uuid not null,revision integer not null,event_type text not null,
 occurred_at timestamptz not null default clock_timestamp(),actor jsonb not null,
 customer jsonb not null,order_number bigint not null,snapshot jsonb not null,
 changes jsonb not null,source text not null,schema_version integer not null default 1,
 unique(order_id,revision),check(event_type in ('order.created','order.updated','order.received'))
);
create index zzws_activity_order on public.zzws_order_activity(order_id,revision desc);
create table public.zzws_notification_settings(id boolean primary key default true check(id),enabled boolean not null default false);
insert into public.zzws_notification_settings(id) values(true);
create table public.zzws_notification_recipients(
 id uuid primary key default gen_random_uuid(),channel text not null check(channel in ('telegram','android')),
 destination text not null check(length(destination) between 1 and 4096),
 user_id uuid references public.zzws_users(id) on delete cascade,
 active boolean not null default false,created timestamptz not null default now(),unique(channel,destination),
 check(channel<>'android' or user_id is not null)
);
create table public.zzws_notification_outbox(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.zzws_order_activity(id),
 recipient_id uuid not null references public.zzws_notification_recipients(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','leased','sent','retry','dead','uncertain','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 available_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 provider_message_id text,last_error text,sent_at timestamptz,created timestamptz not null default now(),
 unique(event_id,recipient_id),check((state='leased')=(lease_token is not null and lease_until is not null))
);
create index zzws_outbox_due on public.zzws_notification_outbox(available_at,created) where state in ('pending','retry');
create index zzws_outbox_recipient on public.zzws_notification_outbox(recipient_id,event_id);
do $$ declare t text;begin foreach t in array array['zzws_order_activity','zzws_notification_settings','zzws_notification_recipients','zzws_notification_outbox'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;
grant usage,select on sequence public.zzws_order_activity_sequence_seq to service_role;
revoke update,delete,truncate on public.zzws_order_activity from service_role;
create function public.zzws_activity_immutable() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 raise exception 'Order activity is immutable';
end $$;
create trigger zzws_activity_immutable before update or delete on public.zzws_order_activity for each row execute function public.zzws_activity_immutable();

create function public.zzws_notification_allowed(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r where r.id=p_id and r.active and
 (r.user_id is null or exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id
 where u.id=r.user_id and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer'))));
$$;
create function public.zzws_record_order_activity(p_before jsonb,p_after jsonb,p_actor uuid,p_source text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare eid uuid;who jsonb;delta jsonb;begin
 select jsonb_build_object('id',id,'login',login,'client',profile->>'client','role',profile->>'role') into who from public.zzws_users where id=p_actor;
 if who is null then raise exception 'Order event actor missing';end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',p_before->k,'after',p_after->k)),'{}') into delta
 from unnest(array['status','lines','total','comment','delivery','confirmation','receipt','received_at']) k where p_before->k is distinct from p_after->k;
 insert into public.zzws_order_activity(order_id,revision,event_type,actor,customer,order_number,snapshot,changes,source)
 values((p_after->>'id')::uuid,(p_after->>'revision')::integer,
 case when p_before is null then 'order.created' when p_after->>'status'='received' then 'order.received' else 'order.updated' end,
 who,p_after->'customer',(p_after->>'number')::bigint,
 jsonb_build_object('id',p_after->'id','number',p_after->'number','revision',p_after->'revision','customer',p_after->'customer',
 'delivery',p_after->'delivery','lines',p_after->'lines','total',p_after->'total','status',p_after->'status',
 'comment',p_after->'comment','confirmation',p_after->'confirmation','receipt',p_after->'receipt','received_at',p_after->'received_at'),delta,p_source)
 returning id into eid;
 -- Enqueue only recipients explicitly enabled at the time of the event. No backfill.
 if (select enabled from public.zzws_notification_settings where id) then
  insert into public.zzws_notification_outbox(event_id,recipient_id)
  select eid,r.id from public.zzws_notification_recipients r where public.zzws_notification_allowed(r.id);
 end if;
 return eid;
end $$;

create function public.zzws_claim_notifications(p_limit integer default 10) returns setof public.zzws_notification_outbox
language plpgsql security invoker set search_path='' as $$ begin
 if not coalesce((select enabled from public.zzws_notification_settings where id),false) then return;end if;
 -- Expiry cannot prove non-delivery: quarantine rather than silently send twice.
 update public.zzws_notification_outbox set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired'
 where state='leased' and lease_until<=clock_timestamp();
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked'
 where state in ('pending','retry','leased') and not public.zzws_notification_allowed(q.recipient_id);
 return query
 with due as (
  select q.id from public.zzws_notification_outbox q join public.zzws_order_activity e on e.id=q.event_id
  where q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8
  and public.zzws_notification_allowed(q.recipient_id)
  and not exists(select 1 from public.zzws_notification_outbox older join public.zzws_order_activity oe on oe.id=older.event_id
    where older.recipient_id=q.recipient_id and oe.order_id=e.order_id and oe.revision<e.revision and older.state not in ('sent','cancelled'))
  order by e.sequence,q.id for update of q skip locked limit least(greatest(coalesce(p_limit,10),1),100)
 ) update public.zzws_notification_outbox q set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 from due where q.id=due.id returning q.*;
end $$;
create function public.zzws_finish_notification(p_id uuid,p_token uuid,p_result text,p_message text default null,p_retry_seconds integer default 30) returns boolean
language plpgsql security invoker set search_path='' as $$ declare q public.zzws_notification_outbox;begin
 select * into q from public.zzws_notification_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() then return false;end if;
 if p_result not in ('sent','retry','dead','uncertain') or p_result is null then raise exception 'Invalid notification result';end if;
 -- p_message is a provider message ID on success; no raw provider errors or secrets are stored.
 update public.zzws_notification_outbox set
 state=case when not public.zzws_notification_allowed(q.recipient_id) then 'cancelled' when p_result='retry' and q.attempts>=8 then 'dead' else p_result end,
 provider_message_id=case when p_result='sent' then left(p_message,256) else null end,
 sent_at=case when p_result='sent' then clock_timestamp() else null end,
 last_error=case when p_result='sent' then null else p_result end,
 available_at=clock_timestamp()+make_interval(secs=>least(86400,greatest(coalesce(p_retry_seconds,30),30*power(2,q.attempts-1)::integer))),
 lease_token=null,lease_until=null where id=p_id;return true;
end $$;
revoke all on function public.zzws_activity_immutable(),public.zzws_notification_allowed(uuid),public.zzws_record_order_activity(jsonb,jsonb,uuid,text),public.zzws_claim_notifications(integer),public.zzws_finish_notification(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_activity_immutable(),public.zzws_notification_allowed(uuid),public.zzws_record_order_activity(jsonb,jsonb,uuid,text),public.zzws_claim_notifications(integer),public.zzws_finish_notification(uuid,uuid,text,text,integer) to service_role;

create or replace function public.zzws_submit_order(p_user uuid,p_request uuid,p_customer jsonb,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;gate jsonb;
begin
 gate=public.zzws_receipt_state(p_user);
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into result from public.zzws_orders where user_id=p_user and request_id=p_request;if found then return to_jsonb(result);end if;
 if (gate->>'blocked')::boolean then raise sqlstate 'PT429' using message='Նոր պատվերի համար նախ հաստատեք բոլոր չստացված պատվերների ստացումը';end if;
 insert into public.zzws_orders(user_id,request_id,customer,delivery,lines,original_lines,total) values(p_user,p_request,p_customer,p_delivery,p_lines,p_lines,p_total) returning * into result;
 perform public.zzws_record_order_activity(null,to_jsonb(result),p_user,'catalog');
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_submit',jsonb_build_object('number',result.number,'target',p_customer)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;
create or replace function public.zzws_update_order(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;old public.zzws_orders;owner uuid;
begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager')) then raise sqlstate 'PT403' using message='Order write permission required';end if;
 select user_id into owner from public.zzws_orders where id=p_order;if owner is not null then perform public.zzws_receipt_state(owner);end if;
 select * into old from public.zzws_orders where id=p_order for update;
 if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 if old.received_at is not null or p_status='received' then raise sqlstate 'PT409' using message='Ստացված պատվերը չի խմբագրվում․ ստացումը հաստատում է միայն հաճախորդը';end if;
 if p_draft is not null and not exists(select 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='order' and expires>now()) then raise sqlstate 'PT409' using message='Նախադիտման ժամկետը լրացել է';end if;
 if old.revision<>p_revision then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է';end if;
 if old.lines=p_lines and old.status=p_status and old.comment=p_comment and (p_delivery is null or old.delivery=p_delivery) and (p_confirmation is null or old.confirmation=p_confirmation) then if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;return to_jsonb(old);end if;
 update public.zzws_orders set lines=p_lines,status=p_status,comment=p_comment,total=p_total,delivery=coalesce(p_delivery,delivery),confirmation=coalesce(p_confirmation,confirmation),revision=revision+1,updated=now() where id=p_order returning * into result;
 perform public.zzws_record_order_activity(to_jsonb(old),to_jsonb(result),p_actor,case when p_draft is null then 'manual' else 'confirmation' end);
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(result.id,result.user_id,result.revision,p_detail||jsonb_build_object('oldStatus',old.status,'status',result.status,'comment',p_comment,'total',p_total));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_update',jsonb_build_object('number',result.number,'revision',result.revision,'target',result.customer,'status',result.status)::text);
 if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;
 if owner is not null then perform public.zzws_receipt_state(owner);end if;return to_jsonb(result);
end $$;
create or replace function public.zzws_confirm_receipt(p_user uuid,p_order uuid,p_revision integer,p_intact boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.zzws_orders;result public.zzws_orders;statement text='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';
begin
 perform public.zzws_receipt_state(p_user);
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into old from public.zzws_orders where id=p_order and user_id=p_user for update;if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 if old.received_at is not null then return to_jsonb(old);end if;
 if p_intact is distinct from true then raise sqlstate 'PT400' using message='Հաստատեք ամբողջական և անվնաս ստացումը';end if;
 if old.revision is distinct from p_revision then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է։ Թարմացրեք տվյալները և կրկին հաստատեք ստացումը';end if;
 if old.status not in ('confirmed','in_progress','completed') then raise sqlstate 'PT409' using message='Նոր կամ մերժված պատվերի ստացումը չի հաստատվում';end if;
 update public.zzws_orders set status='received',received_at=now(),received_by=p_user,receipt=jsonb_build_object('version',1,'intact',true,'statement',statement,'orderRevision',old.revision,'confirmedAt',now(),'customer',old.customer),revision=revision+1,updated=now() where id=old.id returning * into result;
 perform public.zzws_record_order_activity(to_jsonb(old),to_jsonb(result),p_user,'receipt');
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(result.id,p_user,result.revision,jsonb_build_object('kind','receipt','number',result.number,'oldStatus',old.status,'status','received','statement',statement),now());
 insert into public.zzws_receipt_notices(order_id,number,customer,revision,received_at) values(result.id,result.number,result.customer,result.revision,result.received_at);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_received',jsonb_build_object('number',result.number,'target',result.customer,'statement',statement)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;
create or replace function public.zzws_save_receipt_control(p_actor uuid,p_user uuid,p_mode text,p_until timestamptz,p_revision uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior uuid;result jsonb;
begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Անհրաժեշտ է սեփականատիրոջ իրավունք';end if;
 if p_mode is null or p_mode not in ('inherit','on','off','until') or(p_user is null and p_mode='inherit') or(p_mode='until' and(p_until is null or p_until<=now())) then raise sqlstate 'PT400' using message='Ստուգեք վերահսկման ռեժիմն ու ժամկետը';end if;
 if p_mode<>'until' then p_until=null;end if;
 if p_user is null then
  select revision into prior from public.zzws_receipt_settings where id=true for update;if prior is distinct from p_revision then raise sqlstate 'PT409' using message='Կարգավորումն արդեն փոխվել է';end if;
  update public.zzws_receipt_settings set mode=p_mode,disabled_until=p_until,revision=gen_random_uuid(),updated_by=p_actor,updated=now() where id=true returning to_jsonb(zzws_receipt_settings.*) into result;
 else
  perform public.zzws_receipt_state(p_user);select revision into prior from public.zzws_client_receipt_controls where user_id=p_user for update;if prior is distinct from p_revision then raise sqlstate 'PT409' using message='Կարգավորումն արդեն փոխվել է';end if;
  insert into public.zzws_client_receipt_controls(user_id,mode,disabled_until,updated_by) values(p_user,p_mode,p_until,p_actor) on conflict(user_id) do update set mode=p_mode,disabled_until=p_until,revision=gen_random_uuid(),updated_by=p_actor,updated=now() returning to_jsonb(zzws_client_receipt_controls.*) into result;
 end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'receipt_control_update',jsonb_build_object('userId',p_user,'mode',p_mode,'until',p_until)::text);return result;
end $$;
create or replace function public.zzws_application_snapshot()
returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('format','zzws-application-backup-v1','created',now(),'tables',jsonb_build_object(
 'users',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_users t),
 'versions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_versions t),
 'state',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_state t),
 'orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_orders t),
 'order_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_events t),
 'saved_carts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_saved_carts t),
 'user_memory',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_user_memory t),
 'admin_scopes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_scopes t),
 'receipt_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_receipt_settings t),
 'client_receipt_controls',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_client_receipt_controls t),
 'order_gate',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_gate t),
 'receipt_notices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_receipt_notices t),
 'admin_notice_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_notice_reads t),
 'order_activity',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_activity t),
 'notification_recipients',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_notification_recipients t),
 'notification_outbox',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_notification_outbox t),
 'notification_settings',(select jsonb_agg(to_jsonb(t)||'{"enabled":false}') from public.zzws_notification_settings t),
 'audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_audit t)
 ));
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
