-- Manual, resumable product-fact refresh. No cron or background schedule.
create table if not exists public.zzws_product_specifications (
 articul text primary key check(length(articul) between 1 and 100 and articul not in ('__proto__','constructor','prototype')),
 name text not null check(length(name) between 1 and 500),
 source_url text not null check(length(source_url) between 1 and 2048),
 provider text not null default 'zigzag' check(provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
 checked_at timestamptz not null,
 specifications jsonb not null check(jsonb_typeof(specifications)='array' and jsonb_array_length(specifications) between 1 and 200),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.zzws_specification_refresh_jobs (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null,
 provider text not null default 'zigzag' check(provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
 state text not null default 'running' check(state in ('running','completed','cancelled')),
 total integer not null check(total between 1 and 100000),
 processed integer not null default 0 check(processed>=0),
 refreshed integer not null default 0 check(refreshed>=0),
 retained integer not null default 0 check(retained>=0),
 cursor integer not null default 0 check(cursor>=0),
 queue jsonb not null check(jsonb_typeof(queue)='array'),
 errors jsonb not null default '[]'::jsonb check(jsonb_typeof(errors)='array' and jsonb_array_length(errors)<=30),
 lease uuid,
 lease_until timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 check(processed=cursor and processed=refreshed+retained and processed<=total and jsonb_array_length(queue)=total)
);
create unique index if not exists zzws_specification_refresh_one_active on public.zzws_specification_refresh_jobs ((true)) where state='running';
create index if not exists zzws_specification_refresh_created on public.zzws_specification_refresh_jobs(created_at desc);
alter table public.zzws_product_specifications enable row level security;
alter table public.zzws_specification_refresh_jobs enable row level security;
revoke all on public.zzws_product_specifications,public.zzws_specification_refresh_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.zzws_product_specifications,public.zzws_specification_refresh_jobs to service_role;

create or replace function public.zzws_specification_refresh_start(p_owner uuid,p_queue jsonb,p_provider text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare j public.zzws_specification_refresh_jobs;
begin
 perform pg_advisory_xact_lock(hashtext('zzws_specification_refresh'));
 select * into j from public.zzws_specification_refresh_jobs where state='running' limit 1 for update;
 if found then return to_jsonb(j); end if;
 if p_owner is null or p_provider !~ '^[a-z][a-z0-9_-]{0,31}$' or jsonb_typeof(p_queue)<>'array' or jsonb_array_length(p_queue) not between 1 and 100000 then raise exception 'Invalid refresh queue'; end if;
 insert into public.zzws_specification_refresh_jobs(owner,provider,total,queue) values(p_owner,p_provider,jsonb_array_length(p_queue),p_queue) returning * into j;
 return to_jsonb(j);
end $body$;

create or replace function public.zzws_specification_refresh_claim(p_id uuid,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare j public.zzws_specification_refresh_jobs;
begin
 select * into j from public.zzws_specification_refresh_jobs where id=p_id for update;
 if not found then return jsonb_build_object('claimed',false,'job',null); end if;
 if j.state<>'running' or (j.lease is not null and j.lease_until>clock_timestamp()) then return jsonb_build_object('claimed',false,'job',to_jsonb(j)); end if;
 update public.zzws_specification_refresh_jobs set lease=p_lease,lease_until=clock_timestamp()+interval '55 seconds',updated_at=clock_timestamp() where id=p_id returning * into j;
 return jsonb_build_object('claimed',true,'job',to_jsonb(j));
end $body$;

create or replace function public.zzws_specification_refresh_finish(p_id uuid,p_lease uuid,p_count integer,p_updates jsonb,p_errors jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare j public.zzws_specification_refresh_jobs; u jsonb; success integer:=0; inserted integer; combined jsonb;
begin
 select * into j from public.zzws_specification_refresh_jobs where id=p_id for update;
 if not found then return jsonb_build_object('committed',false,'job',null); end if;
 if j.state<>'running' or j.lease is distinct from p_lease or j.lease_until<=clock_timestamp() then return jsonb_build_object('committed',false,'job',to_jsonb(j)); end if;
 if p_count not between 1 and 10 or j.cursor+p_count>j.total or jsonb_typeof(p_updates)<>'array' or jsonb_array_length(p_updates)>p_count or jsonb_typeof(p_errors)<>'array' or jsonb_array_length(p_errors)>p_count then raise exception 'Invalid refresh batch'; end if;
 if (select count(distinct value->>'articul') from jsonb_array_elements(p_updates))<>jsonb_array_length(p_updates) then raise exception 'Duplicate refresh article'; end if;
 for u in select value from jsonb_array_elements(p_updates) loop
  if not exists(select 1 from jsonb_array_elements(j.queue) with ordinality q(value,n) where n>j.cursor and n<=j.cursor+p_count and q.value->>0=u->>'articul' and q.value->>1=u->>'name') or u->>'provider' is distinct from j.provider then raise exception 'Refresh identity mismatch'; end if;
  insert into public.zzws_product_specifications(articul,name,source_url,provider,checked_at,specifications,updated_at)
  values(u->>'articul',u->>'name',u->>'source_url',j.provider,(u->>'checked_at')::timestamptz,u->'specifications',clock_timestamp())
  on conflict(articul) do update set source_url=excluded.source_url,provider=excluded.provider,checked_at=excluded.checked_at,specifications=excluded.specifications,updated_at=excluded.updated_at
  where zzws_product_specifications.name=excluded.name and zzws_product_specifications.checked_at<=excluded.checked_at;
  get diagnostics inserted=row_count;
  success:=success+inserted;
 end loop;
 select coalesce(jsonb_agg(value order by n),'[]'::jsonb) into combined from jsonb_array_elements(j.errors||p_errors) with ordinality e(value,n) where n>greatest(0,jsonb_array_length(j.errors||p_errors)-30);
 update public.zzws_specification_refresh_jobs set cursor=cursor+p_count,processed=processed+p_count,refreshed=refreshed+success,retained=retained+p_count-success,errors=combined,
  state=case when cursor+p_count=total then 'completed' else 'running' end,finished_at=case when cursor+p_count=total then clock_timestamp() else null end,
  lease=null,lease_until=null,updated_at=clock_timestamp()
 where id=p_id returning * into j;
 return jsonb_build_object('committed',true,'job',to_jsonb(j));
end $body$;

create or replace function public.zzws_specification_refresh_cancel(p_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $body$
declare j public.zzws_specification_refresh_jobs;
begin
 select * into j from public.zzws_specification_refresh_jobs where id=p_id for update;
 if not found then return null; end if;
 if j.state='running' then update public.zzws_specification_refresh_jobs set state='cancelled',lease=null,lease_until=null,finished_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id returning * into j; end if;
 return to_jsonb(j);
end $body$;

revoke all on function public.zzws_specification_refresh_start(uuid,jsonb,text),public.zzws_specification_refresh_claim(uuid,uuid),public.zzws_specification_refresh_finish(uuid,uuid,integer,jsonb,jsonb),public.zzws_specification_refresh_cancel(uuid) from public,anon,authenticated;
grant execute on function public.zzws_specification_refresh_start(uuid,jsonb,text),public.zzws_specification_refresh_claim(uuid,uuid),public.zzws_specification_refresh_finish(uuid,uuid,integer,jsonb,jsonb),public.zzws_specification_refresh_cancel(uuid) to service_role;
