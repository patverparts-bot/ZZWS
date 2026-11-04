-- One existing user/order system and outbox; extend its event envelope for native clients.
begin;
create table public.zzws_mobile_preferences(
 user_id uuid primary key references public.zzws_users(id) on delete cascade,
 enabled boolean not null default false,orders boolean not null default true,comments boolean not null default true,
 prices boolean not null default false,offers boolean not null default false,system boolean not null default true,
 revision integer not null default 0 check(revision>=0)
);
create table public.zzws_mobile_events(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('order.changed','order.comment','catalog.prices','catalog.offers','system')),
 order_id uuid references public.zzws_orders(id),order_revision integer,source_key text unique,
 created timestamptz not null default now(),check((order_id is not null)=(kind in ('order.changed','order.comment')))
);
do $$declare t text;begin foreach t in array array['zzws_mobile_preferences','zzws_mobile_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;
-- Historical envelopes preserve existing outbox references; no notification backfill.
insert into public.zzws_mobile_events(id,kind,order_id,order_revision,source_key,created)
 select id,'order.changed',order_id,revision,'order:'||id,occurred_at from public.zzws_order_activity;
alter table public.zzws_notification_outbox drop constraint zzws_notification_outbox_event_id_fkey;
alter table public.zzws_notification_outbox add foreign key(event_id) references public.zzws_mobile_events(id);

create function public.zzws_mobile_event_allowed(p_recipient uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r
 join public.zzws_users u on u.id=r.user_id and u.active
 join public.zzws_admin_devices d on d.user_id=u.id and d.token=r.destination and d.active
 join public.zzws_mobile_events e on e.id=p_event
 left join public.zzws_mobile_preferences p on p.user_id=u.id
 where r.id=p_recipient and r.channel='android' and r.active
 and (u.profile->>'role'='admin' and public.zzws_notification_allowed(r.id)
   or u.profile->>'role'='client' and p.enabled and
    (e.order_id is null or exists(select 1 from public.zzws_orders o where o.id=e.order_id and o.user_id=u.id)))
 and coalesce(p.enabled,u.profile->>'role'='admin')
 and case e.kind when 'order.changed' then coalesce(p.orders,true) when 'order.comment' then coalesce(p.comments,true)
 when 'catalog.prices' then coalesce(p.prices,false) when 'catalog.offers' then coalesce(p.offers,false) else coalesce(p.system,true) end);
$$;
create function public.zzws_mobile_capture_order() returns trigger language plpgsql security invoker set search_path='' as $$begin
 insert into public.zzws_mobile_events(id,kind,order_id,order_revision,source_key,created)
 values(new.id,case when new.changes ? 'comment' and not(new.changes ?| array['status','lines','total']) then 'order.comment' else 'order.changed' end,new.order_id,new.revision,'order:'||new.id,new.occurred_at);
 if exists(select 1 from public.zzws_notification_settings where id and enabled) then
  insert into public.zzws_notification_outbox(event_id,recipient_id)
  select new.id,r.id from public.zzws_notification_recipients r join public.zzws_users u on u.id=r.user_id
  where u.profile->>'role'='client' and public.zzws_mobile_event_allowed(r.id,new.id) on conflict do nothing;
 end if;return new;
end $$;
create trigger zzws_mobile_capture_order after insert on public.zzws_order_activity for each row execute function public.zzws_mobile_capture_order();

create function public.zzws_mobile_notice(p_kind text,p_source text) returns uuid language plpgsql security invoker set search_path='' as $$declare eid uuid;begin
 if p_kind not in ('catalog.prices','catalog.offers','system') or p_source is null or length(p_source)>200 then raise sqlstate 'PT400' using message='Invalid notice';end if;
 insert into public.zzws_mobile_events(kind,source_key) values(p_kind,p_source) on conflict(source_key) do nothing returning id into eid;
 if eid is null then select id into eid from public.zzws_mobile_events where source_key=p_source;return eid;end if;
 if exists(select 1 from public.zzws_notification_settings where id and enabled) then
  insert into public.zzws_notification_outbox(event_id,recipient_id) select eid,r.id from public.zzws_notification_recipients r where public.zzws_mobile_event_allowed(r.id,eid) on conflict do nothing;
 end if;return eid;
end $$;
create function public.zzws_mobile_capture_prices() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.version is distinct from old.version and new.version is not null then perform public.zzws_mobile_notice('catalog.prices','catalog:'||new.version);end if;return new;
end $$;
create trigger zzws_mobile_capture_prices after update on public.zzws_state for each row execute function public.zzws_mobile_capture_prices();

create function public.zzws_save_mobile_preferences(p_user uuid,p_value jsonb,p_expected integer) returns jsonb language plpgsql security invoker set search_path='' as $$declare result public.zzws_mobile_preferences;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403';end if;
 insert into public.zzws_mobile_preferences(user_id) values(p_user) on conflict do nothing;
 update public.zzws_mobile_preferences set enabled=(p_value->>'enabled')::boolean,orders=(p_value->>'orders')::boolean,comments=(p_value->>'comments')::boolean,prices=(p_value->>'prices')::boolean,offers=(p_value->>'offers')::boolean,system=(p_value->>'system')::boolean,revision=revision+1 where user_id=p_user and revision=p_expected returning * into result;
 if not found then raise sqlstate 'PT409';end if;
 if not result.enabled then update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null where state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and r.user_id=p_user);end if;
 return to_jsonb(result);
end $$;
create function public.zzws_register_mobile_device(p_user uuid,p_device text,p_token text default null,p_revoke boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$declare d public.zzws_admin_devices;begin
 perform 1 from public.zzws_users where id=p_user and active and (profile->>'role'='client' or profile->>'role'='admin' and exists(select 1 from public.zzws_user_channels c join public.zzws_admin_scopes s on s.user_id=c.user_id where c.user_id=p_user and c.mobile_admin_enabled and s.scope in ('owner','manager','viewer','price'))) for update;
 if not found then raise sqlstate 'PT403';end if;
 if p_revoke is null or p_device is null or p_device !~ '^[a-zA-Z0-9_.:-]{8,200}$' then raise sqlstate 'PT400';end if;
 select * into d from public.zzws_admin_devices where user_id=p_user and device_id=p_device for update;
 if p_revoke then
  if found then update public.zzws_admin_devices set active=false,updated=now() where id=d.id;update public.zzws_notification_recipients set active=false where channel='android' and user_id=p_user and destination=d.token;end if;return jsonb_build_object('ok',true);
 end if;
 if not exists(select 1 from public.zzws_mobile_preferences where user_id=p_user and enabled) then raise sqlstate 'PT403';end if;
 if p_token is null or length(p_token) not between 20 and 4096 or p_token ~ '[[:space:][:cntrl:]]' then raise sqlstate 'PT400';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_token,93028));
 if exists(select 1 from public.zzws_admin_devices where token=p_token and (user_id<>p_user or device_id<>p_device)) or exists(select 1 from public.zzws_notification_recipients where channel='android' and destination=p_token and user_id is distinct from p_user) then raise sqlstate 'PT409';end if;
 if d.id is not null and d.token<>p_token then update public.zzws_notification_recipients set active=false where channel='android' and user_id=p_user and destination=d.token;end if;
 insert into public.zzws_admin_devices(user_id,device_id,token) values(p_user,p_device,p_token) on conflict(user_id,device_id) do update set token=excluded.token,active=true,updated=now();
 insert into public.zzws_notification_recipients(channel,destination,user_id,active) values('android',p_token,p_user,true) on conflict(channel,destination) do update set active=true where public.zzws_notification_recipients.user_id=p_user;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.zzws_android_job(p_id uuid,p_token uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',q.id,'leaseToken',q.lease_token,'token',r.destination,'eventId',e.id,'orderId',e.order_id,'revision',coalesce(e.order_revision,1)) ||
 case when exists(select 1 from public.zzws_mobile_preferences where user_id=r.user_id) then jsonb_build_object('kind',e.kind,'userId',r.user_id) else '{}'::jsonb end
 from public.zzws_notification_outbox q join public.zzws_notification_recipients r on r.id=q.recipient_id join public.zzws_mobile_events e on e.id=q.event_id
 where q.id=p_id and q.lease_token=p_token and q.state='leased' and q.lease_until>clock_timestamp() and public.zzws_mobile_event_allowed(r.id,e.id)
 and exists(select 1 from public.zzws_notification_settings where id and enabled);
$$;
create or replace function public.zzws_claim_android() returns jsonb language plpgsql security invoker set search_path='' as $$declare job public.zzws_notification_outbox;begin
 if not exists(select 1 from public.zzws_notification_settings where id and enabled) then return null;end if;
 update public.zzws_notification_outbox q set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired' from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and q.state='leased' and q.lease_until<=clock_timestamp();
 select q.* into job from public.zzws_notification_outbox q join public.zzws_notification_recipients r on r.id=q.recipient_id
 where r.channel='android' and q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8 and public.zzws_mobile_event_allowed(r.id,q.event_id)
 order by q.created,q.id for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.zzws_notification_outbox set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=job.id returning * into job;
 return public.zzws_android_job(job.id,job.lease_token);
end $$;
-- Keep the old acknowledgement API for existing Telegram and Android workers.
create or replace function public.zzws_finish_notification(p_id uuid,p_token uuid,p_result text,p_message text default null,p_retry_seconds integer default 30) returns boolean
language plpgsql security invoker set search_path='' as $$declare q public.zzws_notification_outbox;allowed boolean;begin
 select * into q from public.zzws_notification_outbox where id=p_id for update;
 if not found or q.state<>'leased' or q.lease_token is distinct from p_token or q.lease_until<=clock_timestamp() then return false;end if;
 if p_result not in ('sent','retry','dead','uncertain') or p_result is null then raise exception 'Invalid notification result';end if;
 select case when channel='android' then public.zzws_mobile_event_allowed(id,q.event_id) else public.zzws_notification_allowed(id) end into allowed from public.zzws_notification_recipients where id=q.recipient_id;
 update public.zzws_notification_outbox set state=case when not coalesce(allowed,false) then 'cancelled' when p_result='retry' and q.attempts>=8 then 'dead' else p_result end,
 provider_message_id=case when p_result='sent' then left(p_message,256) else null end,sent_at=case when p_result='sent' then clock_timestamp() else null end,
 last_error=case when p_result='sent' then null else p_result end,available_at=clock_timestamp()+make_interval(secs=>least(86400,greatest(coalesce(p_retry_seconds,30),30*power(2,q.attempts-1)::integer))),lease_token=null,lease_until=null where id=p_id;return true;
end $$;

alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_mobile;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with previous as materialized(select public.zzws_application_snapshot_before_mobile() value)
 select value||jsonb_build_object('schemaVersion','zzws-unified-4.0.0','tables',(value->'tables')||jsonb_build_object('mobile_preferences',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_mobile_preferences t),'mobile_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_mobile_events t))) from previous;
$$;
revoke all on function public.zzws_mobile_event_allowed(uuid,uuid),public.zzws_mobile_capture_order(),public.zzws_mobile_notice(text,text),public.zzws_mobile_capture_prices(),public.zzws_save_mobile_preferences(uuid,jsonb,integer),public.zzws_register_mobile_device(uuid,text,text,boolean),public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_mobile_event_allowed(uuid,uuid),public.zzws_mobile_capture_order(),public.zzws_mobile_notice(text,text),public.zzws_mobile_capture_prices(),public.zzws_save_mobile_preferences(uuid,jsonb,integer),public.zzws_register_mobile_device(uuid,text,text,boolean),public.zzws_application_snapshot() to service_role;
commit;
