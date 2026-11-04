-- Personal Telegram IDs belong to administrator cards, never to public configuration.
alter table public.zzws_user_channels add column telegram_id text check(telegram_id is null or (telegram_id ~ '^[1-9][0-9]{0,15}$' and telegram_id::numeric<=4503599627370495));
alter table public.zzws_user_channels add column telegram_bot_username text default 'zzws_orders_notify_bot' check(telegram_bot_username is null or (telegram_bot_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$' and lower(telegram_bot_username) not in ('botfather','userinfobot')));
-- Existing recipient assignments are retained. Conflicting legacy recipients require review.
do $$ begin if (select count(*) from public.zzws_notification_recipients where channel='telegram' and active)>1 then raise exception 'Review Telegram recipients: only one recipient is permitted';end if;end $$;
update public.zzws_user_channels c set telegram_id=r.destination from public.zzws_notification_recipients r where r.channel='telegram' and r.active and r.user_id=c.user_id and r.destination ~ '^[1-9][0-9]{0,15}$';
create unique index zzws_one_telegram_recipient on public.zzws_notification_recipients(channel) where channel='telegram' and active;
create unique index zzws_one_telegram_card on public.zzws_user_channels((true)) where telegram_enabled and telegram_id is not null;
create function public.zzws_save_channels_v2(p_actor uuid,p_user uuid,p_mobile boolean,p_telegram boolean,p_expected integer,p_set_id boolean default false,p_telegram_id text default null,p_set_bot boolean default false,p_bot_username text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.zzws_user_channels;old_recipient public.zzws_notification_recipients;result jsonb;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Owner required';end if;
 perform pg_advisory_xact_lock(9302803);
 -- Revoked/downgraded administrators cannot reserve the sole receiver slot forever.
 update public.zzws_user_channels channels set telegram_enabled=false,revision=channels.revision+1,updated=now() where channels.user_id<>p_user and channels.telegram_enabled and channels.telegram_id is not null and not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=channels.user_id and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer'));
 result=public.zzws_save_channels(p_actor,p_user,p_mobile,p_telegram,p_expected);
 if p_set_id then update public.zzws_user_channels set telegram_id=nullif(p_telegram_id,'') where user_id=p_user;end if;
 if p_set_bot then update public.zzws_user_channels set telegram_bot_username=nullif(p_bot_username,'') where user_id=p_user;end if;
 select * into c from public.zzws_user_channels where user_id=p_user;
 if p_set_id and p_telegram and c.telegram_id is null then raise sqlstate 'PT400' using message='Telegram recipient ID required';end if;
 if p_telegram and c.telegram_id is not null and not exists(select 1 from public.zzws_admin_scopes where user_id=p_user and scope in ('owner','manager','viewer')) then raise sqlstate 'PT400' using message='Order read permission required';end if;
 -- Disable old/forbidden destinations and cancel pending work. Never retarget existing jobs.
 update public.zzws_notification_recipients r set active=false where r.channel='telegram' and (not public.zzws_notification_allowed(r.id) or r.user_id=p_user and (not p_telegram or r.destination is distinct from c.telegram_id));
 if p_telegram and c.telegram_id is not null then
  if exists(select 1 from public.zzws_notification_recipients where channel='telegram' and active and user_id is distinct from p_user) then raise sqlstate 'PT409' using message='Disable previous Telegram recipient first';end if;
  if exists(select 1 from public.zzws_notification_recipients where channel='telegram' and destination=c.telegram_id and user_id is distinct from p_user) then raise sqlstate 'PT409' using message='Telegram ID already assigned';end if;
  insert into public.zzws_notification_recipients(channel,destination,user_id,active) values('telegram',c.telegram_id,p_user,true) on conflict(channel,destination) do update set active=true where public.zzws_notification_recipients.user_id=p_user;
 end if;
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked' where q.state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='telegram' and not r.active);
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'telegram_connection_update',jsonb_build_object('target',p_user,'configured',c.telegram_id is not null,'botUsername',c.telegram_bot_username)::text);
 return to_jsonb(c);
exception when unique_violation then raise sqlstate 'PT409' using message='Only one Telegram recipient is permitted';
end $$;
create function public.zzws_telegram_destination() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('telegramId',r.destination,'botUsername',c.telegram_bot_username,'userId',c.user_id)
 from public.zzws_notification_recipients r join public.zzws_user_channels c on c.user_id=r.user_id and c.telegram_id=r.destination
 where r.channel='telegram' and public.zzws_notification_allowed(r.id);
$$;
revoke all on function public.zzws_save_channels_v2(uuid,uuid,boolean,boolean,integer,boolean,text,boolean,text),public.zzws_telegram_destination() from public,anon,authenticated;
grant execute on function public.zzws_save_channels_v2(uuid,uuid,boolean,boolean,integer,boolean,text,boolean,text),public.zzws_telegram_destination() to service_role;
