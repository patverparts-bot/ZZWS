begin;
-- A rollback is another actual price change, even when this version was active earlier.
create or replace function public.zzws_mobile_capture_prices() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.version is distinct from old.version and new.version is not null then perform public.zzws_mobile_notice('catalog.prices','catalog:'||new.version||':'||gen_random_uuid());end if;return new;
end $$;
-- Price operators may receive catalogue notices, never orders they cannot administer.
create or replace function public.zzws_mobile_event_allowed(p_recipient uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r
 join public.zzws_users u on u.id=r.user_id and u.active
 join public.zzws_admin_devices d on d.user_id=u.id and d.token=r.destination and d.active
 join public.zzws_mobile_events e on e.id=p_event
 left join public.zzws_mobile_preferences p on p.user_id=u.id
 where r.id=p_recipient and r.channel='android' and r.active
 and (u.profile->>'role'='admin' and
   (e.order_id is not null and public.zzws_notification_allowed(r.id) or e.order_id is null and exists(select 1 from public.zzws_user_channels c join public.zzws_admin_scopes s on s.user_id=c.user_id where c.user_id=u.id and c.mobile_admin_enabled and s.scope in ('owner','manager','viewer','price')))
   or u.profile->>'role'='client' and p.enabled and (e.order_id is null or exists(select 1 from public.zzws_orders o where o.id=e.order_id and o.user_id=u.id)))
 and coalesce(p.enabled,u.profile->>'role'='admin')
 and case e.kind when 'order.changed' then coalesce(p.orders,true) when 'order.comment' then coalesce(p.comments,true)
 when 'catalog.prices' then coalesce(p.prices,false) when 'catalog.offers' then coalesce(p.offers,false) else coalesce(p.system,true) end);
$$;
create or replace function public.zzws_claim_android() returns jsonb language plpgsql security invoker set search_path='' as $$declare job public.zzws_notification_outbox;begin
 if not exists(select 1 from public.zzws_notification_settings where id and enabled) then return null;end if;
 update public.zzws_notification_outbox q set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired' from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and q.state='leased' and q.lease_until<=clock_timestamp();
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked' from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and q.state in ('pending','retry') and not public.zzws_mobile_event_allowed(r.id,q.event_id);
 select q.* into job from public.zzws_notification_outbox q join public.zzws_notification_recipients r on r.id=q.recipient_id
 where r.channel='android' and q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8 and public.zzws_mobile_event_allowed(r.id,q.event_id)
 order by q.created,q.id for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.zzws_notification_outbox set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=job.id returning * into job;
 return public.zzws_android_job(job.id,job.lease_token);
end $$;
commit;
