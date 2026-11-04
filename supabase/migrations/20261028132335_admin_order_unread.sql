create table public.zzws_admin_order_reads(user_id uuid not null references public.zzws_users(id) on delete cascade,order_id uuid not null references public.zzws_orders(id) on delete cascade,revision integer not null check(revision>=1),read_at timestamptz not null default now(),primary key(user_id,order_id));
alter table public.zzws_admin_order_reads enable row level security;
revoke all on public.zzws_admin_order_reads from public,anon,authenticated;
grant all on public.zzws_admin_order_reads to service_role;
create policy service_only on public.zzws_admin_order_reads for all to service_role using(true) with check(true);
create function public.zzws_admin_order_summary(p_user uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$ begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_user and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer')) then raise sqlstate 'PT403' using message='Order read permission required';end if;
 return jsonb_build_object('refreshSeconds',(select case when profile->>'ordersRefreshSeconds' ~ '^[0-9]{1,3}$' then greatest(5,least(300,(profile->>'ordersRefreshSeconds')::integer)) else 5 end from public.zzws_users where id=p_user),'unreadCount',(select count(*) from public.zzws_orders o left join public.zzws_admin_order_reads r on r.order_id=o.id and r.user_id=p_user where r.revision is null or r.revision<o.revision),'version',(select coalesce(max(sequence),0)::text from public.zzws_order_activity));
end $$;
create function public.zzws_mark_admin_order_read(p_user uuid,p_order uuid,p_revision integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare current_revision integer;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_user and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager','viewer')) then raise sqlstate 'PT403' using message='Order read permission required';end if;
 select revision into current_revision from public.zzws_orders where id=p_order;
 if not found then raise sqlstate 'PT404' using message='Order not found';end if;
 if p_revision is null or p_revision<1 or p_revision>current_revision then raise sqlstate 'PT400' using message='Invalid viewed revision';end if;
 insert into public.zzws_admin_order_reads(user_id,order_id,revision) values(p_user,p_order,p_revision) on conflict(user_id,order_id) do update set revision=greatest(public.zzws_admin_order_reads.revision,excluded.revision),read_at=now();return true;
end $$;
revoke all on function public.zzws_admin_order_summary(uuid),public.zzws_mark_admin_order_read(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.zzws_admin_order_summary(uuid),public.zzws_mark_admin_order_read(uuid,uuid,integer) to service_role;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_admin_reads;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with original as materialized(select public.zzws_application_snapshot_before_admin_reads() value)
 select value||jsonb_build_object('tables',(value->'tables')||jsonb_build_object('admin_order_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_order_reads t))) from original;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
create function public.zzws_save_admin_polling(p_actor uuid,p_user uuid,p_seconds integer,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare revision bigint;role_name text;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Owner required';end if;
 if p_seconds is null or p_seconds not between 5 and 300 then raise sqlstate 'PT400' using message='Refresh interval must be between 5 and 300 seconds';end if;
 select profile_revision,profile->>'role' into revision,role_name from public.zzws_users where id=p_user for update;
 if not found or role_name<>'admin' then raise sqlstate 'PT400' using message='Administrator required';end if;
 if revision is distinct from p_expected then raise sqlstate 'PT409' using message='Profile changed';end if;
 update public.zzws_users set profile=jsonb_set(profile,'{ordersRefreshSeconds}',to_jsonb(p_seconds)) where id=p_user returning profile_revision into revision;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'admin_polling_update',jsonb_build_object('target',p_user,'seconds',p_seconds)::text);
 return jsonb_build_object('seconds',p_seconds,'profileRevision',revision);
end $$;
revoke all on function public.zzws_save_admin_polling(uuid,uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.zzws_save_admin_polling(uuid,uuid,integer,bigint) to service_role;
