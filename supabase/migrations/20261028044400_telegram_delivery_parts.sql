-- Local stage 2; prerequisite: order_activity_outbox. No senders, recipients or schedules activated.
begin;
do $$ begin
 if exists(select 1 from public.zzws_notification_settings where id and enabled) then raise exception 'Pause notification delivery before applying Telegram migration';end if;
end $$;
alter table public.zzws_notification_settings add column telegram_paused_until timestamptz;
alter table public.zzws_notification_outbox add column telegram_destination text;
-- Database-enforced per-recipient exclusion also covers concurrent READ COMMITTED snapshots.
create unique index zzws_telegram_one_lease on public.zzws_notification_outbox(recipient_id) where state='leased' and telegram_destination is not null;
create table public.zzws_telegram_parts(
 outbox_id uuid not null references public.zzws_notification_outbox(id) on delete cascade,
 part integer not null check(part between 1 and 5000),body text not null check(length(body) between 1 and 4096),
 format_version integer not null check(format_version=1),
 state text not null default 'pending' check(state in ('pending','sending','sent','dead','uncertain')),
 provider_message_id text,sent_at timestamptz,primary key(outbox_id,part)
);
alter table public.zzws_telegram_parts enable row level security;
revoke all on public.zzws_telegram_parts from public,anon,authenticated;
grant all on public.zzws_telegram_parts to service_role;
create policy service_only on public.zzws_telegram_parts for all to service_role using(true) with check(true);

create function public.zzws_claim_telegram(p_allowed text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare chosen public.zzws_notification_outbox;result jsonb;begin
 if coalesce(cardinality(p_allowed),0)=0 or cardinality(p_allowed)>100 then return null;end if;
 if exists(select 1 from unnest(p_allowed) x where x is null or x!~'^[1-9][0-9]{0,15}$' or x::numeric>4503599627370495) then raise exception 'Invalid Telegram allowlist';end if;
 if not exists(select 1 from public.zzws_notification_settings where id and enabled and (telegram_paused_until is null or telegram_paused_until<=clock_timestamp())) then return null;end if;
 -- Expired in-flight HTTP is ambiguous; a lease lost before begin-part is safe to retry.
 update public.zzws_notification_outbox q set
 state=case when exists(select 1 from public.zzws_telegram_parts p where p.outbox_id=q.id and p.state='sending') then 'uncertain' when q.attempts>=8 then 'dead' else 'retry' end,
 lease_token=null,lease_until=null,last_error='lease_expired'
 where q.state='leased' and q.lease_until<=clock_timestamp() and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='telegram');
 update public.zzws_telegram_parts p set state='uncertain' where state='sending' and exists(select 1 from public.zzws_notification_outbox q where q.id=p.outbox_id and q.state='uncertain');
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked'
 where q.state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='telegram' and
 (not public.zzws_notification_allowed(r.id) or not(r.destination=any(p_allowed)) or (q.telegram_destination is not null and q.telegram_destination<>r.destination)));
 select q.* into chosen from public.zzws_notification_outbox q join public.zzws_order_activity e on e.id=q.event_id join public.zzws_notification_recipients r on r.id=q.recipient_id
 where r.channel='telegram' and r.destination=any(p_allowed) and public.zzws_notification_allowed(r.id)
 and q.state in ('pending','retry') and q.attempts<8 and q.available_at<=clock_timestamp()
 and not exists(select 1 from public.zzws_notification_outbox active where active.recipient_id=q.recipient_id and active.state='leased')
 and not exists(select 1 from public.zzws_notification_outbox older join public.zzws_order_activity oe on oe.id=older.event_id where older.recipient_id=q.recipient_id and oe.order_id=e.order_id and oe.revision<e.revision and older.state not in ('sent','cancelled'))
 order by e.sequence,q.id for update of q,r skip locked limit 1;
 if not found then return null;end if;
 begin
  update public.zzws_notification_outbox set state='leased',attempts=attempts+1,telegram_destination=(select destination from public.zzws_notification_recipients where id=chosen.recipient_id),lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=chosen.id returning * into chosen;
 exception when unique_violation then return null;end;
 select jsonb_build_object('id',chosen.id,'lease_token',chosen.lease_token,'destination',r.destination,'event',to_jsonb(e)) into result
 from public.zzws_notification_recipients r join public.zzws_order_activity e on e.id=chosen.event_id where r.id=chosen.recipient_id;
 return result;
end $$;

create function public.zzws_prepare_telegram(p_id uuid,p_token uuid,p_messages jsonb,p_version integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.zzws_notification_outbox;dest text;result jsonb;begin
 select * into q from public.zzws_notification_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() then return null;end if;
 select destination into dest from public.zzws_notification_recipients where id=q.recipient_id and channel='telegram' and public.zzws_notification_allowed(id);
 if dest is null or not exists(select 1 from public.zzws_notification_settings where id and enabled) then return null;end if;
 if q.telegram_destination is distinct from dest then update public.zzws_notification_outbox set state='cancelled',lease_token=null,lease_until=null where id=p_id;return null;end if;
 if p_version is distinct from 1 or jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages) not between 1 and 5000 then raise exception 'Invalid Telegram message plan';end if;
 if exists(select 1 from jsonb_array_elements(p_messages) m where jsonb_typeof(m) is distinct from 'string' or length(m#>>'{}') not between 1 and 4096) then raise exception 'Invalid Telegram message body';end if;
 if exists(select 1 from public.zzws_telegram_parts where outbox_id=p_id) then
  select jsonb_agg(body order by part) into result from public.zzws_telegram_parts where outbox_id=p_id;
  if result is distinct from p_messages or q.telegram_destination is distinct from dest then raise exception 'Frozen Telegram plan mismatch';end if;
 else
  insert into public.zzws_telegram_parts(outbox_id,part,body,format_version) select p_id,ordinality,value#>>'{}',p_version from jsonb_array_elements(p_messages) with ordinality;
  update public.zzws_notification_outbox set telegram_destination=dest where id=p_id;
 end if;
 select jsonb_agg(jsonb_build_object('part',part,'state',state) order by part) into result from public.zzws_telegram_parts where outbox_id=p_id;
 return result;
end $$;

create function public.zzws_begin_telegram_part(p_id uuid,p_token uuid,p_part integer,p_allowed text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.zzws_notification_outbox;r public.zzws_notification_recipients;content text;begin
 select * into q from public.zzws_notification_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() then return null;end if;
 select * into r from public.zzws_notification_recipients where id=q.recipient_id for share;
 if r.channel<>'telegram' or not public.zzws_notification_allowed(r.id) or r.destination is distinct from q.telegram_destination or not coalesce(r.destination=any(p_allowed),false) or r.destination!~'^[1-9][0-9]{0,15}$' then
  update public.zzws_notification_outbox set state='cancelled',lease_token=null,lease_until=null where id=p_id;return null;
 end if;
 if not exists(select 1 from public.zzws_notification_settings where id and enabled and (telegram_paused_until is null or telegram_paused_until<=clock_timestamp())) then return null;end if;
 if exists(select 1 from public.zzws_telegram_parts where outbox_id=p_id and part<p_part and state<>'sent') then return null;end if;
 update public.zzws_telegram_parts set state='sending' where outbox_id=p_id and part=p_part and state='pending' returning body into content;
 if content is null then return null;end if;
 update public.zzws_notification_outbox set lease_until=clock_timestamp()+interval '2 minutes' where id=p_id;
 return jsonb_build_object('destination',r.destination,'body',content);
end $$;

create function public.zzws_finish_telegram_part(p_id uuid,p_token uuid,p_part integer,p_result text,p_message text default null,p_retry_seconds integer default 30) returns boolean
language plpgsql security invoker set search_path='' as $$ declare q public.zzws_notification_outbox;wait_seconds integer;begin
 select * into q from public.zzws_notification_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() or not exists(select 1 from public.zzws_telegram_parts where outbox_id=p_id and part=p_part and state='sending') then return false;end if;
 if p_result is null or p_result not in ('sent','retry','dead','uncertain') or (p_result='sent' and (p_message is null or p_message!~'^[1-9][0-9]{0,19}$')) then raise exception 'Invalid Telegram result';end if;
 wait_seconds=greatest(least(604800,greatest(coalesce(p_retry_seconds,30),1)),least(86400,30*power(2,q.attempts-1)::integer));
 update public.zzws_telegram_parts set state=case when p_result='retry' then 'pending' else p_result end,
 provider_message_id=case when p_result='sent' then p_message else null end,sent_at=case when p_result='sent' then clock_timestamp() else null end where outbox_id=p_id and part=p_part;
 if p_result='sent' and exists(select 1 from public.zzws_telegram_parts where outbox_id=p_id and state<>'sent') then return true;end if;
 update public.zzws_notification_outbox set state=case when p_result='retry' and attempts>=8 then 'dead' else p_result end,
 provider_message_id=case when p_result='sent' then p_message else null end,sent_at=case when p_result='sent' then clock_timestamp() else null end,
 last_error=case when p_result='sent' then null else 'telegram_'||p_result end,available_at=clock_timestamp()+make_interval(secs=>wait_seconds),lease_token=null,lease_until=null where id=p_id;
 if p_result='retry' then update public.zzws_notification_settings set telegram_paused_until=greatest(coalesce(telegram_paused_until,clock_timestamp()),clock_timestamp()+make_interval(secs=>wait_seconds)) where id;end if;
 return true;
end $$;
revoke all on function public.zzws_claim_telegram(text[]),public.zzws_prepare_telegram(uuid,uuid,jsonb,integer),public.zzws_begin_telegram_part(uuid,uuid,integer,text[]),public.zzws_finish_telegram_part(uuid,uuid,integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_claim_telegram(text[]),public.zzws_prepare_telegram(uuid,uuid,jsonb,integer),public.zzws_begin_telegram_part(uuid,uuid,integer,text[]),public.zzws_finish_telegram_part(uuid,uuid,integer,text,text,integer) to service_role;

-- Legacy generic claimant remains available for Android only.
create or replace function public.zzws_claim_notifications(p_limit integer default 10) returns setof public.zzws_notification_outbox
language plpgsql security invoker set search_path='' as $$ begin
 if not coalesce((select enabled from public.zzws_notification_settings where id),false) then return;end if;
 -- Expiry cannot prove non-delivery: quarantine rather than silently send twice.
 update public.zzws_notification_outbox set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired'
 where state='leased' and lease_until<=clock_timestamp() and exists(select 1 from public.zzws_notification_recipients r where r.id=recipient_id and r.channel='android');
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked'
 where state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android') and not public.zzws_notification_allowed(q.recipient_id);
 return query
 with due as (
  select q.id from public.zzws_notification_outbox q join public.zzws_order_activity e on e.id=q.event_id
  where exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android') and q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8
  and public.zzws_notification_allowed(q.recipient_id)
  and not exists(select 1 from public.zzws_notification_outbox older join public.zzws_order_activity oe on oe.id=older.event_id
    where older.recipient_id=q.recipient_id and oe.order_id=e.order_id and oe.revision<e.revision and older.state not in ('sent','cancelled'))
  order by e.sequence,q.id for update of q skip locked limit least(greatest(coalesce(p_limit,10),1),100)
 ) update public.zzws_notification_outbox q set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
 from due where q.id=due.id returning q.*;
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
 'telegram_parts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_telegram_parts t),
 'notification_outbox',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_notification_outbox t),
 'notification_settings',(select jsonb_agg(to_jsonb(t)||'{"enabled":false}') from public.zzws_notification_settings t),
 'audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_audit t)
 ));
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
