-- Owner-only, durable backup-before-clear. No cleanup is executed by this migration.
begin;
create table public.zzws_maintenance_state(
 id boolean primary key default true check(id),protected_owner uuid references public.zzws_users(id),
 orders_generation bigint not null default 1 check(orders_generation>0),workspace_generation bigint not null default 1 check(workspace_generation>0),freeze_job uuid,
 created timestamptz not null default clock_timestamp()
);
insert into public.zzws_maintenance_state(id,protected_owner)
 select true,case when count(*)=1 then min(u.id::text)::uuid end
 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id
 where u.active and u.profile->>'role'='admin' and s.scope='owner';
create table public.zzws_maintenance_unlocks(
 token_hash text primary key,actor_id uuid not null,session_hash text not null,expires timestamptz not null,
 created timestamptz not null default clock_timestamp()
);
create table public.zzws_maintenance_jobs(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null,session_hash text not null,request_id uuid,
 kind text not null default 'clear' check(kind in('clear','restore')),source_archive_id uuid,
 selected jsonb not null,plan jsonb not null default '{}',fingerprint text not null,
 state text not null default 'preview' check(state in('preview','queued','running','awaiting_confirmation','completed','failed','cancelled')),
 phase text not null default 'preview',completed_steps integer not null default 0,total_steps integer not null default 4,
 archive_id uuid,archive_sha text,archive_downloaded_at timestamptz,final_confirmed_at timestamptz,
 last_error jsonb,created timestamptz not null default clock_timestamp(),updated timestamptz not null default clock_timestamp(),
 expires timestamptz not null default clock_timestamp()+interval '15 minutes',unique(actor_id,request_id)
);
create unique index zzws_maintenance_one_active on public.zzws_maintenance_jobs((true)) where state in('queued','running','awaiting_confirmation');
create table public.zzws_maintenance_archives(
 id uuid primary key default gen_random_uuid(),job_id uuid not null,actor_id uuid not null,kind text not null,
 scope jsonb not null,manifest jsonb not null,payload jsonb not null,sha256 text not null,download_bytes bigint not null,
 verified_at timestamptz,created timestamptz not null default clock_timestamp()
);
create table public.zzws_maintenance_auth_mutations(
 id uuid primary key,actor_id uuid not null,session_hash text not null,state text not null default 'active' check(state in('active','uncertain')),
 created timestamptz not null default clock_timestamp(),updated timestamptz not null default clock_timestamp()
);
create table public.zzws_maintenance_order_tombstones(
 user_id uuid not null,request_id uuid not null,order_id uuid not null,job_id uuid not null,
 created timestamptz not null default clock_timestamp(),primary key(user_id,request_id)
);
do $$declare name text;begin
 foreach name in array array['maintenance_state','maintenance_unlocks','maintenance_jobs','maintenance_archives','maintenance_order_tombstones','maintenance_auth_mutations'] loop
  execute format('alter table public.%I enable row level security','zzws_'||name);
  execute format('revoke all on public.%I from public,anon,authenticated','zzws_'||name);
  execute format('grant all on public.%I to service_role','zzws_'||name);
  execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)','zzws_'||name);
 end loop;
end $$;
create function zzws_maintenance_private.table_plan(p_selected text[],p_protected uuid)
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

create function zzws_maintenance_private.rows(p_name text,p_where text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ordering text;result jsonb;begin
 if p_name !~ '^[a-z_]+$' or to_regclass('public.zzws_'||p_name) is null then raise sqlstate 'PT400' using message='Unsupported archive table';end if;
 select string_agg(format('t.%I',a.attname),',' order by k.ordinality) into ordering
 from pg_catalog.pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,ordinality)
 join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
 where i.indrelid=to_regclass('public.zzws_'||p_name) and i.indisprimary;
 if ordering is null then raise sqlstate 'PT409' using message='Archive table has no reviewed primary key';end if;
 execute format('select coalesce(json_agg(row_to_json(t) order by %s),''[]''::json)::jsonb from public.%I t where %s',ordering,'zzws_'||p_name,p_where) into result;
 return result;
end $$;

create function zzws_maintenance_private.collect(p_selected text[],p_protected uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare tables jsonb;refs jsonb;auth_ids uuid[];selected_auth uuid[];auth jsonb;selected_credentials jsonb;result jsonb;memory jsonb;partial jsonb;sections jsonb:='{}';begin
 if exists(select 1 from pg_catalog.pg_constraint f join pg_catalog.pg_class child on child.oid=f.conrelid join pg_catalog.pg_class parent on parent.oid=f.confrelid
  where f.contype='f' and child.relnamespace='public'::regnamespace and parent.relnamespace='public'::regnamespace
  and ((substr(parent.relname,6)=any(zzws_maintenance_private.allowed_tables()) and not(substr(child.relname,6)=any(zzws_maintenance_private.allowed_tables())) and child.relname not like 'zzws_maintenance_%' and child.relname not in('zzws_sessions','zzws_auth_challenges'))
   or (substr(child.relname,6)=any(zzws_maintenance_private.allowed_tables()) and not(substr(parent.relname,6)=any(zzws_maintenance_private.allowed_tables())) and parent.relname not like 'zzws_maintenance_%')))
 then raise sqlstate 'PT409' using message='Unreviewed schema dependency; update the maintenance policy before cleanup';end if;
 if exists(select 1 from pg_catalog.pg_constraint f join pg_catalog.pg_class child on child.oid=f.conrelid join pg_catalog.pg_class parent on parent.oid=f.confrelid join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace
  where f.contype='f' and child.relnamespace='public'::regnamespace and ((pn.nspname='auth' and parent.relname='users' and child.relname<>'zzws_users') or(pn.nspname='vault' and parent.relname='secrets' and child.relname<>'zzws_mail_transport')))
 then raise sqlstate 'PT409' using message='Unreviewed Auth/Vault dependency; update maintenance policy before cleanup';end if;
 select coalesce(jsonb_object_agg(q.name,zzws_maintenance_private.rows(q.name,q.condition)),'{}'::jsonb) into tables
 from (select name,string_agg('('||condition||')',' or ') as condition from zzws_maintenance_private.table_plan(p_selected,p_protected) group by name) q;
 tables:=zzws_maintenance_private.descendants(tables,p_protected);
 if tables?'user_memory' then
  with scoped as(select u.id,coalesce(to_jsonb(m),jsonb_build_object('user_id',u.id,'data','{}'::jsonb,'versions','{}'::jsonb,'cleared','{}'::jsonb)) as row,
   ('workspace'=any(p_selected) or 'full-reset'=any(p_selected) or 'customers'=any(p_selected) and u.profile->>'role'='client') as whole
   from public.zzws_users u left join public.zzws_user_memory m on m.user_id=u.id
   where 'orders'=any(p_selected) or 'catalog'=any(p_selected) or 'settings'=any(p_selected) or 'workspace'=any(p_selected) or 'full-reset'=any(p_selected)
   or 'customers'=any(p_selected) and u.profile->>'role'='client'
   or u.id in(select (value->>'user_id')::uuid from jsonb_array_elements(tables->'user_memory')))
  select coalesce(jsonb_agg(case when whole then row else jsonb_build_object('user_id',id,'data',case when row->'data'?'history' then jsonb_build_object('history',row->'data'->'history') else '{}'::jsonb end,'versions',jsonb_build_object('history',coalesce(row->'versions'->'history','0'::jsonb)),'cleared',jsonb_build_object('history',coalesce(row->'cleared'->'history','0'::jsonb))) end order by id),'[]'::jsonb),
   coalesce(jsonb_object_agg(id::text,'["history"]'::jsonb) filter(where not whole),'{}'::jsonb) into memory,partial from scoped;
  tables:=jsonb_set(tables,'{user_memory}',memory);
  if (select count(*) from jsonb_object_keys(partial))=jsonb_array_length(memory) then sections:=jsonb_build_object('user_memory','["history"]'::jsonb);elsif partial<>'{}'::jsonb then sections:=jsonb_build_object('user_memoryByUser',partial);end if;
 end if;
 refs:=jsonb_build_object('users',zzws_maintenance_private.rows('users','true'),'versions',case when tables?'versions' then '[]'::jsonb else zzws_maintenance_private.rows('versions','true') end,'external_systems',case when tables?'external_systems' then '[]'::jsonb else zzws_maintenance_private.rows('external_systems','true') end);
 refs:=zzws_maintenance_private.ancestors(tables,refs);
 select coalesce(array_agg(distinct (u->>'id')::uuid) filter(where (u->>'id')::uuid<>p_protected),array[]::uuid[]) into auth_ids from jsonb_array_elements(refs->'users') u;
 select coalesce(array_agg((u->>'id')::uuid) filter(where (u->>'id')::uuid<>p_protected),array[]::uuid[]) into selected_auth from jsonb_array_elements(coalesce(tables->'users','[]'::jsonb)) u;
 if 'full-reset'=any(p_selected) then select coalesce(array_agg(id) filter(where id<>p_protected),array[]::uuid[]) into selected_auth from auth.users;auth_ids:=selected_auth;end if;
 auth:=zzws_maintenance_private.auth_snapshot(auth_ids,p_protected);
 selected_credentials:=zzws_maintenance_private.auth_snapshot(selected_auth,p_protected);
 result:=jsonb_build_object('format','zzws-maintenance-archive-v1','schemaVersion',1,'scope',to_jsonb(p_selected),'protectedOwner',p_protected,
  'tables',tables,'sections',sections,'references',jsonb_build_object('tables',refs),'auth',auth,'selectedAuth',selected_credentials,'vault',zzws_maintenance_private.vault_snapshot(tables),
  'restorePolicy',jsonb_build_object('reviveSessions',false,'replayDeliveries',false,'resetSequences',false));
 return result;
end $$;

create function zzws_maintenance_private.fingerprint(p_payload jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object('scope',p_payload->'scope','tables',p_payload->'tables','selectedAuth',p_payload->'selectedAuth','vault',p_payload->'vault')::text,'UTF8')),'hex');
$$;

create function public.zzws_maintenance_assert_owner(p_actor uuid,p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare protected uuid;owners integer;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id
  join public.zzws_sessions s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin'
  and a.scope='owner' and u.deleted_at is null and u.archived_at is null and not u.needs_password_setup
  and s.hash=p_hash and s.expires>clock_timestamp() and not s.setup_only)
 then raise sqlstate 'PT403' using message='Protected owner session required';end if;
 select protected_owner into protected from public.zzws_maintenance_state where id=true;
 if protected is null then
  perform 1 from public.zzws_maintenance_state where id=true for update;
  select protected_owner into protected from public.zzws_maintenance_state where id=true;
  if protected is not null then if protected is distinct from p_actor then raise sqlstate 'PT403';end if;return protected;end if;
  select count(*),min(u.id::text)::uuid into owners,protected from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.active and u.profile->>'role'='admin' and a.scope='owner';
  if owners<>1 then raise sqlstate 'PT409' using message='Main owner identity is ambiguous';end if;
  update public.zzws_maintenance_state set protected_owner=protected where id=true and protected_owner is null;
 end if;
 if protected is distinct from p_actor then raise sqlstate 'PT403' using message='Only the protected main owner may maintain data';end if;
 return protected;
end $$;
create function public.zzws_maintenance_generation() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('ordersGeneration',orders_generation,'workspaceGeneration',workspace_generation,'frozen',freeze_job is not null,'protectedOwner',protected_owner,'ownerCount',(select count(*) from public.zzws_admin_scopes a join public.zzws_users u on u.id=a.user_id where a.scope='owner' and u.active and u.profile->>'role'='admin')) from public.zzws_maintenance_state where id=true;
$$;

create function zzws_maintenance_private.category_closure(p_selected text[]) returns text[]
language plpgsql immutable set search_path='' as $$
declare result text[]:=array[]::text[];name text;begin
 if p_selected is null or cardinality(p_selected)=0 or cardinality(p_selected)>6 then raise sqlstate 'PT400' using message='Select data categories';end if;
 foreach name in array p_selected loop
  if name not in('orders','customers','catalog','workspace','settings','full-reset') then raise sqlstate 'PT400' using message='Unknown data category';end if;
 end loop;
 if 'full-reset'=any(p_selected) then return array['orders','customers','catalog','workspace','settings','full-reset'];end if;
 result:=array(select distinct x from unnest(p_selected) x);
 if 'customers'=any(result) then result:=result||array['orders','workspace'];end if;
 if 'catalog'=any(result) or 'settings'=any(result) then result:=result||array['orders'];end if;
 return array(select distinct x from unnest(result) x order by x);
end $$;

create function zzws_maintenance_private.clear_payload(p_payload jsonb,p_job uuid,p_protected uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record;k record;keys text;selected text[];ids uuid[];triggers jsonb;section text;section_list text[];partial boolean;v bigint;u record;begin
 select array_agg(value) into selected from jsonb_array_elements_text(p_payload->'scope');
 if p_payload->>'format' is distinct from 'zzws-maintenance-archive-v1' then raise sqlstate 'PT400';end if;
 perform set_config('zzws.maintenance_job',p_job::text,true);
 select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'trigger',t.tgname,'mode',t.tgenabled::text)),'[]'::jsonb) into triggers
 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal and c.relname in(select 'zzws_'||key from jsonb_each(p_payload->'tables'));
 for r in select distinct value->>'table' as name from jsonb_array_elements(triggers) loop execute format('alter table public.%I disable trigger user',r.name);end loop;
 insert into public.zzws_maintenance_order_tombstones(user_id,request_id,order_id,job_id)
 select (o->>'user_id')::uuid,(o->>'request_id')::uuid,(o->>'id')::uuid,p_job from jsonb_array_elements(coalesce(p_payload->'tables'->'orders','[]'::jsonb)) o
 where o->>'user_id' is not null and o->>'request_id' is not null on conflict do nothing;
 for r in select value as name from unnest(zzws_maintenance_private.delete_order(array(select key from jsonb_each(p_payload->'tables')))) value loop
  if not(r.name=any(zzws_maintenance_private.allowed_tables())) then raise sqlstate 'PT409' using message='Unreviewed archive table';end if;
  if r.name='state' then
   if 'catalog'=any(selected) or 'full-reset'=any(selected) then update public.zzws_state set version=null,rules='{}'::jsonb,catalog_controls='{}'::jsonb,rules_revision=gen_random_uuid(),catalog_controls_revision=gen_random_uuid() where id=true;
   else update public.zzws_state set version=null,catalog_controls_revision=gen_random_uuid() where id=true;end if;
  elsif r.name='user_memory' then
   for u in select value->>'user_id' as id from jsonb_array_elements(p_payload->'tables'->'user_memory') loop
    partial:=(p_payload->'sections'->'user_memoryByUser'?u.id) or coalesce(p_payload->'sections'->'user_memory'?'history',false);
    section_list:=case when partial then array['history'] else array['cart','favorites','history','filters','preferences','draft'] end;
    insert into public.zzws_user_memory(user_id,data,versions,cleared) values(u.id::uuid,'{}','{}','{}') on conflict do nothing;
    foreach section in array section_list loop
     select greatest(coalesce((versions->>section)::bigint,0),coalesce((cleared->>section)::bigint,0))+1 into v from public.zzws_user_memory where user_id=u.id::uuid for update;
     update public.zzws_user_memory set data=case when partial then data-'history' else '{}'::jsonb end,versions=jsonb_set(versions,array[section],to_jsonb(v)),cleared=jsonb_set(cleared,array[section],to_jsonb(v)) where user_id=u.id::uuid;
    end loop;
   end loop;
  else
   select string_agg(format('t.%1$I=s.%1$I',a.attname),' and ' order by key.ordinality) into keys
   from pg_catalog.pg_index i cross join lateral unnest(i.indkey) with ordinality key(attnum,ordinality)
   join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=key.attnum where i.indrelid=to_regclass('public.zzws_'||r.name) and i.indisprimary;
   if keys is null then raise sqlstate 'PT409';end if;
   execute format('delete from public.%1$I t using jsonb_populate_recordset(null::public.%1$I,$1) s where %2$s','zzws_'||r.name,keys) using p_payload->'tables'->r.name;
  end if;
 end loop;
 perform zzws_maintenance_private.vault_clear(p_payload);
 select coalesce(array_agg((value->>'id')::uuid),array[]::uuid[]) into ids from jsonb_array_elements(coalesce(p_payload->'tables'->'users','[]'::jsonb));
 if p_protected=any(ids) then raise sqlstate 'PT403';end if;
 if 'full-reset'=any(selected) then select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(p_payload->'selectedAuth'->'userIds');end if;
 if cardinality(ids)>0 then
  delete from public.zzws_sessions where user_id=any(ids);
  delete from public.zzws_auth_challenges where user_id=any(ids);
  perform zzws_maintenance_private.auth_delete(ids,p_protected);
 end if;
 if 'full-reset'=any(selected) then
  delete from public.zzws_sessions where user_id<>p_protected;
  delete from public.zzws_auth_challenges where user_id<>p_protected;
  delete from public.zzws_attempts;delete from public.zzws_setup;
 end if;
 if p_payload->'tables'?'notification_settings' then insert into public.zzws_notification_settings(id) values(true) on conflict do nothing;end if;
 if p_payload->'tables'?'receipt_settings' then insert into public.zzws_receipt_settings(id) values(true) on conflict do nothing;end if;
 if p_payload->'tables'?'report_email_settings' then insert into public.zzws_report_email_settings(id) values(true) on conflict do nothing;end if;
 if p_payload->'tables'?'mail_transport' then insert into public.zzws_mail_transport(id) values(true) on conflict do nothing;end if;
 for r in select value from jsonb_array_elements(triggers) loop
  execute format('alter table public.%I %s trigger %I',r.value->>'table',case r.value->>'mode' when 'D' then 'disable' when 'A' then 'enable always' when 'R' then 'enable replica' else 'enable' end,r.value->>'trigger');
 end loop;
end $$;

create function public.zzws_maintenance_auth_claim(p_actor uuid,p_hash text,p_id uuid,p_orders_generation bigint,p_workspace_generation bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare state public.zzws_maintenance_state;begin
 if not exists(select 1 from public.zzws_sessions s join public.zzws_users u on u.id=s.user_id where s.hash=p_hash and s.user_id=p_actor and s.expires>clock_timestamp() and u.active) then raise sqlstate 'PT403';end if;
 select * into state from public.zzws_maintenance_state where id=true for share;
 if state.freeze_job is not null or state.orders_generation is distinct from p_orders_generation or state.workspace_generation is distinct from p_workspace_generation then raise sqlstate 'PT409' using message='Data maintenance changed before the credential operation';end if;
 insert into public.zzws_maintenance_auth_mutations(id,actor_id,session_hash) values(p_id,p_actor,p_hash);
 return p_id;
end $$;
create function public.zzws_maintenance_auth_finish(p_actor uuid,p_hash text,p_id uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 -- The credential operation may legitimately have revoked its original application session.
 -- Only the service can finish the unguessable lease owned by that original actor/session pair.
 if p_success then delete from public.zzws_maintenance_auth_mutations where id=p_id and actor_id=p_actor and session_hash=p_hash;
 else update public.zzws_maintenance_auth_mutations set state='uncertain',updated=clock_timestamp() where id=p_id and actor_id=p_actor and session_hash=p_hash;end if;
end $$;
create function zzws_maintenance_private.auth_blocked() returns jsonb language sql stable security definer set search_path='' as $$
 select case when count(*)>0 then jsonb_build_array(jsonb_build_object('code','auth_mutation_in_flight','table','auth_mutations','count',count(*))) else '[]'::jsonb end from public.zzws_maintenance_auth_mutations;
$$;
create function public.zzws_maintenance_status(p_actor uuid,p_hash text,p_job uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;begin
 if p_job is null then select * into job from public.zzws_maintenance_jobs where actor_id=p_actor and state in('queued','running','awaiting_confirmation') order by created desc limit 1;
 else select * into job from public.zzws_maintenance_jobs where id=p_job and actor_id=p_actor;end if;
 return case when job.id is null then null else zzws_maintenance_private.job_dto(job) end;
end $$;
create function public.zzws_maintenance_archives_list(p_actor uuid,p_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);begin
 return jsonb_build_object('archives',coalesce((select jsonb_agg(jsonb_build_object('id',id,'jobId',job_id,'created',created,'kind',kind,'scope',scope,'counts',manifest->'counts','sha256',sha256,'verified',verified_at is not null,'downloadBytes',download_bytes) order by created desc) from public.zzws_maintenance_archives),'[]'::jsonb),'protectedOwner',jsonb_build_object('login',(select login from public.zzws_users where id=protected)));
end $$;
create function public.zzws_maintenance_download(p_actor uuid,p_hash text,p_archive uuid,p_unlock text default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);a public.zzws_maintenance_archives;begin
 select * into a from public.zzws_maintenance_archives where id=p_archive and verified_at is not null;
 if not found or a.sha256 is distinct from encode(sha256(convert_to(a.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409' using message='Verified archive not available';end if;
 if not exists(select 1 from public.zzws_maintenance_unlocks where token_hash=p_unlock and actor_id=p_actor and session_hash=p_hash and expires>clock_timestamp())
 and not exists(select 1 from public.zzws_maintenance_jobs where archive_id=a.id and actor_id=p_actor and session_hash=p_hash and state in('queued','running','awaiting_confirmation')) then raise sqlstate 'PT403' using message='Unlock with current password before downloading a retained credential archive';end if;
 update public.zzws_maintenance_jobs set archive_downloaded_at=clock_timestamp(),updated=clock_timestamp() where archive_id=a.id and actor_id=p_actor;
 return jsonb_build_object('id',a.id,'payloadText',a.payload::text,'sha256',a.sha256,'downloadBytes',a.download_bytes);
end $$;
create function public.zzws_maintenance_confirm(p_actor uuid,p_hash text,p_job uuid,p_fingerprint text,p_archive_sha text) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;source public.zzws_maintenance_archives;payload jsonb;impact jsonb;selected text[];begin
 perform 1 from public.zzws_maintenance_state where id=true for update;
 select * into job from public.zzws_maintenance_jobs where id=p_job and actor_id=p_actor for update;
 if not found or job.fingerprint is distinct from p_fingerprint or job.archive_sha is distinct from p_archive_sha or job.archive_downloaded_at is null then raise sqlstate 'PT409' using message='Download and verify the archive before final confirmation';end if;
 if job.state in('running','completed') and job.final_confirmed_at is not null then return zzws_maintenance_private.job_dto(job);end if;
 if job.state<>'awaiting_confirmation' or exists(select 1 from public.zzws_maintenance_state where id=true and freeze_job is not null) then raise sqlstate 'PT409';end if;
 if jsonb_array_length(zzws_maintenance_private.auth_blocked())>0 then raise sqlstate 'PT409' using message='Finish or reconcile the active credential operation before freezing data';end if;
 if job.kind='restore' then
  perform zzws_maintenance_private.lock_data();
  select * into source from public.zzws_maintenance_archives where id=job.source_archive_id and verified_at is not null;
  if not found or source.sha256 is distinct from job.plan->>'sourceArchiveSha' or source.sha256 is distinct from encode(sha256(convert_to(source.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409' using message='The restore source changed after preview';end if;
  select array_agg(value) into selected from jsonb_array_elements_text(job.selected);
  payload:=zzws_maintenance_private.collect(selected,protected);impact:=zzws_maintenance_private.restore_preview(source.payload,protected,payload);
  if impact is distinct from job.plan->'restoreImpact' or jsonb_array_length(coalesce(impact->'blockers','[]'::jsonb))>0 then raise sqlstate 'PT409' using message='Restore dependencies changed; review the consequences and create a new backup before confirmation';end if;
 end if;
 update public.zzws_maintenance_state set freeze_job=job.id where id=true;
 update public.zzws_maintenance_jobs set state='running',phase='purge',completed_steps=3,final_confirmed_at=clock_timestamp(),updated=clock_timestamp() where id=job.id returning * into job;
 return zzws_maintenance_private.job_dto(job);
end $$;

create function public.zzws_maintenance_step(p_actor uuid,p_hash text,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;a public.zzws_maintenance_archives;source public.zzws_maintenance_archives;
 selected text[];payload jsonb;fp text;sha text;closure text[];impact jsonb;begin
 perform 1 from public.zzws_maintenance_state where id=true for update skip locked;
 if not found then return public.zzws_maintenance_status(p_actor,p_hash,p_job);end if;
 select * into job from public.zzws_maintenance_jobs where id=p_job and actor_id=p_actor for update skip locked;
 if not found then return public.zzws_maintenance_status(p_actor,p_hash,p_job);end if;
 if job.state in('completed','failed','awaiting_confirmation','preview','cancelled') then return zzws_maintenance_private.job_dto(job);end if;

 select array_agg(value) into selected from jsonb_array_elements_text(job.selected);closure:=zzws_maintenance_private.category_closure(selected);
 if job.phase='queued' then
  update public.zzws_maintenance_jobs set state='running',phase='snapshot',updated=clock_timestamp() where id=job.id returning * into job;
 elsif job.phase='snapshot' then
  perform zzws_maintenance_private.lock_data();payload:=zzws_maintenance_private.collect(selected,protected);fp:=zzws_maintenance_private.fingerprint(payload);
  if job.kind='restore' then select * into source from public.zzws_maintenance_archives where id=job.source_archive_id and verified_at is not null;if not found or source.sha256 is distinct from job.plan->>'sourceArchiveSha' then raise sqlstate 'PT409' using message='The source archive changed after preview';end if;impact:=zzws_maintenance_private.restore_preview(source.payload,protected,payload);fp:=encode(sha256(convert_to(fp||source.id::text||source.sha256||impact::text,'UTF8')),'hex');end if;
  if fp is distinct from job.fingerprint or jsonb_array_length(zzws_maintenance_private.blocked(payload)||zzws_maintenance_private.auth_blocked()||coalesce(impact->'blockers','[]'::jsonb))>0 then raise sqlstate 'PT409' using message='Data changed or a delivery is in flight; review and back up again';end if;
  sha:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
  insert into public.zzws_maintenance_archives(job_id,actor_id,kind,scope,manifest,payload,sha256,download_bytes)
  values(job.id,p_actor,job.kind,job.selected,jsonb_build_object('format','zzws-maintenance-archive-v1','schemaVersion',1,'counts',zzws_maintenance_private.counts(payload),'fingerprint',job.fingerprint),payload,sha,octet_length(convert_to(payload::text,'UTF8'))) returning * into a;
  update public.zzws_maintenance_jobs set archive_id=a.id,archive_sha=sha,phase='verify',completed_steps=1,updated=clock_timestamp() where id=job.id returning * into job;
 elsif job.phase='verify' then
  select * into a from public.zzws_maintenance_archives where id=job.archive_id for update;
  if a.job_id is distinct from job.id or a.sha256 is distinct from job.archive_sha or a.sha256 is distinct from encode(sha256(convert_to(a.payload::text,'UTF8')),'hex') or a.download_bytes<>octet_length(convert_to(a.payload::text,'UTF8')) then raise sqlstate 'PT409' using message='Archive read-back verification failed';end if;
  update public.zzws_maintenance_archives set verified_at=clock_timestamp() where id=a.id;
  update public.zzws_maintenance_jobs set state='awaiting_confirmation',phase='awaiting_confirmation',completed_steps=2,updated=clock_timestamp() where id=job.id returning * into job;
 elsif job.phase='purge' then
  if job.final_confirmed_at is null or job.archive_downloaded_at is null then raise sqlstate 'PT403';end if;
  perform zzws_maintenance_private.lock_data();
  select * into a from public.zzws_maintenance_archives where id=job.archive_id and verified_at is not null;
  if not found or a.job_id is distinct from job.id or a.sha256 is distinct from job.archive_sha or a.sha256 is distinct from encode(sha256(convert_to(a.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409' using message='Archive integrity check failed';end if;
  payload:=zzws_maintenance_private.collect(selected,protected);fp:=zzws_maintenance_private.fingerprint(payload);
  if job.kind='restore' then select * into source from public.zzws_maintenance_archives where id=job.source_archive_id and verified_at is not null;if not found or source.sha256 is distinct from job.plan->>'sourceArchiveSha' then raise sqlstate 'PT409' using message='The source archive changed after preview';end if;impact:=zzws_maintenance_private.restore_preview(source.payload,protected,payload);fp:=encode(sha256(convert_to(fp||source.id::text||source.sha256||impact::text,'UTF8')),'hex');end if;
  if fp is distinct from job.fingerprint or jsonb_array_length(zzws_maintenance_private.blocked(payload)||zzws_maintenance_private.auth_blocked()||coalesce(impact->'blockers','[]'::jsonb))>0 then raise sqlstate 'PT409' using message='Data changed after backup; nothing was deleted. Review and back up again';end if;
  perform zzws_maintenance_private.clear_payload(a.payload,job.id,protected);
  if job.kind='restore' then
   if source.sha256 is distinct from encode(sha256(convert_to(source.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409';end if;
   perform zzws_maintenance_private.restore_payload(zzws_maintenance_private.vault_restore_payload(source.payload),protected,a.payload);
  end if;
  update public.zzws_maintenance_state set freeze_job=null,orders_generation=orders_generation+case when 'orders'=any(closure) then 1 else 0 end,workspace_generation=workspace_generation+case when 'workspace'=any(selected) or 'full-reset'=any(selected) then 1 else 0 end where id=true;
  update public.zzws_maintenance_jobs set state='completed',phase='completed',completed_steps=total_steps,updated=clock_timestamp() where id=job.id returning * into job;
 else raise sqlstate 'PT409' using message='Unsupported maintenance phase';end if;
 return zzws_maintenance_private.job_dto(job);
exception when others then
 if protected is null or protected is distinct from p_actor then raise;end if;
 update public.zzws_maintenance_state set freeze_job=null where id=true and freeze_job=p_job;
 update public.zzws_maintenance_jobs set state='failed',phase='failed',last_error=jsonb_build_object('code',sqlstate,'message',case when sqlstate='PT409' then 'Տվյալները փոխվել են կամ պահուստը չի ստուգվել։ Ոչինչ չի ջնջվել։ Կրկին ստուգեք և ստեղծեք նոր պահուստ։' else 'Գործողությունը չի ավարտվել։ Փոփոխությունները հետ են շրջվել։' end,'retryable',false),updated=clock_timestamp() where id=p_job and actor_id=p_actor returning * into job;
 if job.id is null then raise;end if;return zzws_maintenance_private.job_dto(job);
end $$;

create function zzws_maintenance_private.counts(p_payload jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('tables',coalesce((select jsonb_agg(jsonb_build_object('id',key,'label',key,'count',jsonb_array_length(value)) order by key) from jsonb_each(p_payload->'tables')),'[]'::jsonb),
 'orderStatuses',coalesce((select jsonb_object_agg(status,n) from (select value->>'status' as status,count(*) as n from jsonb_array_elements(coalesce(p_payload->'tables'->'orders','[]'::jsonb)) group by value->>'status') q),'{}'::jsonb),
 'totalRows',coalesce((select sum(jsonb_array_length(value)) from jsonb_each(p_payload->'tables')),0),
 'credentials',jsonb_build_object('authUsers',jsonb_array_length(coalesce(p_payload->'selectedAuth'->'userIds','[]'::jsonb)),'mailSecrets',jsonb_array_length(coalesce(p_payload->'vault'->'entries','[]'::jsonb)),'referenceAuthUsers',jsonb_array_length(coalesce(p_payload->'auth'->'userIds','[]'::jsonb))),
 'userMemory',(select jsonb_build_object('historyOnlyRows',count(*) filter(where coalesce(p_payload->'sections'->'user_memory'='["history"]'::jsonb,false) or coalesce(p_payload->'sections'->'user_memoryByUser'->(row.value->>'user_id')='["history"]'::jsonb,false)),'workspaceRows',count(*) filter(where not(coalesce(p_payload->'sections'->'user_memory'='["history"]'::jsonb,false) or coalesce(p_payload->'sections'->'user_memoryByUser'->(row.value->>'user_id')='["history"]'::jsonb,false)))) from jsonb_array_elements(coalesce(p_payload->'tables'->'user_memory','[]'::jsonb)) row),
 'references',coalesce((select jsonb_agg(jsonb_build_object('id',key,'count',jsonb_array_length(value)) order by key) from jsonb_each(p_payload->'references'->'tables')),'[]'::jsonb));
$$;
create function zzws_maintenance_private.blocked(p_payload jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('code','delivery_in_flight','table',name,'count',n)),'[]'::jsonb) from (
  select key as name,count(*) as n from jsonb_each(p_payload->'tables') t cross join lateral jsonb_array_elements(t.value) row
  where key in('notification_outbox','integration_outbox','report_deliveries','telegram_commands','invitations')
  and (row.value->>'state' in('leased','sending') or row.value->>'mail_state'='sending') group by key
 ) q;
$$;
create function zzws_maintenance_private.job_dto(p_job public.zzws_maintenance_jobs) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p_job.id,'kind',p_job.kind,'state',p_job.state,'phase',p_job.phase,'fingerprint',p_job.fingerprint,
 'selected',p_job.selected,'completedSteps',p_job.completed_steps,'totalSteps',p_job.total_steps,
 'indeterminate',p_job.state='running','counts',p_job.plan->'counts','restoreCounts',p_job.plan->'restoreCounts','restoreImpact',p_job.plan->'restoreImpact','archiveId',p_job.archive_id,'archiveSha',p_job.archive_sha,
 'error',p_job.last_error,'blockingReasons',coalesce(p_job.plan->'blockingReasons','[]'::jsonb),'canRetry',false,'canCancel',p_job.state in('queued','running','awaiting_confirmation'),'canConfirmDelete',p_job.state='awaiting_confirmation' and p_job.archive_downloaded_at is not null and jsonb_array_length(coalesce(p_job.plan->'blockingReasons','[]'::jsonb))=0,
 'closure',p_job.plan->'closure','retained',jsonb_build_array('protected-main-owner','backups','operational-schema-and-artifacts'),
 'sourceArchiveId',p_job.source_archive_id,'created',p_job.created,'updated',p_job.updated,
 'result',case when p_job.state='completed' then (select jsonb_build_object('ordersGeneration',orders_generation,'workspaceGeneration',workspace_generation) from public.zzws_maintenance_state where id=true) else null end);
$$;
create function zzws_maintenance_private.lock_data() returns void language plpgsql set search_path='' as $$
declare name text;begin
 for name in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'zzws\_%' escape '\' and c.relname not like 'zzws_maintenance_%' order by c.relname loop
  execute format('lock table public.%I in share row exclusive mode',name);
 end loop;
 for name in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='auth' and c.relname in('users','identities','mfa_factors','mfa_recovery_code_sets','webauthn_credentials') and c.relkind='r' order by c.relname loop
  execute format('lock table auth.%I in share row exclusive mode',name);
 end loop;
 lock table vault.secrets in share row exclusive mode;
end $$;

create function public.zzws_maintenance_unlock(p_actor uuid,p_hash text,p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise sqlstate 'PT400';end if;
 insert into public.zzws_maintenance_unlocks(token_hash,actor_id,session_hash,expires) values(p_token_hash,p_actor,p_hash,clock_timestamp()+interval '5 minutes');
 return jsonb_build_object('expiresAt',clock_timestamp()+interval '5 minutes','capabilities',jsonb_build_object('allowed',true,'protectedOwner',jsonb_build_object('login',(select login from public.zzws_users where id=protected)),
 'categories',jsonb_build_array(
  jsonb_build_object('id','orders','label','Պատվերներ և ամբողջ պատմությունը','dependencies','[]'::jsonb),
  jsonb_build_object('id','customers','label','Հաճախորդներ և աշխատակիցներ','dependencies','["orders","workspace"]'::jsonb),
  jsonb_build_object('id','catalog','label','Գնացուցակներ, կանոններ և ցուցափեղկ','dependencies','["orders"]'::jsonb),
  jsonb_build_object('id','workspace','label','Զամբյուղներ և անձնական տվյալներ','dependencies','[]'::jsonb),
  jsonb_build_object('id','settings','label','Ծանուցումների և ինտեգրումների կարգավորումներ','dependencies','["orders"]'::jsonb),
  jsonb_build_object('id','full-reset','label','Ամբողջական մաքրում՝ պահպանելով հիմնական ադմինիստրատորին և պահուստները','dependencies','["orders","customers","catalog","workspace","settings"]'::jsonb)),
 'fullResetAvailable',true,'restoreAvailable',true));
end $$;
create function zzws_maintenance_private.require_unlock(p_actor uuid,p_hash text,p_token_hash text) returns void language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.zzws_maintenance_unlocks where token_hash=p_token_hash and actor_id=p_actor and session_hash=p_hash and expires>clock_timestamp()) then raise sqlstate 'PT403' using message='Unlock with your current password again';end if;
end $$;

create function public.zzws_maintenance_preview(p_actor uuid,p_hash text,p_unlock text,p_selected text[],p_source_archive uuid default null) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);selected text[]:=p_selected;payload jsonb;fingerprint text;plan jsonb;job public.zzws_maintenance_jobs;source public.zzws_maintenance_archives;blocked jsonb;impact jsonb;begin
 perform zzws_maintenance_private.require_unlock(p_actor,p_hash,p_unlock);
 if p_source_archive is not null then
  select * into source from public.zzws_maintenance_archives where id=p_source_archive and verified_at is not null;
  if not found or source.payload->>'format' is distinct from 'zzws-maintenance-archive-v1' or source.sha256 is distinct from encode(sha256(convert_to(source.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409' using message='Archive verification failed';end if;
  perform zzws_maintenance_private.vault_validate(source.payload);
  select array_agg(value) into selected from jsonb_array_elements_text(source.scope);
 end if;
 perform zzws_maintenance_private.category_closure(selected);
 perform zzws_maintenance_private.lock_data();payload:=zzws_maintenance_private.collect(selected,protected);fingerprint:=zzws_maintenance_private.fingerprint(payload);
 if p_source_archive is not null then impact:=zzws_maintenance_private.restore_preview(source.payload,protected,payload);fingerprint:=encode(sha256(convert_to(fingerprint||source.id::text||source.sha256||impact::text,'UTF8')),'hex');end if;
 blocked:=zzws_maintenance_private.blocked(payload)||zzws_maintenance_private.auth_blocked()||coalesce(impact->'blockers','[]'::jsonb);
 plan:=jsonb_build_object('counts',zzws_maintenance_private.counts(payload),'closure',to_jsonb(zzws_maintenance_private.category_closure(selected)),'blockingReasons',blocked,'sourceArchiveSha',source.sha256,
 'restoreCounts',case when p_source_archive is not null then zzws_maintenance_private.counts(source.payload) else null end,'restoreImpact',impact);
 insert into public.zzws_maintenance_jobs(actor_id,session_hash,kind,source_archive_id,selected,plan,fingerprint)
 values(p_actor,p_hash,case when p_source_archive is null then 'clear' else 'restore' end,p_source_archive,to_jsonb(selected),plan,fingerprint) returning * into job;
 return jsonb_build_object('previewId',job.id,'fingerprint',fingerprint,'expiresAt',job.expires,'selected',to_jsonb(selected),'counts',plan->'counts','restoreCounts',plan->'restoreCounts','restoreImpact',plan->'restoreImpact',
 'closure',(select jsonb_agg(jsonb_build_object('id',x,'label',x,'reason',case when x=any(selected) then 'selected' else 'dependency' end)) from unnest(zzws_maintenance_private.category_closure(selected)) x),
 'retained',jsonb_build_array('protected-main-owner','backups','operational-schema-and-artifacts'),'blocked',jsonb_array_length(blocked)>0,'blockingReasons',blocked,'kind',job.kind,
 'warning','Սկզբում կստեղծվի և կստուգվի պահուստը։ Ջնջումը հնարավոր կլինի միայն ներբեռնումից և ընթացիկ գաղտնաբառի նոր հաստատումից հետո։');
end $$;

create function public.zzws_maintenance_start(p_actor uuid,p_hash text,p_unlock text,p_preview uuid,p_fingerprint text,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;begin
 perform zzws_maintenance_private.require_unlock(p_actor,p_hash,p_unlock);
 if p_request is null then raise sqlstate 'PT400';end if;
 select * into job from public.zzws_maintenance_jobs where actor_id=p_actor and request_id=p_request;
 if found then if job.id is distinct from p_preview or job.fingerprint is distinct from p_fingerprint then raise sqlstate 'PT409';end if;return zzws_maintenance_private.job_dto(job);end if;
 select * into job from public.zzws_maintenance_jobs where id=p_preview and actor_id=p_actor and session_hash=p_hash for update;
 if not found or job.state<>'preview' or job.expires<=clock_timestamp() or job.fingerprint is distinct from p_fingerprint or jsonb_array_length(job.plan->'blockingReasons')>0 then raise sqlstate 'PT409' using message='Preview expired or blocked; review again';end if;
 if exists(select 1 from public.zzws_maintenance_jobs where state in('queued','running','awaiting_confirmation')) then raise sqlstate 'PT409' using message='A maintenance job already exists';end if;
 update public.zzws_maintenance_jobs set request_id=p_request,state='queued',phase='queued',updated=clock_timestamp() where id=job.id returning * into job;
 return zzws_maintenance_private.job_dto(job);
end $$;

create function public.zzws_maintenance_cancel(p_actor uuid,p_hash text,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);job public.zzws_maintenance_jobs;begin
 perform 1 from public.zzws_maintenance_state where id=true for update;
 select * into job from public.zzws_maintenance_jobs where id=p_job and actor_id=p_actor for update;
 if not found then raise sqlstate 'PT404';end if;
 if job.state='completed' then return zzws_maintenance_private.job_dto(job);end if;
 update public.zzws_maintenance_state set freeze_job=null where id=true and freeze_job=job.id;
 update public.zzws_maintenance_jobs set state='cancelled',phase='cancelled',updated=clock_timestamp() where id=job.id returning * into job;
 return zzws_maintenance_private.job_dto(job);
end $$;

create function public.zzws_maintenance_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare frozen uuid;protected uuid;row_value jsonb;orders_epoch bigint;workspace_epoch bigint;request_headers jsonb;begin
 -- VOLATILE trigger sees the committed epoch after a waiting table lock. Do not lock state here:
 -- maintenance takes state before business-table locks, and the reverse order would deadlock.
 select freeze_job,protected_owner,orders_generation,workspace_generation into frozen,protected,orders_epoch,workspace_epoch from public.zzws_maintenance_state where id=true;
 row_value:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 -- Recovery must never lock out the protected owner after a lost/expired browser session.
 if frozen is not null and current_setting('zzws.maintenance_job',true) is distinct from frozen::text then
  if tg_table_name='zzws_attempts' then if tg_op='DELETE' then return old;else return new;end if;end if;
  if tg_table_name in('zzws_sessions','zzws_auth_challenges') and (row_value->>'user_id'=protected::text or tg_op='DELETE') then if tg_op='DELETE' then return old;else return new;end if;end if;
  if tg_table_name='zzws_users' and tg_op='UPDATE' and row_value->>'id'=protected::text and (row_value-'last_login')=(to_jsonb(old)-'last_login') then return new;end if;
  if tg_table_name='zzws_audit' and tg_op='INSERT' and row_value->>'actor'=protected::text and row_value->>'action' in('login','logout','mfa_enroll') then return new;end if;
 end if;
 if frozen is not null and current_setting('zzws.maintenance_job',true) is distinct from frozen::text then raise sqlstate 'PT409' using message='Owner maintenance is in progress; retry after completion';end if;
 -- A request that started before a completed reset may reach SQL only afterwards.
 -- Reject its writes using internal, immutable per-request PostgREST headers; legacy workers
 -- without these headers retain the existing lease/freeze protection.
 request_headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
 if (frozen is null or current_setting('zzws.maintenance_job',true) is distinct from frozen::text)
 and (request_headers?'x-zzws-expected-orders-generation' or request_headers?'x-zzws-expected-workspace-generation')
 and tg_table_name not in('zzws_sessions','zzws_auth_challenges','zzws_attempts')
 and not(tg_table_name='zzws_users' and tg_op='UPDATE' and (to_jsonb(new)-'last_login')=(to_jsonb(old)-'last_login'))
 and not(tg_table_name='zzws_audit' and tg_op='INSERT' and row_value->>'action' in('login','logout','mfa_enroll')) then
  if request_headers->>'x-zzws-expected-orders-generation' is distinct from orders_epoch::text or request_headers->>'x-zzws-expected-workspace-generation' is distinct from workspace_epoch::text
  then raise sqlstate 'PT409' using message='The request started before data maintenance; refresh before retrying',hint='zzws_stale_epoch';end if;
 end if;
 if tg_table_name='zzws_orders' and tg_op='INSERT' then
  if exists(select 1 from public.zzws_maintenance_order_tombstones where user_id=new.user_id and request_id=new.request_id) then raise sqlstate 'PT409' using message='This order request belongs to cleared history; explicitly create a new order';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create function public.zzws_maintenance_owner_immutable() returns trigger language plpgsql set search_path='' as $$ begin
 if old.protected_owner is not null and new.protected_owner is distinct from old.protected_owner then raise sqlstate 'PT403' using message='Protected main owner cannot be replaced';end if;return new;
end $$;
create trigger zzws_maintenance_owner_immutable before update of protected_owner on public.zzws_maintenance_state for each row execute function public.zzws_maintenance_owner_immutable();
do $$declare name text;begin
 for name in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname like 'zzws\_%' escape '\' and c.relname not like 'zzws_maintenance_%' and c.relname<>'zzws_backup_keys' loop
  execute format('create trigger zzws_maintenance_write_guard before insert or update or delete on public.%I for each row execute function public.zzws_maintenance_write_guard()',name);
 end loop;
end $$;
create function zzws_maintenance_private.allowed_tables() returns text[] language sql immutable set search_path='' as $$
 select array['admin_devices','admin_notice_reads','admin_order_reads','admin_scopes','apk_downloads','apk_usage','approval_reminder_snoozes','audit','bulletin_reads','catalog_bulletins','client_receipt_controls','delivery_counterparties','drafts','external_systems','integration_documents','integration_outbox','invitations','mail_transport','mobile_events','mobile_preferences','notification_outbox','notification_recipients','notification_settings','order_activity','order_calculation_contexts','order_events','order_gate','order_integration_resolutions','orders','partner_counterparties','receipt_notices','receipt_settings','report_deliveries','report_email_settings','saved_carts','state','telegram_commands','telegram_parts','user_channels','user_memory','users','versions'];
$$;
create function zzws_maintenance_private.fk_rows(p_fk oid,p_source jsonb,p_existing jsonb,p_descendant boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare fk pg_catalog.pg_constraint;target regclass;source regclass;joins text;pk text;oldpk text;result jsonb;begin
 select * into fk from pg_catalog.pg_constraint where oid=p_fk and contype='f';
 target:=case when p_descendant then fk.conrelid else fk.confrelid end;source:=case when p_descendant then fk.confrelid else fk.conrelid end;
 select string_agg(case when p_descendant then format('t.%I=p.%I',a.attname,b.attname) else format('t.%I=p.%I',b.attname,a.attname) end,' and ' order by k.n) into joins
 from unnest(fk.conkey,fk.confkey) with ordinality k(child,parent,n) join pg_catalog.pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.child join pg_catalog.pg_attribute b on b.attrelid=fk.confrelid and b.attnum=k.parent;
 select string_agg(format('t.%I',a.attname),',' order by k.n),string_agg(format('t.%1$I=old.%1$I',a.attname),' and ' order by k.n) into pk,oldpk
 from pg_catalog.pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=target and i.indisprimary;
 if pk is null then raise sqlstate 'PT409' using message='Unreviewed foreign-key table';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from (select distinct on(%1$s) t.* from %2$s t join jsonb_populate_recordset(null::%3$s,$1) p on %4$s where not exists(select 1 from jsonb_populate_recordset(null::%2$s,$2) old where %5$s) order by %1$s) q',pk,target,source,joins,oldpk) into result using p_source,coalesce(p_existing,'[]'::jsonb);
 return result;
end $$;
create function zzws_maintenance_private.descendants(p_tables jsonb,p_protected uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:=p_tables;r record;added jsonb;changed boolean;iteration integer:=0;begin
 loop
  changed:=false;iteration:=iteration+1;if iteration>50 then raise sqlstate 'PT409' using message='Dependency closure did not converge';end if;
  for r in select fk.oid,substr(child.relname,6) as child,substr(parent.relname,6) as parent from pg_catalog.pg_constraint fk join pg_catalog.pg_class child on child.oid=fk.conrelid join pg_catalog.pg_class parent on parent.oid=fk.confrelid join pg_catalog.pg_namespace nc on nc.oid=child.relnamespace join pg_catalog.pg_namespace np on np.oid=parent.relnamespace
   where fk.contype='f' and nc.nspname='public' and np.nspname='public' and substr(child.relname,6)=any(zzws_maintenance_private.allowed_tables()) and parent.relname like 'zzws_%' order by fk.oid loop
   if result?r.parent and jsonb_array_length(result->r.parent)>0 then
    added:=zzws_maintenance_private.fk_rows(r.oid,result->r.parent,result->r.child,true);
    if jsonb_array_length(added)>0 then
     if r.child='users' and exists(select 1 from jsonb_array_elements(added) u where u->>'id'=p_protected::text) then raise sqlstate 'PT409' using message='A selected record is required by the protected main owner';end if;
     result:=jsonb_set(result,array[r.child],coalesce(result->r.child,'[]'::jsonb)||added,true);changed:=true;
    end if;
   end if;
  end loop;
  exit when not changed;
 end loop;
 return result;
end $$;
create function zzws_maintenance_private.ancestors(p_tables jsonb,p_refs jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:=p_refs;all_rows jsonb;existing jsonb;r record;added jsonb;changed boolean;iteration integer:=0;begin
 loop
  changed:=false;iteration:=iteration+1;if iteration>50 then raise sqlstate 'PT409' using message='Reference closure did not converge';end if;
  for r in select fk.oid,substr(child.relname,6) as child,substr(parent.relname,6) as parent from pg_catalog.pg_constraint fk join pg_catalog.pg_class child on child.oid=fk.conrelid join pg_catalog.pg_class parent on parent.oid=fk.confrelid join pg_catalog.pg_namespace nc on nc.oid=child.relnamespace join pg_catalog.pg_namespace np on np.oid=parent.relnamespace
   where fk.contype='f' and nc.nspname='public' and np.nspname='public' and substr(parent.relname,6)=any(zzws_maintenance_private.allowed_tables()) and child.relname like 'zzws_%' order by fk.oid loop
   all_rows:=coalesce(p_tables->r.child,'[]'::jsonb)||coalesce(result->r.child,'[]'::jsonb);
   if jsonb_array_length(all_rows)>0 then
    existing:=coalesce(p_tables->r.parent,'[]'::jsonb)||coalesce(result->r.parent,'[]'::jsonb);
    added:=zzws_maintenance_private.fk_rows(r.oid,all_rows,existing,false);
    if jsonb_array_length(added)>0 then result:=jsonb_set(result,array[r.parent],coalesce(result->r.parent,'[]'::jsonb)||added,true);changed:=true;end if;
   end if;
  end loop;
  exit when not changed;
 end loop;return result;
end $$;
create function zzws_maintenance_private.delete_rank(p_name text) returns integer language sql immutable set search_path='' as $$
 select case p_name when 'telegram_parts' then 10 when 'notification_outbox' then 20 when 'integration_outbox' then 20 when 'integration_documents' then 20 when 'order_integration_resolutions' then 20 when 'report_deliveries' then 20 when 'admin_notice_reads' then 20
 when 'bulletin_reads' then 25 when 'delivery_counterparties' then 25 when 'receipt_notices' then 30 when 'admin_order_reads' then 30 when 'approval_reminder_snoozes' then 30 when 'order_calculation_contexts' then 30 when 'order_events' then 30 when 'mobile_events' then 30
 when 'partner_counterparties' then 35 when 'catalog_bulletins' then 35 when 'order_activity' then 40 when 'drafts' then 45 when 'audit' then 45 when 'order_gate' then 45 when 'orders' then 50 when 'external_systems' then 60 when 'invitations' then 60 when 'admin_scopes' then 60 when 'apk_downloads' then 60 when 'apk_usage' then 60 when 'state' then 65 when 'versions' then 75 when 'users' then 90 else 55 end;
$$;
create function zzws_maintenance_private.delete_order(p_names text[]) returns text[] language plpgsql stable set search_path='' as $$
declare pending text[]:=p_names;result text[]:=array[]::text[];picked text;begin
 while cardinality(pending)>0 loop
  select name into picked from unnest(pending) name where not exists(
   select 1 from pg_catalog.pg_constraint f join pg_catalog.pg_class child on child.oid=f.conrelid join pg_catalog.pg_class parent on parent.oid=f.confrelid
   where f.contype='f' and f.conrelid<>f.confrelid and parent.oid=to_regclass('public.zzws_'||name) and child.relnamespace='public'::regnamespace and substr(child.relname,6)=any(pending)
  ) order by zzws_maintenance_private.delete_rank(name),name limit 1;
  if picked is null then raise sqlstate 'PT409' using message='Cyclic dependency requires explicit review';end if;
  result:=array_append(result,picked);pending:=array_remove(pending,picked);
 end loop;return result;
end $$;
create function zzws_maintenance_private.vault_snapshot(p_tables jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];entries jsonb;begin
 select coalesce(array_agg(distinct (value->>'secret_id')::uuid) filter(where value->>'secret_id' is not null),array[]::uuid[]) into ids from jsonb_array_elements(coalesce(p_tables->'mail_transport','[]'::jsonb));
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'secret',v.decrypted_secret,'name',to_jsonb(v)->'name','description',to_jsonb(v)->'description') order by v.id),'[]'::jsonb) into entries from vault.decrypted_secrets v where v.id=any(ids);
 if jsonb_array_length(entries)<>cardinality(ids) then raise sqlstate 'PT409' using message='The configured mailbox credential cannot be backed up';end if;
 return jsonb_build_object('format','zzws-mail-vault-v1','entries',entries);
end $$;
create function zzws_maintenance_private.vault_validate(p_payload jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare ids uuid[];r record;count_entries integer:=0;begin
 select coalesce(array_agg(distinct (value->>'secret_id')::uuid) filter(where value->>'secret_id' is not null),array[]::uuid[]) into ids from jsonb_array_elements(coalesce(p_payload->'tables'->'mail_transport','[]'::jsonb));
 if cardinality(ids)>0 and p_payload->'vault'->>'format' is distinct from 'zzws-mail-vault-v1' then raise sqlstate 'PT409' using message='The archive does not contain restorable mailbox credentials';end if;
 if jsonb_typeof(coalesce(p_payload->'vault'->'entries','[]'::jsonb))<>'array' then raise sqlstate 'PT409';end if;
 for r in select value from jsonb_array_elements(coalesce(p_payload->'vault'->'entries','[]'::jsonb)) loop
  if not((r.value->>'id')::uuid=any(ids)) or jsonb_typeof(r.value->'secret') is distinct from 'string' or length(r.value->>'secret') not between 1 and 4096 then raise sqlstate 'PT409' using message='Invalid targeted mailbox credential archive';end if;
  count_entries:=count_entries+1;
 end loop;
 if count_entries<>cardinality(ids) or count_entries<>(select count(distinct value->>'id') from jsonb_array_elements(coalesce(p_payload->'vault'->'entries','[]'::jsonb))) then raise sqlstate 'PT409';end if;
end $$;
create function zzws_maintenance_private.vault_clear(p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$begin
 perform zzws_maintenance_private.vault_validate(p_payload);
 delete from vault.secrets where id in(select (value->>'id')::uuid from jsonb_array_elements(coalesce(p_payload->'vault'->'entries','[]'::jsonb)));
end $$;
create function zzws_maintenance_private.vault_restore_payload(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb:=p_payload;mapping jsonb:='{}';r record;id uuid;rows jsonb;begin
 perform zzws_maintenance_private.vault_validate(p_payload);
 for r in select value from jsonb_array_elements(coalesce(p_payload->'vault'->'entries','[]'::jsonb)) loop
  -- Use the official encryption helper. Ciphertext IDs/associated data are never renamed.
  -- A new unique name preserves every existing unselected secret, including legacy orphans.
  id:=vault.create_secret(r.value->>'secret','zzws-restored-mail-'||gen_random_uuid()::text,coalesce(r.value->>'description','ZZWS restored mailbox credential'));
  mapping:=jsonb_set(mapping,array[r.value->>'id'],to_jsonb(id::text),true);
 end loop;
 if p_payload->'tables'?'mail_transport' then
  select coalesce(jsonb_agg(case when value->>'secret_id' is null then value else jsonb_set(value,'{secret_id}',mapping->(value->>'secret_id')) end),'[]'::jsonb) into rows from jsonb_array_elements(p_payload->'tables'->'mail_transport');
  result:=jsonb_set(result,'{tables,mail_transport}',rows);
 end if;
 return result;
end $$;
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'zzws_maintenance_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='zzws_maintenance_private' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
commit;
