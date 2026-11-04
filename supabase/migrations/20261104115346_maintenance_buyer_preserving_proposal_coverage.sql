-- Buyer-aware PUB003 activation: preserve published wrapper OIDs, buyer rows and restore behavior.
-- No data cleanup, restore or outbound messages are performed. Requires a verified encrypted49-table backup.
begin;
lock table public.zzws_maintenance_jobs,public.zzws_maintenance_state in share row exclusive mode;
do $release_guard$ begin
 if exists(select 1 from public.zzws_maintenance_jobs where state in ('queued','running','awaiting_confirmation')) or exists(select 1 from public.zzws_maintenance_state where id=true and freeze_job is not null) then raise exception 'Active maintenance operation; retry after completion';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.table_plan(text[],uuid)'::regprocedure))<>'1d23a94787ab84126bed23036182481a' then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.table_plan(text[],uuid)';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.allowed_tables()'::regprocedure))<>'2b683dca75401e7e0eb60f08353b7bfd' then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.allowed_tables()';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb)'::regprocedure))<>'0014fe4a0a400438d84be3310d7c8de9' and not exists(select 1 from pg_proc p where p.oid='zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb)'::regprocedure and md5(p.prosrc)=any(array['9aee53e87798bc966eee13824377b61b','4609d23157d04b24d889cd15e4488519']) and p.prosecdef=true and p.proconfig @> array['search_path=""','statement_timeout=60s']) then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb)';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb)'::regprocedure))<>'165c29c365c7a5831f6eb643ffe6ae68' and not exists(select 1 from pg_proc p where p.oid='zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb)'::regprocedure and md5(p.prosrc)=any(array['458a1bf9d6aa8c3e1982bbeaeda55499','79bb3e6c4dd02ebb758fa8ec575540a6']) and p.prosecdef=true and p.proconfig @> array['search_path=""','statement_timeout=60s']) then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb)';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.allowed_tables_before_buyer_offers()'::regprocedure))<>'0e7f11be8f0db279c34db28213a135d3' and not exists(select 1 from pg_proc p where p.oid='zzws_maintenance_private.allowed_tables_before_buyer_offers()'::regprocedure and md5(p.prosrc)=any(array['6a16923ae09909a64f27fb446703276a']) and p.prosecdef=false and p.proconfig @> array['search_path=""']) then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.allowed_tables_before_buyer_offers()';end if;
 if md5(pg_get_functiondef('zzws_maintenance_private.table_plan_before_buyer_offers(text[],uuid)'::regprocedure))<>'bda95a5e2cf4e8cb6446ddce5bcd0c0b' and not exists(select 1 from pg_proc p where p.oid='zzws_maintenance_private.table_plan_before_buyer_offers(text[],uuid)'::regprocedure and md5(p.prosrc)=any(array['9a3123253f2e717dee26b92e12dac988']) and p.prosecdef=false and p.proconfig @> array['search_path=""']) then raise exception 'Buyer-aware maintenance routine changed: zzws_maintenance_private.table_plan_before_buyer_offers(text[],uuid)';end if;
 if md5(pg_get_functiondef('zzws_application_snapshot_before_buyer_offers()'::regprocedure))<>'c7e5e6128ddedf959a2b509109d07a07' then raise exception 'Buyer-aware maintenance routine changed: zzws_application_snapshot_before_buyer_offers()';end if;
 if not exists(select 1 from pg_proc p where p.oid='public.zzws_application_snapshot()'::regprocedure and md5(p.prosrc)='32962949c7f1dc5c8c626d5c8e3ad090' and not p.prosecdef and p.proconfig @> array['search_path=""','statement_timeout=60s']) then raise exception 'Verified flat49 export required before lifecycle activation';end if;
end $release_guard$;

create or replace function zzws_maintenance_private.allowed_tables_before_buyer_offers() returns text[] language sql immutable set search_path='' as $$
 select array['admin_devices','admin_notice_reads','admin_order_reads','admin_scopes','apk_downloads','apk_usage','approval_reminder_snoozes','audit','bulletin_reads','catalog_bulletins','client_receipt_controls','delivery_counterparties','drafts','external_systems','integration_documents','integration_outbox','invitations','mail_transport','mobile_events','mobile_preferences','notification_outbox','notification_recipients','notification_settings','order_activity','order_calculation_contexts','order_events','order_gate','order_integration_resolutions','orders','partner_counterparties','proposal_cart','proposal_reads','proposals','receipt_notices','receipt_settings','report_deliveries','report_email_settings','saved_carts','state','telegram_commands','telegram_parts','user_channels','user_memory','users','versions'];
$$;

create or replace function zzws_maintenance_private.table_plan_before_buyer_offers(p_selected text[],p_protected uuid)
returns table(name text,condition text,rank integer) language plpgsql stable set search_path='' as $$
declare c text[]:=zzws_maintenance_private.category_closure(p_selected);full_clean boolean:='full-reset'=any(p_selected);
 clients text:='select id from public.zzws_users where profile->>''role''=''client''';users_where text;
 global_orders boolean;order_ids text;event_where text;notification_where text;personal_where text;audit_where text;
begin
 global_orders:=full_clean or 'orders'=any(p_selected) or 'catalog'=any(p_selected) or 'settings'=any(p_selected);
 users_where:=case when full_clean then format('t.id<>%L::uuid',p_protected) else 't.profile->>''role''=''client''' end;
 order_ids:=case when 'orders'=any(p_selected) or 'catalog'=any(p_selected) or 'settings'=any(p_selected) or full_clean then 'select id from public.zzws_orders'
  else 'select o.id from public.zzws_orders o where o.user_id in ('||clients||') or o.customer_id in ('||clients||') or o.received_by in ('||clients||') or exists(select 1 from public.zzws_order_events e where e.order_id=o.id and e.user_id in ('||clients||'))' end;
 event_where:=case when full_clean or 'settings'=any(c) then 'true' else
  '('||case when 'orders'=any(c) then 't.order_id in ('||order_ids||') or ('||case when global_orders then 't.kind in (''order.changed'',''order.comment'')' else 'false' end||')' else 'false' end||
  case when 'catalog'=any(c) then ' or t.kind in (''catalog.prices'',''catalog.offers'')' else '' end||')' end;
 notification_where:='t.event_id in (select t.id from public.zzws_mobile_events t where '||event_where||')';
 personal_where:=case when full_clean or 'workspace'=any(p_selected) or 'settings'=any(p_selected) then 'true' else 't.user_id in ('||clients||')' end;
 audit_where:=case when full_clean then 'true' else
  '('||case when global_orders then 't.action like ''order%'' or t.action like ''report_email%'' or ' else '' end||'exists(select 1 from public.zzws_orders o where o.id in ('||order_ids||') and position(o.id::text in t.detail)>0))'||case when 'customers'=any(c) then ' or t.actor in ('||clients||')' else '' end end;
 if 'orders'=any(c) then
  return query values
   ('telegram_parts','t.outbox_id in (select t.id from public.zzws_notification_outbox t where '||notification_where||')',10),
   ('notification_outbox',notification_where,20),('integration_outbox',case when global_orders then 'true' else 't.order_id in ('||order_ids||')' end,20),
   ('integration_documents',case when global_orders then 'true' else 't.order_id in ('||order_ids||')' end,20),('order_integration_resolutions','t.order_id in ('||order_ids||')',20),
   ('report_deliveries','t.order_id in ('||order_ids||')',20),('admin_notice_reads','t.notice_id in (select id from public.zzws_receipt_notices where order_id in ('||order_ids||'))',20),
   ('receipt_notices','t.order_id in ('||order_ids||')',30),('admin_order_reads','t.order_id in ('||order_ids||')',30),
   ('approval_reminder_snoozes','t.order_id in ('||order_ids||')',30),('order_calculation_contexts','t.order_id in ('||order_ids||')',30),
   ('order_events','t.order_id in ('||order_ids||')',30),('mobile_events',event_where,30),
   ('order_activity',case when 'orders'=any(p_selected) or 'catalog'=any(c) or 'settings'=any(c) or full_clean then 'true' else 't.order_id in ('||order_ids||') or t.snapshot->>''user_id'' in (select id::text from public.zzws_users where profile->>''role''=''client'')' end,40),
   ('drafts','t.kind=''order'' and (t.payload->>''orderId'' in (select id::text from public.zzws_orders where id in ('||order_ids||')) or '||case when global_orders then 'true' else 'false' end||')',45),
   ('audit',audit_where,45),('order_gate',case when full_clean or 'orders'=any(p_selected) or 'catalog'=any(c) or 'settings'=any(c) then 'true' else 't.user_id in ('||clients||')' end,45),
   ('orders','t.id in ('||order_ids||')',50),
   ('user_memory',case when global_orders then 'true' else 't.user_id in ('||clients||')' end,55);
 end if;
 -- Frozen proposals are workspace/catalogue data. Customer deletion is added
 -- by the existing reviewed FK descendant closure, including employee grants.
 -- Use explicit categories: the customers closure also contains workspace.
 if full_clean or 'workspace'=any(p_selected) or 'catalog'=any(p_selected) then
  return query values('proposal_cart','true',35),('proposal_reads','true',35),('proposals','true',40);
 end if;
 if 'workspace'=any(c) then
  return query values('saved_carts',personal_where,55),('user_memory',personal_where,55);
 end if;
 if 'catalog'=any(c) then
  return query values('bulletin_reads','true',25),('catalog_bulletins','true',35),('state','true',65),('versions','true',75),
   ('drafts','t.kind=''price''',45);
 end if;
 if 'settings'=any(c) then
  return query values('delivery_counterparties','true',25),('partner_counterparties','true',35),('external_systems','true',60),
   ('notification_recipients','true',55),('notification_settings','true',55),('receipt_settings','true',55),('client_receipt_controls','true',55),
   ('report_email_settings','true',55),('mail_transport','true',55),('mobile_preferences','true',55),('user_channels','true',55),('admin_devices','true',55),('telegram_commands','true',55);
 end if;
 if 'customers'=any(c) then
  return query values('invitations','t.user_id in ('||case when full_clean then 'select id from public.zzws_users where id<>'||quote_literal(p_protected)||'::uuid' else clients end||')',60),
   ('admin_scopes',case when full_clean then format('t.user_id<>%L::uuid',p_protected) else 't.user_id in ('||clients||')' end,60),
   ('apk_usage',case when full_clean then 'true' else 't.user_id in ('||clients||')' end,60),
   ('apk_downloads',case when full_clean then 'true' else 't.user_id in ('||clients||')' end,60),
   ('client_receipt_controls','t.user_id in ('||clients||')',55),('mobile_preferences','t.user_id in ('||clients||')',55),
   ('user_channels','t.user_id in ('||clients||')',55),('admin_devices','t.user_id in ('||clients||')',55),
   ('notification_recipients','t.user_id in ('||clients||')',55),('bulletin_reads','t.user_id in ('||clients||')',25),
   ('delivery_counterparties','t.partner_id in ('||clients||')',25),('partner_counterparties','t.partner_id in ('||clients||')',35),
   ('drafts','t.actor in ('||clients||')',45),('users',users_where,90);
 end if;
end $$;

CREATE OR REPLACE FUNCTION zzws_maintenance_private.restore_payload(p_payload jsonb, p_protected uuid, p_previous jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '60s'
AS $function$
declare
 allowed constant text[]:=array['admin_devices','admin_notice_reads','admin_order_reads','admin_scopes','apk_downloads','apk_usage','approval_reminder_snoozes','audit','auth_challenges','backup_keys','bulletin_reads','catalog_bulletins','client_receipt_controls','delivery_counterparties','drafts','external_systems','integration_documents','integration_outbox','invitations','mail_transport','mobile_events','mobile_preferences','notification_outbox','notification_recipients','notification_settings','order_activity','order_calculation_contexts','order_events','order_gate','order_integration_resolutions','orders','partner_counterparties','receipt_notices','receipt_settings','report_deliveries','report_email_settings','saved_carts','sessions','setup','state','telegram_commands','telegram_parts','user_channels','user_memory','users','versions','buyer_offers','proposal_cart','proposal_reads','proposals'];
 ephemeral constant text[]:=array['sessions','auth_challenges','invitations','setup','backup_keys','drafts'];
 singleton constant text[]:=array['state','receipt_settings','report_email_settings','notification_settings','mail_transport','user_memory','order_gate'];
 pending text[]; name text; ready text; selected_rows jsonb; reference_rows jsonb; merged jsonb;
 source_tables jsonb:=coalesce(p_payload->'tables','{}'); reference_tables jsonb:=coalesce(p_payload->'references'->'tables','{}');
 columns_sql text; values_sql text; update_sql text; pk text[]; join_sql text; json_pk text; row jsonb; column_names text[];
 exists_selected boolean; inserted integer; result jsonb:='{}'; snapshot jsonb; missing uuid[]; credential_ids uuid[];
 seq record; max_value bigint; last_value bigint; memory_row jsonb; previous_row jsonb; versions jsonb; key text; version_value bigint; previous_version bigint;
 trigger_row record; triggers jsonb; trigger_info jsonb; error_table text; error_constraint text;
 partial_history boolean:=p_payload->'sections'->'user_memory'='["history"]'::jsonb;
 global_partial_history boolean; partial_users jsonb:=coalesce(p_payload->'sections'->'user_memoryByUser','{}');
 current_memory jsonb; cleared_versions jsonb; merged_data jsonb;
begin
 perform zzws_maintenance_private.auth_guard('{}'::uuid[],p_protected);
 if p_payload->>'format' is distinct from 'zzws-maintenance-archive-v1' or p_payload->>'schemaVersion' is distinct from '1'
  or jsonb_typeof(source_tables) is distinct from 'object' or jsonb_typeof(reference_tables) is distinct from 'object'
 then raise sqlstate 'PT400' using message='Invalid application recovery archive'; end if;
 partial_history:=coalesce(partial_history,false);
 global_partial_history:=partial_history;
 if p_payload ? 'sections' and (jsonb_typeof(p_payload->'sections') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(p_payload->'sections') k where k not in ('user_memory','user_memoryByUser'))
  or (p_payload->'sections' ? 'user_memory' and not partial_history)
  or jsonb_typeof(partial_users) is distinct from 'object'
  or exists(select 1 from jsonb_each(partial_users) e where e.value is distinct from '["history"]'::jsonb)) then
  raise sqlstate 'PT400' using message='Unknown section recovery policy';
 end if;
 select coalesce(array_agg(k order by k),'{}') into pending from(
  select jsonb_object_keys(source_tables) k union select jsonb_object_keys(reference_tables) k
 ) names;
 if exists(select 1 from unnest(pending) n where not n=any(allowed)) then raise sqlstate 'PT400' using message='Unknown recovery table'; end if;

 snapshot:=p_payload->'auth';
 if snapshot is not null and snapshot<>'null'::jsonb then
  credential_ids:=zzws_maintenance_private.auth_validate(snapshot,p_protected);
  select coalesce(array_agg(ids.candidate_id),'{}') into missing from unnest(credential_ids) ids(candidate_id) where not exists(select 1 from auth.users u where u.id=ids.candidate_id);
  snapshot:=jsonb_set(snapshot,'{userIds}',to_jsonb(missing));
  for name in select jsonb_object_keys(snapshot->'tables') loop
   select coalesce(jsonb_agg(value),'[]') into merged from jsonb_array_elements(snapshot->'tables'->name)
    where (value->>case when name='users' then 'id' else 'user_id' end)::uuid=any(missing);
   snapshot:=jsonb_set(snapshot,array['tables',name],merged);
  end loop;
  perform zzws_maintenance_private.auth_restore(snapshot,p_protected);
 end if;
 pending:=array(select n from unnest(pending) n where not n=any(ephemeral));
 while cardinality(pending)>0 loop
  ready:=null;
  foreach name in array pending loop
   if pg_catalog.to_regclass('public.zzws_'||name) is null then raise sqlstate 'PT409' using message='Recovery schema changed'; end if;
   if not exists(
    select 1 from pg_catalog.pg_constraint c join pg_catalog.pg_class parent on parent.oid=c.confrelid
    join pg_catalog.pg_namespace ns on ns.oid=parent.relnamespace
    where c.contype='f' and c.conrelid=pg_catalog.to_regclass('public.zzws_'||name) and c.confrelid<>c.conrelid
    and ns.nspname='public' and substring(parent.relname from 6)=any(pending)
   ) then ready:=name;exit;end if;
  end loop;
  if ready is null then raise sqlstate 'PT409' using message='Recovery dependency cycle requires review'; end if;
  name:=ready;selected_rows:=coalesce(source_tables->name,'[]');reference_rows:=coalesce(reference_tables->name,'[]');
  if jsonb_typeof(selected_rows) is distinct from 'array' or jsonb_typeof(reference_rows) is distinct from 'array' then raise sqlstate 'PT400' using message='Invalid recovery rows'; end if;
  select array_agg(a.attname order by k.ordinality) into pk from pg_catalog.pg_index i
   cross join unnest(i.indkey) with ordinality k(attnum,ordinality)
   join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
   where i.indrelid=pg_catalog.to_regclass('public.zzws_'||name) and i.indisprimary;
  if cardinality(pk) is null then raise sqlstate 'PT409' using message='Recovery table has no stable key'; end if;
  select array_agg(a.attname order by a.attnum),string_agg(format('%I',a.attname),',' order by a.attnum),string_agg(format('r.%I',a.attname),',' order by a.attnum),string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum)
   into column_names,columns_sql,values_sql,update_sql from pg_catalog.pg_attribute a
   where a.attrelid=pg_catalog.to_regclass('public.zzws_'||name) and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  for row in select value from jsonb_array_elements(selected_rows||reference_rows) loop
   if jsonb_typeof(row) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(row) k where not exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass('public.zzws_'||name) and a.attnum>0 and not a.attisdropped and a.attname=k))
    or exists(select 1 from unnest(pk) k where row->k is null or row->k='null'::jsonb)
   then raise sqlstate 'PT400' using message='Malformed recovery row'; end if;
  end loop;
  if name in ('users','admin_scopes') then
   if exists(select 1 from jsonb_array_elements(selected_rows) r where r->>case when name='users' then 'id' else 'user_id' end=p_protected::text)
   then raise sqlstate 'PT403' using message='Protected owner cannot be replaced'; end if;
   select coalesce(jsonb_agg(value),'[]') into reference_rows from jsonb_array_elements(reference_rows)
    where value->>case when name='users' then 'id' else 'user_id' end is distinct from p_protected::text;
  end if;
  select string_agg(format('t.%1$I is not distinct from r.%1$I',k),' and '),
   'jsonb_build_array('||string_agg(format('value->%L',k),',')||')' into join_sql,json_pk from unnest(pk) k;
  -- Reference copies never participate in an UPDATE, including singleton and
  -- workspace fence tables. Only explicitly selected singleton rows may upsert.
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from jsonb_populate_recordset(null::public.%I,$1) r where not exists(select 1 from public.%I t where %s)','zzws_'||name,'zzws_'||name,join_sql)
   into reference_rows using reference_rows;
  execute format('select exists(select 1 from public.%I t join jsonb_populate_recordset(null::public.%I,$1) r on %s)','zzws_'||name,'zzws_'||name,join_sql)
   into exists_selected using selected_rows;
  if exists_selected and not name=any(singleton) then raise sqlstate 'PT409' using message='Selected recovery scope was not cleared'; end if;
  if exists_selected and name='user_memory' then
   execute format('select exists(select 1 from public.zzws_user_memory t join jsonb_populate_recordset(null::public.zzws_user_memory,$1) r on %s where t.data<>''{}''::jsonb and not($2 or coalesce($3->(t.user_id::text)=''["history"]''::jsonb,false)))',join_sql) into exists_selected using selected_rows,global_partial_history,partial_users;
   if exists_selected then raise sqlstate 'PT409' using message='Workspace recovery scope was not cleared';end if;
  elsif exists_selected and name='order_gate' then
   execute format('select exists(select 1 from public.zzws_order_gate t join jsonb_populate_recordset(null::public.zzws_order_gate,$1) r on %s where t.locked)',join_sql) into exists_selected using selected_rows;
   if exists_selected then raise sqlstate 'PT409' using message='Order recovery gate was not cleared';end if;
  end if;
  -- Selected rows take priority over duplicate reference copies. The order of
  -- records with composite primary keys is deterministic and cannot inject SQL.
  execute format('select coalesce(jsonb_agg(value),''[]''::jsonb) from(select distinct on(%1$s) value from jsonb_array_elements($1) with ordinality x(value,n) order by %1$s,n) unique_rows',json_pk)
   into merged using selected_rows||reference_rows;
  if not name=any(singleton) then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from jsonb_populate_recordset(null::public.%I,$1) r where not exists(select 1 from public.%I t where %s)','zzws_'||name,'zzws_'||name,join_sql)
    into merged using merged;
  end if;
  if name in ('notification_outbox','integration_outbox') then
   select coalesce(jsonb_agg(value||case when value->>'state' in ('pending','pending_mapping','leased','retry') then jsonb_build_object('state','cancelled','lease_token',null,'lease_until',null,'last_error','restored_without_delivery') else '{}'::jsonb end),'[]') into merged from jsonb_array_elements(merged);
  elsif name in ('telegram_commands','telegram_parts') then
   select coalesce(jsonb_agg(value||case when value->>'state' in ('pending','sending','retry') then jsonb_build_object('state','uncertain','lease_token',null,'lease_until',null) else '{}'::jsonb end),'[]') into merged from jsonb_array_elements(merged);
  elsif name='report_deliveries' then
   select coalesce(jsonb_agg(
    delivery.value||jsonb_build_object('lease',null,'lease_until',null)
    ||case when delivery.value->>'state' not in('accepted','completed') or coalesce(recipients.was_sending,false)
      then jsonb_build_object('state','uncertain') else '{}'::jsonb end
    ||case when delivery.value->'counts'->>'deliverySchema'='1' and jsonb_typeof(delivery.value->'counts'->'deliveries')='array'
      then jsonb_build_object('counts',jsonb_set(delivery.value->'counts','{deliveries}',coalesce(recipients.entries,'[]'::jsonb)))
      else '{}'::jsonb end
    order by delivery.ordinal),'[]'::jsonb) into merged
   from jsonb_array_elements(merged) with ordinality delivery(value,ordinal)
   left join lateral (
    select jsonb_agg((entry.value-'lease'-'lease_until')
      ||case when entry.value->>'state'='sending' then jsonb_build_object('state','uncertain','reason','restored_inflight') else '{}'::jsonb end
      order by entry.ordinal) as entries,
     bool_or(entry.value->>'state'='sending') as was_sending
    from jsonb_array_elements(case when delivery.value->'counts'->>'deliverySchema'='1' and jsonb_typeof(delivery.value->'counts'->'deliveries')='array'
     then delivery.value->'counts'->'deliveries' else '[]'::jsonb end) with ordinality entry(value,ordinal)
   ) recipients on true;
  elsif name in ('external_systems','notification_settings') then
   select coalesce(jsonb_agg(value||jsonb_build_object('enabled',false)),'[]') into merged from jsonb_array_elements(merged);
  elsif name='user_memory' then
   snapshot:='[]';
   for memory_row in select value from jsonb_array_elements(merged) loop
    partial_history:=global_partial_history or coalesce(partial_users->(memory_row->>'user_id')='["history"]'::jsonb,false);
    select to_jsonb(t) into current_memory from public.zzws_user_memory t where t.user_id=(memory_row->>'user_id')::uuid;
    select value into previous_row from jsonb_array_elements(coalesce(p_previous->'tables'->'user_memory','[]')) where value->>'user_id'=memory_row->>'user_id';
    versions:=case when partial_history then coalesce(current_memory->'versions','{}') else '{}'::jsonb end;
    cleared_versions:=case when partial_history then coalesce(current_memory->'cleared','{}') else '{}'::jsonb end;
    for key in select k from(
     select jsonb_object_keys(coalesce(memory_row->'versions','{}')||coalesce(previous_row->'versions','{}')||coalesce(memory_row->'cleared','{}')||coalesce(previous_row->'cleared','{}')||coalesce(current_memory->'versions','{}')||coalesce(current_memory->'cleared','{}')) k
     union select unnest(array['cart','favorites','history','filters','preferences','draft'])
    ) sections where not partial_history or k='history' loop
     version_value:=coalesce((memory_row->'versions'->>key)::bigint,0);previous_version:=coalesce((previous_row->'versions'->>key)::bigint,0);
     version_value:=greatest(version_value,previous_version,coalesce((memory_row->'cleared'->>key)::bigint,0),coalesce((previous_row->'cleared'->>key)::bigint,0),coalesce((current_memory->'versions'->>key)::bigint,0),coalesce((current_memory->'cleared'->>key)::bigint,0))+1;
     versions:=versions||jsonb_build_object(key,version_value);cleared_versions:=cleared_versions||jsonb_build_object(key,version_value);
    end loop;
    if partial_history then
     merged_data:=coalesce(current_memory->'data','{}')-'history';
     if memory_row->'data' ? 'history' then merged_data:=merged_data||jsonb_build_object('history',memory_row->'data'->'history');end if;
     memory_row:=coalesce(current_memory,memory_row)||jsonb_build_object('data',merged_data);
    end if;
    memory_row:=memory_row||jsonb_build_object('versions',versions);
    if exists(select 1 from pg_catalog.pg_attribute a where a.attrelid='public.zzws_user_memory'::regclass and a.attname='cleared' and not a.attisdropped) then
     memory_row:=memory_row||jsonb_build_object('cleared',cleared_versions);
    end if;
    snapshot:=snapshot||jsonb_build_array(memory_row);
   end loop;
   merged:=snapshot;
  end if;
  -- Suppress only this table's user triggers during historical row import.
  -- FK constraint triggers remain active; original O/R/A/D modes are preserved.
  -- ALTER TABLE locks and all mode changes roll back with this transaction.
  triggers:='[]';
  for trigger_row in select t.tgname,t.tgenabled from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass('public.zzws_'||name) and not t.tgisinternal and t.tgenabled<>'D' order by t.tgname loop
   triggers:=triggers||jsonb_build_array(jsonb_build_object('name',trigger_row.tgname,'mode',trigger_row.tgenabled));
   execute format('alter table public.%I disable trigger %I','zzws_'||name,trigger_row.tgname);
  end loop;
  execute format('insert into public.%I(%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1) r%s','zzws_'||name,columns_sql,values_sql,'zzws_'||name,
   case when name=any(singleton) then format(' on conflict(%s) do update set %s',(select string_agg(format('%I',k),',') from unnest(pk) k),update_sql) else '' end) using merged;
  get diagnostics inserted=row_count;result:=result||jsonb_build_object(name,inserted);
  for trigger_info in select value from jsonb_array_elements(triggers) loop
   execute format('alter table public.%I enable %strigger %I','zzws_'||name,case trigger_info->>'mode' when 'R' then 'replica ' when 'A' then 'always ' else '' end,trigger_info->>'name');
  end loop;
  pending:=array_remove(pending,name);
 end loop;
 if source_tables ? 'state' then
  update public.zzws_state set rules_revision=gen_random_uuid(),catalog_controls_revision=gen_random_uuid() where id=true;
 end if;
 -- Advance generated identities; never re-use an order number already sent to
 -- a customer or another system, even when restoring an older archive.
 for seq in select ns.nspname as schema_name,s.relname as sequence_name,t.relname as table_name,a.attname as column_name
  from pg_catalog.pg_class s join pg_catalog.pg_namespace ns on ns.oid=s.relnamespace
  join pg_catalog.pg_depend d on d.objid=s.oid and d.classid='pg_class'::regclass and d.deptype in ('a','i')
  join pg_catalog.pg_class t on t.oid=d.refobjid join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum=d.refobjsubid
  where s.relkind='S' and ns.nspname='public' and substring(t.relname from 6)=any(allowed)
 loop
  if not (source_tables ? substring(seq.table_name from 6)) then continue;end if;
  execute format('select max(%I)::bigint from public.%I',seq.column_name,seq.table_name) into max_value;
  execute format('select last_value from %I.%I',seq.schema_name,seq.sequence_name) into last_value;
  if max_value is not null then perform pg_catalog.setval(format('%I.%I',seq.schema_name,seq.sequence_name)::regclass,greatest(max_value,last_value),true);end if;
 end loop;
 return jsonb_build_object('restored',result,'sessionsRevived',false,'outboundReplayed',false);
exception when foreign_key_violation or unique_violation then
 get stacked diagnostics error_table=TABLE_NAME,error_constraint=CONSTRAINT_NAME;
 raise sqlstate 'PT409' using message='Recovery references conflict with the current database',detail=coalesce(error_table,'')||'.'||coalesce(error_constraint,'');
end $function$
;

CREATE OR REPLACE FUNCTION zzws_maintenance_private.restore_preview(p_payload jsonb, p_protected uuid, p_current jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '60s'
AS $function$
declare
 allowed constant text[]:=array['admin_devices','admin_notice_reads','admin_order_reads','admin_scopes','apk_downloads','apk_usage','approval_reminder_snoozes','audit','auth_challenges','backup_keys','bulletin_reads','catalog_bulletins','client_receipt_controls','delivery_counterparties','drafts','external_systems','integration_documents','integration_outbox','invitations','mail_transport','mobile_events','mobile_preferences','notification_outbox','notification_recipients','notification_settings','order_activity','order_calculation_contexts','order_events','order_gate','order_integration_resolutions','orders','partner_counterparties','receipt_notices','receipt_settings','report_deliveries','report_email_settings','saved_carts','sessions','setup','state','telegram_commands','telegram_parts','user_channels','user_memory','users','versions','buyer_offers','proposal_cart','proposal_reads','proposals'];
 retained constant text[]:=array['state','receipt_settings','report_email_settings','notification_settings','mail_transport','user_memory'];
 tables jsonb:=coalesce(p_payload->'tables','{}');refs jsonb:=coalesce(p_payload->'references'->'tables','{}');
 missing jsonb:='[]';present jsonb:='[]';selected jsonb:='[]';blocked jsonb:='[]';name text;source_rows jsonb;pk text[];pkdef text;join_current text;join_selected text;join_cleared text;will_clear text;n bigint;total bigint;
 auth_ids uuid[]:='{}';clear_auth uuid[]:='{}';auth_missing bigint:=0;auth_restore bigint:=0;current_auth record;archived_profile jsonb;profile_id uuid;selected_users jsonb:=coalesce(p_current->'tables'->'users','[]');
begin
 perform zzws_maintenance_private.auth_guard('{}'::uuid[],p_protected);
 if p_payload->>'format' is distinct from 'zzws-maintenance-archive-v1' or p_payload->>'schemaVersion' is distinct from '1'
  or jsonb_typeof(tables) is distinct from 'object' or jsonb_typeof(refs) is distinct from 'object'
 then raise sqlstate 'PT400' using message='Invalid recovery preview';end if;
 if exists(select 1 from jsonb_object_keys(tables||refs) k where not k=any(allowed)) then raise sqlstate 'PT400' using message='Unknown recovery table';end if;
 for name in select k from jsonb_object_keys(tables) k order by k loop
  if jsonb_typeof(tables->name) is distinct from 'array' then raise sqlstate 'PT400';end if;
  selected:=selected||jsonb_build_array(jsonb_build_object('id',name,'count',jsonb_array_length(tables->name)));
 end loop;
 for name in select k from jsonb_object_keys(refs) k order by k loop
  if jsonb_typeof(refs->name) is distinct from 'array' or to_regclass('public.zzws_'||name) is null then raise sqlstate 'PT409';end if;
  select array_agg(a.attname order by k.ordinality),string_agg(format('%I %s',a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod)),',' order by k.ordinality),
   string_agg(format('t.%1$I is not distinct from r.%1$I',a.attname),' and ' order by k.ordinality),
   string_agg(format('s.%1$I is not distinct from r.%1$I',a.attname),' and ' order by k.ordinality),
   string_agg(format('c.%1$I is not distinct from r.%1$I',a.attname),' and ' order by k.ordinality)
   into pk,pkdef,join_current,join_selected,join_cleared
  from pg_catalog.pg_index i cross join unnest(i.indkey) with ordinality k(attnum,ordinality)
   join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=to_regclass('public.zzws_'||name) and i.indisprimary;
  if cardinality(pk) is null then raise sqlstate 'PT409';end if;
  will_clear:=case when name=any(retained) then 'false' else format('exists(select 1 from jsonb_to_recordset($3) c(%s) where %s)',pkdef,join_cleared) end;
  execute format('select count(*) filter(where not exists(select 1 from public.%1$I t where %2$s) or %3$s),count(*) from jsonb_to_recordset($1) r(%4$s) where not exists(select 1 from jsonb_to_recordset($2) s(%4$s) where %5$s)',
   'zzws_'||name,join_current,will_clear,pkdef,join_selected)
   into n,total using refs->name,coalesce(tables->name,'[]'),coalesce(p_current->'tables'->name,'[]');
  missing:=missing||jsonb_build_array(jsonb_build_object('id',name,'count',n));present:=present||jsonb_build_array(jsonb_build_object('id',name,'count',total-n));
 end loop;
 if p_payload->'auth' is not null and p_payload->'auth'<>'null'::jsonb then
  auth_ids:=zzws_maintenance_private.auth_validate(p_payload->'auth',p_protected);
 end if;
 select coalesce(array_agg(value::uuid),'{}') into clear_auth from jsonb_array_elements_text(coalesce(p_current->'selectedAuth'->'userIds','[]'));
 select count(*) filter(where not exists(select 1 from auth.users u where u.id=ids.uid)),count(*) filter(where not exists(select 1 from auth.users u where u.id=ids.uid) or ids.uid=any(clear_auth))
  into auth_missing,auth_restore from unnest(auth_ids) ids(uid);
 -- Public logins and their managed Auth identities must remain consistent.
 -- Existing unselected parents are never updated by restore.
 for archived_profile in select distinct on(value->>'id') value from jsonb_array_elements(coalesce(tables->'users','[]')||coalesce(refs->'users','[]')) where value->>'id'<>p_protected::text order by value->>'id' loop
  profile_id:=(archived_profile->>'id')::uuid;
  if exists(select 1 from public.zzws_users u where u.id=profile_id)
    and not exists(select 1 from jsonb_array_elements(selected_users) s where s->>'id'=profile_id::text) then continue;end if;
  if exists(select 1 from public.zzws_users u where u.id<>profile_id and u.login=archived_profile->>'login' and not exists(select 1 from jsonb_array_elements(selected_users) s where s->>'id'=u.id::text)) then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('code','reference_login_conflict','id','users','count',1));
  end if;
  select u.id,u.email into current_auth from auth.users u where u.id=profile_id and not u.id=any(clear_auth);
  if found then
   if current_auth.email is distinct from (archived_profile->>'login')||'@users.zzws.invalid' then blocked:=blocked||jsonb_build_array(jsonb_build_object('code','credential_identity_mismatch','id','users','count',1));end if;
  elsif not profile_id=any(auth_ids) then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('code','credential_archive_missing','id','users','count',1));
  end if;
 end loop;
 for current_auth in select value as data from jsonb_array_elements(coalesce(p_payload->'auth'->'tables'->'users','[]')) a(value) loop
  if exists(select 1 from auth.users u where u.id=(current_auth.data->>'id')::uuid) and not ((current_auth.data->>'id')::uuid=any(clear_auth)) then continue;end if;
  if exists(select 1 from auth.users u where u.id<>(current_auth.data->>'id')::uuid and not u.id=any(clear_auth) and nullif(u.email,'')=nullif(current_auth.data->>'email','')) then
   blocked:=blocked||jsonb_build_array(jsonb_build_object('code','credential_email_conflict','id','users','count',1));
  end if;
 end loop;
 return jsonb_build_object('missingReferences',missing,'existingReferences',present,'authMissingCount',auth_missing,'authRestoreCount',auth_restore,'selectedCounts',selected,'blockers',blocked);
end $function$
;

do $guard$ declare name text;existing oid;begin
 foreach name in array array['proposals','proposal_cart','proposal_reads'] loop
  select t.tgfoid into existing from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass('public.zzws_'||name) and t.tgname='zzws_maintenance_write_guard';
  if found then
   if existing<>'public.zzws_maintenance_write_guard()'::regprocedure then raise exception 'Unexpected proposal maintenance trigger; review required';end if;
  else
   execute format('create trigger zzws_maintenance_write_guard before insert or update or delete on public.%I for each row execute function public.zzws_maintenance_write_guard()','zzws_'||name);
  end if;
 end loop;
end $guard$;
revoke all on function zzws_maintenance_private.allowed_tables_before_buyer_offers(),zzws_maintenance_private.table_plan_before_buyer_offers(text[],uuid),zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb),zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
