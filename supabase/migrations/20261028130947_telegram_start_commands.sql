-- /start has its own replay protection. No writes to orders, activity or notification outbox.
create table public.zzws_telegram_commands(
 id uuid primary key default gen_random_uuid(),bot_username text not null,update_id bigint not null check(update_id>=0),chat_id text not null check(chat_id ~ '^[1-9][0-9]{0,15}$'),
 reply_kind text check(reply_kind in ('welcome','denied')),state text not null default 'pending' check(state in ('pending','sending','sent','retry','uncertain','dead','ignored')),
 attempts integer not null default 0,lease_token uuid,lease_until timestamptz,available_at timestamptz not null default now(),created timestamptz not null default now(),provider_message_id text,
 unique(bot_username,update_id),check((state='sending')=(lease_token is not null and lease_until is not null))
);
create index zzws_start_rate on public.zzws_telegram_commands(bot_username,chat_id,created desc);
alter table public.zzws_telegram_commands enable row level security;
revoke all on public.zzws_telegram_commands from public,anon,authenticated;
grant all on public.zzws_telegram_commands to service_role;
create policy service_only on public.zzws_telegram_commands for all to service_role using(true) with check(true);
create function public.zzws_prepare_start(p_bot text,p_update bigint,p_chat text) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 destination=public.zzws_telegram_destination();
 kind=case when destination->>'telegramId'=p_chat and lower(destination->>'botUsername')=lower(p_bot) then 'welcome' else 'denied' end;
 if kind='denied' and exists(select 1 from public.zzws_telegram_commands c where c.id<>row.id and c.bot_username=lower(p_bot) and c.chat_id=p_chat and c.reply_kind='denied' and c.created>clock_timestamp()-interval '60 seconds' and c.state in ('sending','sent','uncertain')) then update public.zzws_telegram_commands set state='ignored',reply_kind='denied' where id=row.id;return jsonb_build_object('skip',true);end if;
 update public.zzws_telegram_commands set state='sending',reply_kind=kind,attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes' where id=row.id returning * into row;
 return jsonb_build_object('id',row.id,'leaseToken',row.lease_token,'chatId',row.chat_id,'kind',kind);
end $$;
create function public.zzws_finish_start(p_id uuid,p_token uuid,p_result text,p_message text default null,p_retry_seconds integer default 30) returns boolean language plpgsql security invoker set search_path='' as $$
declare row public.zzws_telegram_commands;begin
 select * into row from public.zzws_telegram_commands where id=p_id for update;
 if not found or row.state<>'sending' or row.lease_token is distinct from p_token or row.lease_until<=clock_timestamp() then return false;end if;
 if p_result is null or p_result not in ('sent','retry','uncertain','dead') then raise exception 'Invalid command result';end if;
 update public.zzws_telegram_commands set state=case when p_result='retry' and attempts>=4 then 'dead' else p_result end,lease_token=null,lease_until=null,provider_message_id=case when p_result='sent' then left(p_message,100) else null end,available_at=clock_timestamp()+make_interval(secs=>least(3600,greatest(5,coalesce(p_retry_seconds,30)))) where id=p_id;
 return true;
end $$;
revoke all on function public.zzws_prepare_start(text,bigint,text),public.zzws_finish_start(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_prepare_start(text,bigint,text),public.zzws_finish_start(uuid,uuid,text,text,integer) to service_role;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_start;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with original as materialized(select public.zzws_application_snapshot_before_start() value)
 select value||jsonb_build_object('tables',(value->'tables')||jsonb_build_object('telegram_commands',(select coalesce(jsonb_agg(to_jsonb(t)||case when t.state='sending' then '{"state":"uncertain","lease_token":null,"lease_until":null}'::jsonb else '{}'::jsonb end),'[]') from public.zzws_telegram_commands t))) from original;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
