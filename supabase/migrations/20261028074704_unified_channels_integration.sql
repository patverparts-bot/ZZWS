-- Unified local preparation: no remote requests or real external connections.
begin;
create table public.zzws_user_channels(user_id uuid primary key references public.zzws_users(id) on delete cascade,mobile_admin_enabled boolean not null default false,telegram_enabled boolean not null default false,revision integer not null default 0,updated timestamptz not null default now());
create table public.zzws_admin_devices(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.zzws_users(id) on delete cascade,device_id text not null,token text not null,platform text not null default 'android' check(platform='android'),active boolean not null default true,created timestamptz not null default now(),updated timestamptz not null default now(),unique(user_id,device_id),unique(token));
create table public.zzws_external_systems(id uuid primary key default gen_random_uuid(),code text unique not null,mode text not null default 'simulation' check(mode in ('simulation','disabled')),enabled boolean not null default false);
insert into public.zzws_external_systems(id,code) values('10000000-0000-4000-8000-000000000001','zigzag-1c');
create table public.zzws_partner_counterparties(id uuid primary key default gen_random_uuid(),partner_id uuid not null references public.zzws_users(id),system_id uuid not null references public.zzws_external_systems(id),external_ref text not null check(length(external_ref) between 1 and 200),name text not null,active boolean not null default true,unique(partner_id,system_id,external_ref));
create table public.zzws_delivery_counterparties(partner_id uuid not null references public.zzws_users(id),delivery_variant_id uuid not null,system_id uuid not null references public.zzws_external_systems(id),counterparty_id uuid not null references public.zzws_partner_counterparties(id),primary key(partner_id,delivery_variant_id,system_id));
alter table public.zzws_orders add column integration_snapshot jsonb not null default '{"schemaVersion":1,"state":"legacy_unknown","systems":[]}';
create table public.zzws_integration_outbox(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.zzws_order_activity(id),order_id uuid not null,order_revision integer not null,system_id uuid not null references public.zzws_external_systems(id),payload jsonb not null,state text not null check(state in ('pending_mapping','pending','leased','synced','retry','uncertain','dead','cancelled')),attempts integer not null default 0,lease_token uuid,lease_until timestamptz,available_at timestamptz not null default now(),last_error text,created timestamptz not null default now(),unique(event_id,system_id),check((state='leased')=(lease_token is not null and lease_until is not null)));
create table public.zzws_integration_documents(order_id uuid not null,system_id uuid not null references public.zzws_external_systems(id),external_document_ref text not null,order_revision integer not null,updated timestamptz not null default now(),primary key(order_id,system_id),unique(system_id,external_document_ref));
create table public.zzws_order_integration_resolutions(order_id uuid not null references public.zzws_orders(id),system_id uuid not null references public.zzws_external_systems(id),snapshot jsonb not null,actor uuid not null references public.zzws_users(id),created timestamptz not null default now(),primary key(order_id,system_id));
create index zzws_integration_due on public.zzws_integration_outbox(system_id,available_at) where state in ('pending','retry');
do $$ declare t text;begin foreach t in array array['zzws_user_channels','zzws_admin_devices','zzws_external_systems','zzws_partner_counterparties','zzws_delivery_counterparties','zzws_integration_outbox','zzws_integration_documents','zzws_order_integration_resolutions'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;
create function public.zzws_save_channels(p_actor uuid,p_user uuid,p_mobile boolean,p_telegram boolean,p_expected integer default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_user_channels;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Owner required';end if;
 if p_mobile is null or p_telegram is null or not exists(select 1 from public.zzws_users where id=p_user and profile->>'role'='admin') then raise sqlstate 'PT400' using message='Select administrator';end if;
 insert into public.zzws_user_channels(user_id) values(p_user) on conflict do nothing;
 select * into result from public.zzws_user_channels where user_id=p_user for update;
 if p_expected is not null and result.revision<>p_expected then raise sqlstate 'PT409' using message='Channel permissions changed';end if;
 update public.zzws_user_channels set mobile_admin_enabled=p_mobile,telegram_enabled=p_telegram,revision=revision+1,updated=now() where user_id=p_user returning * into result;
 if not p_mobile then update public.zzws_admin_devices set active=false,updated=now() where user_id=p_user;update public.zzws_notification_recipients set active=false where user_id=p_user and channel='android';end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_channels_update',jsonb_build_object('target',p_user,'mobileAdminEnabled',p_mobile,'telegramEnabled',p_telegram)::text);
 return to_jsonb(result);
end $$;
create or replace function public.zzws_notification_allowed(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r where r.id=p_id and r.active and
 (r.user_id is null and r.channel='telegram' or exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id join public.zzws_user_channels c on c.user_id=u.id
 where u.id=r.user_id and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer') and case when r.channel='android' then c.mobile_admin_enabled else c.telegram_enabled end)));
$$;
create function public.zzws_save_counterparty_mapping(p_actor uuid,p_partner uuid,p_variant uuid,p_system uuid,p_counterparty uuid) returns void language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Owner required';end if;
 if not exists(select 1 from public.zzws_users u,jsonb_array_elements(coalesce(u.profile->'rowsList','[]')) r where u.id=p_partner and r->>'id'=p_variant::text) or not exists(select 1 from public.zzws_partner_counterparties where id=p_counterparty and partner_id=p_partner and system_id=p_system and active) then raise sqlstate 'PT403' using message='Counterparty or delivery not owned';end if;
 insert into public.zzws_delivery_counterparties values(p_partner,p_variant,p_system,p_counterparty) on conflict(partner_id,delivery_variant_id,system_id) do update set counterparty_id=excluded.counterparty_id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'counterparty_mapping_update',jsonb_build_object('partner',p_partner,'variant',p_variant,'system',p_system)::text);
end $$;
create function public.zzws_order_integration_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$ declare snapshots jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('systemId',s.id,'code',s.code,'state',case when c.id is null then 'pending_mapping' else 'ready' end,'counterpartyRef',c.external_ref,'counterpartyId',c.id,'counterpartyName',c.name) order by s.code),'[]') into snapshots
 from public.zzws_external_systems s left join public.zzws_delivery_counterparties m on m.system_id=s.id and m.partner_id=new.user_id and m.delivery_variant_id=new.delivery_variant_id left join public.zzws_partner_counterparties c on c.id=m.counterparty_id and c.active and c.partner_id=new.user_id and c.system_id=s.id;
 new.integration_snapshot=jsonb_build_object('schemaVersion',1,'deliveryVariantId',new.delivery_variant_id,'systems',snapshots);return new;
end $$;
create trigger zzws_order_integration_snapshot before insert on public.zzws_orders for each row execute function public.zzws_order_integration_snapshot();
create function public.zzws_integration_snapshot_immutable() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.integration_snapshot is distinct from old.integration_snapshot then raise sqlstate 'PT403' using message='Historical counterparty snapshot is immutable';end if;return new;
end $$;
create trigger zzws_integration_snapshot_immutable before update on public.zzws_orders for each row execute function public.zzws_integration_snapshot_immutable();
create function public.zzws_enqueue_integration() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 insert into public.zzws_integration_outbox(event_id,order_id,order_revision,system_id,payload,state)
 select new.id,new.order_id,new.revision,s.id,jsonb_build_object('schemaVersion',1,'eventId',new.id,'eventType',new.event_type,'orderRevision',new.revision,'order',new.snapshot,'counterparty',coalesce(r.snapshot,x)),case when coalesce(r.snapshot,x)->>'state'='ready' then 'pending' else 'pending_mapping' end
 from public.zzws_external_systems s left join lateral(select value from jsonb_array_elements(coalesce(new.snapshot->'integration'->'systems','[]')) where value->>'systemId'=s.id::text) q(x) on true left join public.zzws_order_integration_resolutions r on r.order_id=new.order_id and r.system_id=s.id;
 return new;
end $$;
create trigger zzws_enqueue_integration after insert on public.zzws_order_activity for each row execute function public.zzws_enqueue_integration();
create function public.zzws_claim_integration(p_system uuid,p_limit integer default 1) returns setof public.zzws_integration_outbox language plpgsql security invoker set search_path='' as $$ begin
 if not exists(select 1 from public.zzws_external_systems where id=p_system and enabled and mode='simulation') then return;end if;
 update public.zzws_integration_outbox set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired' where system_id=p_system and state='leased' and lease_until<=clock_timestamp();
 return query with due as(select q.id from public.zzws_integration_outbox q where q.system_id=p_system and q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8 and not exists(select 1 from public.zzws_integration_outbox older where older.system_id=q.system_id and older.order_id=q.order_id and older.order_revision<q.order_revision and older.state not in ('synced','cancelled')) order by q.created,q.id for update skip locked limit least(greatest(coalesce(p_limit,1),1),50))
 update public.zzws_integration_outbox q set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' from due where q.id=due.id returning q.*;
end $$;
create function public.zzws_finish_integration(p_id uuid,p_token uuid,p_result text,p_document text default null) returns boolean language plpgsql security invoker set search_path='' as $$ declare q public.zzws_integration_outbox;begin
 select * into q from public.zzws_integration_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() then return false;end if;
 if p_result is null or p_result not in ('synced','retry','uncertain','dead') or p_result='synced' and (p_document is null or length(p_document) not between 1 and 200) then raise exception 'Invalid integration result';end if;
 if p_result='synced' then insert into public.zzws_integration_documents(order_id,system_id,external_document_ref,order_revision) values(q.order_id,q.system_id,p_document,q.order_revision) on conflict(order_id,system_id) do update set external_document_ref=excluded.external_document_ref,order_revision=excluded.order_revision,updated=now();end if;
 update public.zzws_integration_outbox set state=case when p_result='retry' and attempts>=8 then 'dead' else p_result end,lease_token=null,lease_until=null,available_at=clock_timestamp()+interval '30 seconds',last_error=case when p_result='synced' then null else p_result end where id=p_id;return true;
end $$;
revoke all on function public.zzws_save_channels(uuid,uuid,boolean,boolean,integer),public.zzws_save_counterparty_mapping(uuid,uuid,uuid,uuid,uuid),public.zzws_order_integration_snapshot(),public.zzws_integration_snapshot_immutable(),public.zzws_enqueue_integration(),public.zzws_claim_integration(uuid,integer),public.zzws_finish_integration(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.zzws_save_channels(uuid,uuid,boolean,boolean,integer),public.zzws_save_counterparty_mapping(uuid,uuid,uuid,uuid,uuid),public.zzws_order_integration_snapshot(),public.zzws_integration_snapshot_immutable(),public.zzws_enqueue_integration(),public.zzws_claim_integration(uuid,integer),public.zzws_finish_integration(uuid,uuid,text,text) to service_role;
create function public.zzws_resolve_pending_mapping(p_actor uuid,p_order uuid,p_system uuid,p_counterparty uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;c public.zzws_partner_counterparties;resolved jsonb;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Owner required';end if;
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404' using message='Order missing';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(o.integration_snapshot->'systems','[]')) s where s->>'systemId'=p_system::text and s->>'state'='ready') or exists(select 1 from public.zzws_integration_documents where order_id=p_order and system_id=p_system) or exists(select 1 from public.zzws_order_integration_resolutions where order_id=p_order and system_id=p_system) then raise sqlstate 'PT409' using message='Counterparty already frozen';end if;
 select * into c from public.zzws_partner_counterparties where id=p_counterparty and partner_id=o.user_id and system_id=p_system and active;
 if not found then raise sqlstate 'PT403' using message='Counterparty not owned';end if;
 resolved=jsonb_build_object('systemId',p_system,'state','ready','counterpartyId',c.id,'counterpartyRef',c.external_ref,'counterpartyName',c.name,'source','owner_resolution');
 insert into public.zzws_order_integration_resolutions(order_id,system_id,snapshot,actor) values(p_order,p_system,resolved,p_actor);
 update public.zzws_integration_outbox set payload=jsonb_set(payload,'{counterparty}',resolved),state='pending' where order_id=p_order and system_id=p_system and state='pending_mapping';
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_counterparty_resolution',jsonb_build_object('orderId',p_order,'systemId',p_system,'counterpartyId',p_counterparty)::text);return resolved;
end $$;
revoke all on function public.zzws_resolve_pending_mapping(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_resolve_pending_mapping(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.zzws_record_order_activity(p_before jsonb,p_after jsonb,p_actor uuid,p_source text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare eid uuid;who jsonb;delta jsonb;begin
 select id into eid from public.zzws_order_activity where order_id=(p_after->>'id')::uuid and revision=(p_after->>'revision')::integer;if found then return eid;end if;
 select jsonb_build_object('id',id,'login',login,'client',profile->>'client','role',profile->>'role') into who from public.zzws_users where id=p_actor;
 if who is null then who=jsonb_build_object('id',null,'role','system','client','ZZWS');end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',p_before->k,'after',p_after->k)),'{}') into delta
 from unnest(array['status','lines','total','comment','delivery','confirmation','receipt','received_at']) k where p_before->k is distinct from p_after->k;
 insert into public.zzws_order_activity(order_id,revision,event_type,actor,customer,order_number,snapshot,changes,source)
 values((p_after->>'id')::uuid,(p_after->>'revision')::integer,
 case when p_before is null then 'order.created' when p_after->>'status'='received' then 'order.received' else 'order.updated' end,
 who,p_after->'customer',(p_after->>'number')::bigint,
 jsonb_build_object('id',p_after->'id','number',p_after->'number','revision',p_after->'revision','customer',p_after->'customer',
 'deliveryVariantId',p_after->'delivery_variant_id','integration',p_after->'integration_snapshot','delivery',p_after->'delivery','lines',p_after->'lines','total',p_after->'total','status',p_after->'status',
 'comment',p_after->'comment','confirmation',p_after->'confirmation','receipt',p_after->'receipt','received_at',p_after->'received_at'),delta,p_source)
 returning id into eid;
 -- Enqueue only recipients explicitly enabled at the time of the event. No backfill.
 if (select enabled from public.zzws_notification_settings where id) then
  insert into public.zzws_notification_outbox(event_id,recipient_id)
  select eid,r.id from public.zzws_notification_recipients r where public.zzws_notification_allowed(r.id);
 end if;
 return eid;
end $$;

-- CANONICAL RECORDER: covers every real write, including v2/v3 and receipt.
create function public.zzws_order_activity_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor_id uuid;source_name text;before_data jsonb;begin
 if tg_op='UPDATE' and new.revision=old.revision then return new;end if;
 if tg_op='UPDATE' then before_data=to_jsonb(old);end if;
 begin actor_id=nullif(current_setting('zzws.actor',true),'')::uuid;exception when invalid_text_representation then actor_id=null;end;
 source_name=coalesce(nullif(current_setting('zzws.source',true),''),'maintenance');
 if tg_op='INSERT' then actor_id=coalesce(actor_id,new.user_id);end if;
 if new.received_at is not null and (tg_op='INSERT' or old.received_at is null) then actor_id=new.received_by;source_name='receipt';end if;
 perform public.zzws_record_order_activity(before_data,to_jsonb(new),actor_id,source_name);return new;
end $$;
create trigger zzws_order_activity_guard after insert or update on public.zzws_orders for each row execute function public.zzws_order_activity_guard();
revoke all on function public.zzws_order_activity_guard() from public,anon,authenticated;
grant execute on function public.zzws_order_activity_guard() to service_role;
-- Explicit actor is transaction-local; it is never taken from a browser field or JWT metadata.
do $$ declare definition text;begin
 select pg_get_functiondef('public.zzws_submit_order_v2(uuid,uuid,uuid,bigint,jsonb,jsonb,numeric)'::regprocedure) into definition;
 definition=regexp_replace(definition,'\mbegin\M',E'begin\n perform pg_catalog.set_config(''zzws.actor'',p_user::text,true);\n perform pg_catalog.set_config(''zzws.source'',''catalog'',true);');execute definition;
 select pg_get_functiondef('public.zzws_update_order(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,uuid,jsonb,jsonb)'::regprocedure) into definition;
 definition=regexp_replace(definition,'\mbegin\M',E'begin\n perform pg_catalog.set_config(''zzws.actor'',p_actor::text,true);\n perform pg_catalog.set_config(''zzws.source'',case when p_draft is null then ''manual'' else ''confirmation'' end,true);');execute definition;
end $$;
-- Existing wrapper already includes all stage-1/2 notification tables and contexts.
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_unified;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with original as materialized(select public.zzws_application_snapshot_before_unified() value)
 select value || jsonb_build_object('tables',
 (value->'tables')||jsonb_build_object(
 'user_channels',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_user_channels t),
 'admin_devices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_devices t),
 'external_systems',(select coalesce(jsonb_agg(to_jsonb(t)||'{"enabled":false}'),'[]') from public.zzws_external_systems t),
 'partner_counterparties',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_partner_counterparties t),
 'delivery_counterparties',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_delivery_counterparties t),
 'integration_outbox',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_integration_outbox t),
 'integration_documents',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_integration_documents t),
 'order_integration_resolutions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_integration_resolutions t))) from original;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
