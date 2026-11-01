begin;
create table public.zzws_apk_downloads(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zzws_users(id) on delete cascade,
 version_code integer not null check(version_code>0),
 version text not null check(length(version) between 1 and 80),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 bytes bigint not null check(bytes between 22 and 50000000),
 source text not null check(source in('web','android','unknown')),
 requested_at timestamptz not null default now(),
 completed_at timestamptz,
 check(completed_at is null or completed_at>=requested_at)
);
create index zzws_apk_downloads_version_user on public.zzws_apk_downloads(version_code,user_id,requested_at desc);
create index zzws_apk_downloads_user on public.zzws_apk_downloads(user_id);
create table public.zzws_apk_usage(
 user_id uuid primary key references public.zzws_users(id) on delete cascade,
 version_code integer not null check(version_code>0),
 version text not null check(length(version) between 1 and 80),
 observed_at timestamptz not null default now()
);
do $$declare t text;begin foreach t in array array['zzws_apk_downloads','zzws_apk_usage'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;

create function public.zzws_apk_download_start(p_user uuid,p_release jsonb,p_source text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;begin
 perform 1 from public.zzws_users where id=p_user and active for share;
 if not found then raise sqlstate 'PT403';end if;
 insert into public.zzws_apk_downloads(user_id,version_code,version,sha256,bytes,source)
 values(p_user,(p_release->>'versionCode')::integer,p_release->>'version',p_release->>'sha256',(p_release->>'bytes')::bigint,p_source)
 returning id into result;return result;
end $$;
create function public.zzws_apk_download_complete(p_user uuid,p_download uuid,p_sha256 text,p_bytes bigint) returns boolean
language plpgsql security invoker set search_path='' as $$begin
 update public.zzws_apk_downloads set completed_at=coalesce(completed_at,now())
 where id=p_download and user_id=p_user and sha256=p_sha256 and bytes=p_bytes;
 return found;
end $$;
create function public.zzws_apk_usage_record(p_user uuid,p_version_code integer,p_version text) returns void
language sql security invoker set search_path='' as $$
 insert into public.zzws_apk_usage(user_id,version_code,version) values(p_user,p_version_code,p_version)
 on conflict(user_id) do update set version_code=excluded.version_code,version=excluded.version,observed_at=now();
$$;

create function public.zzws_apk_download_report(p_version integer,p_query text default '',p_status text default '',p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
 with downloads as (
  select user_id,max(requested_at) requested_at,max(completed_at) completed_at,count(*) attempts,
   string_agg(distinct source,', ' order by source) sources
  from public.zzws_apk_downloads where version_code=p_version group by user_id
 ), people as (
  select u.id,u.active,u.profile->>'client' client,u.profile->>'customerCode' customer_code,
   case when u.login like 'pending.%' then '' else u.login end login,
   coalesce(nullif(trim(concat_ws(' ',u.person->>'firstName',u.person->>'lastName')),''),nullif(u.person->>'label',''),u.profile->>'client') name,
   case when u.profile->>'role'='admin' then 'admin' when u.customer_id is null then 'manager' else 'employee' end role,
   d.requested_at,d.completed_at,coalesce(d.attempts,0) attempts,d.sources,
   a.version observed_version,a.version_code observed_version_code,a.observed_at,
   case when d.completed_at is not null then 'downloaded' when d.requested_at is not null then 'requested' else 'unknown' end status
  from public.zzws_users u left join downloads d on d.user_id=u.id left join public.zzws_apk_usage a on a.user_id=u.id
  where coalesce(p_query,'')='' or concat_ws(' ',u.login,u.profile->>'client',u.profile->>'customerCode',u.person->>'firstName',u.person->>'lastName',u.person->>'label') ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%'
 ), filtered as(select * from people where coalesce(p_status,'')='' or status=p_status), page as(
  select * from filtered order by client nulls last,name,id limit 50 offset greatest(0,least(p_offset,100000))
 ), versions as(
  select version_code,max(version) version from public.zzws_apk_downloads group by version_code
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
  'total',(select count(*) from filtered),'limit',50,'offset',greatest(0,least(p_offset,100000)),
  'totals',(select jsonb_build_object('downloaded',count(*) filter(where status='downloaded'),'requested',count(*) filter(where status='requested'),'unknown',count(*) filter(where status='unknown')) from people),
  'versions',coalesce((select jsonb_agg(to_jsonb(v) order by version_code desc) from(select distinct version_code,version from versions) v),'[]'::jsonb));
$$;
revoke all on function public.zzws_apk_download_start(uuid,jsonb,text),public.zzws_apk_download_complete(uuid,uuid,text,bigint),public.zzws_apk_usage_record(uuid,integer,text),public.zzws_apk_download_report(integer,text,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_apk_download_start(uuid,jsonb,text),public.zzws_apk_download_complete(uuid,uuid,text,bigint),public.zzws_apk_usage_record(uuid,integer,text),public.zzws_apk_download_report(integer,text,text,integer) to service_role;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_apk_tracking;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with previous as materialized(select public.zzws_application_snapshot_before_apk_tracking() value)
 select value||jsonb_build_object('tables',(value->'tables')||jsonb_build_object(
 'apk_downloads',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.zzws_apk_downloads d),
 'apk_usage',(select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from public.zzws_apk_usage u))) from previous;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
