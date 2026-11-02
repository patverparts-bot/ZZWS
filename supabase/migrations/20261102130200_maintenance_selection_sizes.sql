begin;
-- UTF-8 size of selected records, excluding unrelated reference snapshots.
-- This does not promise immediate physical disk reclamation by PostgreSQL.
create function zzws_maintenance_private.data_bytes(p_payload jsonb) returns bigint
language sql immutable set search_path='' as $$
 select coalesce(sum(octet_length(convert_to(record_value::text,'UTF8'))),0)::bigint from (
  select r.value as record_value from jsonb_each(coalesce(p_payload->'tables','{}'::jsonb)) t cross join lateral jsonb_array_elements(t.value) r
  union all select r.value from jsonb_each(coalesce(p_payload->'selectedAuth'->'tables','{}'::jsonb)) t cross join lateral jsonb_array_elements(t.value) r
  union all select value from jsonb_array_elements(coalesce(p_payload->'vault'->'entries','[]'::jsonb))
 ) records;
$$;
create function zzws_maintenance_private.category_sizes(p_selected text[],p_protected uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare category text;result jsonb:='{}';begin
 perform zzws_maintenance_private.category_closure(p_selected);
 foreach category in array p_selected loop
  result:=result||jsonb_build_object(category,zzws_maintenance_private.data_bytes(zzws_maintenance_private.collect(array[category],p_protected)));
 end loop;
 return result;
end $$;
create or replace function zzws_maintenance_private.counts(p_payload jsonb) returns jsonb language sql immutable set search_path='' as $$select jsonb_build_object('tables',coalesce((select jsonb_agg(jsonb_build_object('id',key,'label',key,'count',jsonb_array_length(value)) order by key) from jsonb_each(p_payload->'tables')),'[]'::jsonb),
 'orderStatuses',coalesce((select jsonb_object_agg(status,n) from (select value->>'status' as status,count(*) as n from jsonb_array_elements(coalesce(p_payload->'tables'->'orders','[]'::jsonb)) group by value->>'status') q),'{}'::jsonb),
 'totalRows',coalesce((select sum(jsonb_array_length(value)) from jsonb_each(p_payload->'tables')),0),
 'credentials',jsonb_build_object('authUsers',jsonb_array_length(coalesce(p_payload->'selectedAuth'->'userIds','[]'::jsonb)),'mailSecrets',jsonb_array_length(coalesce(p_payload->'vault'->'entries','[]'::jsonb)),'referenceAuthUsers',jsonb_array_length(coalesce(p_payload->'auth'->'userIds','[]'::jsonb))),
 'userMemory',(select jsonb_build_object('historyOnlyRows',count(*) filter(where coalesce(p_payload->'sections'->'user_memory'='["history"]'::jsonb,false) or coalesce(p_payload->'sections'->'user_memoryByUser'->(row.value->>'user_id')='["history"]'::jsonb,false)),'workspaceRows',count(*) filter(where not(coalesce(p_payload->'sections'->'user_memory'='["history"]'::jsonb,false) or coalesce(p_payload->'sections'->'user_memoryByUser'->(row.value->>'user_id')='["history"]'::jsonb,false)))) from jsonb_array_elements(coalesce(p_payload->'tables'->'user_memory','[]'::jsonb)) row),
 'references',coalesce((select jsonb_agg(jsonb_build_object('id',key,'count',jsonb_array_length(value)) order by key) from jsonb_each(p_payload->'references'->'tables')),'[]'::jsonb)) ||jsonb_build_object('dataBytes',zzws_maintenance_private.data_bytes(p_payload),'sizeBasis','json-utf8-selected-records');
$$;

-- Preserve the existing password, session, lock and fingerprint checks verbatim.
do $guard$ declare ddl text;marker text:='''counts'',plan->''counts'',''restoreCounts''';begin
 ddl:=pg_get_functiondef('public.zzws_maintenance_preview(uuid,text,text,text[],uuid)'::regprocedure);
 if position(marker in ddl)=0 or position('categorySizes' in ddl)>0 then raise exception 'Maintenance preview changed; review before adding sizes';end if;
 execute replace(ddl,marker,'''counts'',plan->''counts'',''categorySizes'',zzws_maintenance_private.category_sizes(selected,protected),''restoreCounts''');
end $guard$;
revoke all on function zzws_maintenance_private.data_bytes(jsonb) from public,anon,authenticated,service_role;
revoke all on function zzws_maintenance_private.category_sizes(text[],uuid) from public,anon,authenticated,service_role;
commit;
