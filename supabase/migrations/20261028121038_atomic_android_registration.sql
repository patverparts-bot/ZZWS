-- Local-only preparation. No network calls or historical replay.
create function public.zzws_register_android_device(p_user uuid,p_device text,p_token text default null,p_revoke boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.zzws_user_channels;d public.zzws_admin_devices;begin
 -- Lock the same channel row as rights changes before touching devices.
 select * into c from public.zzws_user_channels where user_id=p_user for update;
 if not found or not c.mobile_admin_enabled or not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_user and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer')) then raise sqlstate 'PT403' using message='Android access denied';end if;
 if p_revoke is null or p_device is null or p_device !~ '^[a-zA-Z0-9_.:-]{8,200}$' then raise sqlstate 'PT400' using message='Invalid device';end if;
 select * into d from public.zzws_admin_devices where user_id=p_user and device_id=p_device for update;
 if p_revoke then
  if found then update public.zzws_admin_devices set active=false,updated=now() where id=d.id;update public.zzws_notification_recipients set active=false where channel='android' and user_id=p_user and destination=d.token;end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_token is null or length(p_token) not between 20 and 4096 or p_token ~ '[[:space:][:cntrl:]]' then raise sqlstate 'PT400' using message='Invalid token';end if;
 -- A token cannot migrate between accounts, including revoked device records.
 perform pg_advisory_xact_lock(hashtextextended(p_token,93028));
 if exists(select 1 from public.zzws_admin_devices where token=p_token and (user_id<>p_user or device_id<>p_device)) or exists(select 1 from public.zzws_notification_recipients where channel='android' and destination=p_token and user_id is distinct from p_user) then raise sqlstate 'PT409' using message='Device token already registered';end if;
 if d.id is not null and d.token<>p_token then update public.zzws_notification_recipients set active=false where channel='android' and user_id=p_user and destination=d.token;end if;
 insert into public.zzws_admin_devices(user_id,device_id,token) values(p_user,p_device,p_token) on conflict(user_id,device_id) do update set token=excluded.token,active=true,updated=now();
 insert into public.zzws_notification_recipients(channel,destination,user_id,active) values('android',p_token,p_user,true) on conflict(channel,destination) do update set active=true where public.zzws_notification_recipients.user_id=p_user;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.zzws_register_android_device(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.zzws_register_android_device(uuid,text,text,boolean) to service_role;

create function public.zzws_android_job(p_id uuid,p_token uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',q.id,'leaseToken',q.lease_token,'token',r.destination,'eventId',e.id,'orderId',e.order_id,'revision',e.revision)
 from public.zzws_notification_outbox q join public.zzws_notification_recipients r on r.id=q.recipient_id join public.zzws_order_activity e on e.id=q.event_id join public.zzws_admin_devices d on d.user_id=r.user_id and d.token=r.destination and d.active
 where q.id=p_id and q.lease_token=p_token and q.state='leased' and q.lease_until>clock_timestamp() and r.channel='android' and public.zzws_notification_allowed(r.id)
 and exists(select 1 from public.zzws_notification_settings where id and enabled);
$$;
create function public.zzws_claim_android() returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.zzws_notification_outbox;begin
 if not exists(select 1 from public.zzws_notification_settings where id and enabled) then return null;end if;
 update public.zzws_notification_outbox q set state='uncertain',lease_token=null,lease_until=null,last_error='lease_expired' from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and q.state='leased' and q.lease_until<=clock_timestamp();
 select q.* into job from public.zzws_notification_outbox q join public.zzws_notification_recipients r on r.id=q.recipient_id join public.zzws_admin_devices d on d.user_id=r.user_id and d.token=r.destination and d.active
 where r.channel='android' and q.state in ('pending','retry') and q.available_at<=clock_timestamp() and q.attempts<8 and public.zzws_notification_allowed(r.id)
 order by q.created,q.id for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.zzws_notification_outbox set state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=job.id returning * into job;
 return public.zzws_android_job(job.id,job.lease_token);
end $$;
create function public.zzws_begin_android(p_id uuid,p_token uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 perform 1 from public.zzws_notification_outbox where id=p_id for update;
 result=public.zzws_android_job(p_id,p_token);
 if result is null then update public.zzws_notification_outbox set state='cancelled',lease_token=null,lease_until=null where id=p_id and state='leased' and lease_token=p_token and lease_until>clock_timestamp();end if;
 return result;
end $$;
revoke all on function public.zzws_android_job(uuid,uuid),public.zzws_claim_android(),public.zzws_begin_android(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_android_job(uuid,uuid),public.zzws_claim_android(),public.zzws_begin_android(uuid,uuid) to service_role;
