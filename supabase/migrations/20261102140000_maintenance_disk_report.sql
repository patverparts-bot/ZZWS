begin;
do $patch$ declare ddl text;marker text:='  perform zzws_maintenance_private.clear_payload(a.payload,job.id,protected);';begin
 ddl:=pg_get_functiondef('public.zzws_maintenance_step(uuid,text,uuid)'::regprocedure);
 if position(marker in ddl)=0 then raise exception 'Maintenance step changed; review measurement placement';end if;
 execute replace(ddl,marker,'  if job.kind=''clear'' then update public.zzws_maintenance_jobs set plan=jsonb_set(plan,''{diskUsage}'',jsonb_build_object(''databaseBefore'',pg_database_size(current_database()),''startedAt'',clock_timestamp())) where id=job.id returning * into job;end if;'||chr(10)||marker);
 ddl:=pg_get_functiondef('zzws_maintenance_private.job_dto(public.zzws_maintenance_jobs)'::regprocedure);
 if position('''result'',case' in ddl)=0 then raise exception 'Job DTO changed';end if;
 execute replace(ddl,'''result'',case','''diskUsage'',p_job.plan->''diskUsage'',''result'',case');
end $patch$;
create function public.zzws_maintenance_disk_report(p_actor uuid,p_hash text,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;before_bytes bigint;after_bytes bigint;begin
 select * into job from public.zzws_maintenance_jobs where id=p_job and actor_id=p_actor for update;
 if not found then raise sqlstate 'PT404';end if;
 if job.kind='clear' and job.state='completed' and job.plan->'diskUsage'?'databaseBefore' and not(job.plan->'diskUsage'?'databaseAfter') then
  before_bytes:=(job.plan->'diskUsage'->>'databaseBefore')::bigint;after_bytes:=pg_database_size(current_database());
  update public.zzws_maintenance_jobs set plan=jsonb_set(plan,'{diskUsage}',(plan->'diskUsage')||jsonb_build_object('databaseAfter',after_bytes,'freedBytes',greatest(0,before_bytes-after_bytes),'growthBytes',greatest(0,after_bytes-before_bytes),'measuredAt',clock_timestamp())) where id=job.id returning * into job;
 end if;
 return zzws_maintenance_private.job_dto(job);
end $$;
revoke all on function public.zzws_maintenance_disk_report(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.zzws_maintenance_disk_report(uuid,text,uuid) to service_role;
commit;
