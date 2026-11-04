-- Additive multi-administrator Telegram delivery. No enabling, no backfill, no network.
drop index public.zzws_one_telegram_recipient;
drop index public.zzws_one_telegram_card;

create or replace function public.zzws_notification_allowed(p_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r join public.zzws_users u on u.id=r.user_id join public.zzws_admin_scopes s on s.user_id=u.id join public.zzws_user_channels c on c.user_id=u.id
 where r.id=p_id and r.active and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer')
 and case when r.channel='android' then c.mobile_admin_enabled else c.telegram_enabled and c.telegram_id=r.destination and c.telegram_bot_username is not null end);
$$;
create or replace function public.zzws_save_channels_v2(p_actor uuid,p_user uuid,p_mobile boolean,p_telegram boolean,p_expected integer,p_set_id boolean default false,p_telegram_id text default null,p_set_bot boolean default false,p_bot_username text default null) returns jsonb
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
  if exists(select 1 from public.zzws_notification_recipients where channel='telegram' and destination=c.telegram_id and user_id is distinct from p_user) then raise sqlstate 'PT409' using message='Telegram ID already assigned';end if;
  insert into public.zzws_notification_recipients(channel,destination,user_id,active) values('telegram',c.telegram_id,p_user,true) on conflict(channel,destination) do update set active=true where public.zzws_notification_recipients.user_id=p_user;
 end if;
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked' where q.state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='telegram' and not r.active);
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'telegram_connection_update',jsonb_build_object('target',p_user,'configured',c.telegram_id is not null,'botUsername',c.telegram_bot_username)::text);
 return to_jsonb(c);
exception when unique_violation then raise sqlstate 'PT409' using message='Telegram ID already assigned';
end $$;

create function public.zzws_telegram_destinations() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('telegramId',r.destination,'botUsername',c.telegram_bot_username,'userId',c.user_id) order by c.user_id),'[]'::jsonb)
 from public.zzws_notification_recipients r join public.zzws_user_channels c on c.user_id=r.user_id and c.telegram_id=r.destination
 where r.channel='telegram' and public.zzws_notification_allowed(r.id) and c.telegram_bot_username is not null;
$$;
-- Legacy callers still receive a single object. New senders always use the plural RPC.
create or replace function public.zzws_telegram_destination() returns jsonb language sql stable security invoker set search_path='' as $$
 select public.zzws_telegram_destinations()->0;
$$;
revoke all on function public.zzws_telegram_destinations() from public,anon,authenticated;
grant execute on function public.zzws_telegram_destinations() to service_role;
create or replace function public.zzws_prepare_start(p_bot text,p_update bigint,p_chat text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare row public.zzws_telegram_commands;destination jsonb;kind text;begin
 if p_bot is null or p_bot!~'^[A-Za-z][A-Za-z0-9_]{4,31}$' or p_update is null or p_update<0 or p_chat is null or p_chat!~'^[1-9][0-9]{0,15}$' or p_chat::numeric>4503599627370495 then raise sqlstate 'PT400' using message='Invalid start update';end if;
 -- Serialize replies per private chat without blocking the order notification queue.
 perform pg_advisory_xact_lock(hashtextextended(lower(p_bot)||':'||p_chat,9302804));
 insert into public.zzws_telegram_commands(bot_username,update_id,chat_id) values(lower(p_bot),p_update,p_chat) on conflict(bot_username,update_id) do nothing;
 select * into row from public.zzws_telegram_commands where bot_username=lower(p_bot) and update_id=p_update for update;
 if row.chat_id<>p_chat then raise sqlstate 'PT409' using message='Update identity conflict';end if;
 if row.state='sending' and row.lease_until<=clock_timestamp() then update public.zzws_telegram_commands set state='uncertain',lease_token=null,lease_until=null where id=row.id;return jsonb_build_object('skip',true);end if;
 if row.state not in ('pending','retry') then return jsonb_build_object('skip',true);end if;
 if row.available_at>clock_timestamp() then return jsonb_build_object('retryAfter',30);end if;
 select x into destination from jsonb_array_elements(public.zzws_telegram_destinations()) x where x->>'telegramId'=p_chat and lower(x->>'botUsername')=lower(p_bot) limit 1;
 kind=case when destination->>'telegramId'=p_chat and lower(destination->>'botUsername')=lower(p_bot) then 'welcome' else 'denied' end;
 if kind='denied' and exists(select 1 from public.zzws_telegram_commands c where c.id<>row.id and c.bot_username=lower(p_bot) and c.chat_id=p_chat and c.reply_kind='denied' and c.created>clock_timestamp()-interval '60 seconds' and c.state in ('sending','sent','uncertain')) then update public.zzws_telegram_commands set state='ignored',reply_kind='denied' where id=row.id;return jsonb_build_object('skip',true);end if;
 update public.zzws_telegram_commands set state='sending',reply_kind=kind,attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=row.id returning * into row;
 return jsonb_build_object('id',row.id,'leaseToken',row.lease_token,'chatId',row.chat_id,'kind',kind);
end $$;
