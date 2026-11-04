-- Local preparation only. Apply after 03a/03b and receipt/application backup schema.
begin;
create table public.zzws_order_calculation_contexts(
 order_id uuid not null references public.zzws_orders(id) on delete cascade,
 order_revision integer not null check(order_revision>0),schema_version integer not null check(schema_version=1),
 catalog_version uuid not null references public.zzws_versions(id),rules_revision uuid not null,
 client_category text check(client_category in ('KP','Dealers')),profile_revision bigint,
 ordered_lines jsonb not null,total numeric not null,context jsonb not null,created timestamptz not null default now(),
 primary key(order_id,order_revision)
);
alter table public.zzws_order_calculation_contexts enable row level security;
revoke all on public.zzws_order_calculation_contexts from public,anon,authenticated,service_role;
grant select,insert on public.zzws_order_calculation_contexts to service_role;
create policy service_read on public.zzws_order_calculation_contexts for select to service_role using(true);
create policy service_append on public.zzws_order_calculation_contexts for insert to service_role with check(true);

create function public.zzws_validate_calculation(p_user uuid,p_context jsonb,p_lines jsonb,p_total numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare u public.zzws_users;s public.zzws_state;v public.zzws_versions;catalog jsonb;checks jsonb='[]';positions jsonb='[]';r jsonb;actual jsonb;entry jsonb;line jsonb;result jsonb;begin
 if p_context is null or p_context->>'schemaVersion' is distinct from '1' or jsonb_typeof(p_context->'checkedProducts') is distinct from 'array' or jsonb_typeof(p_context->'lines') is distinct from 'array' then raise sqlstate 'PT400' using message='Հաշվարկի տվյալները բացակայում են';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>500 or jsonb_array_length(p_context->'lines')<>jsonb_array_length(p_lines) or jsonb_array_length(p_context->'checkedProducts')<>jsonb_array_length(p_lines) then raise sqlstate 'PT400' using message='Հաշվարկի դիրքերը չեն համընկնում';end if;
 if jsonb_array_length(p_lines)<>(select count(distinct x->>'articul') from jsonb_array_elements(p_lines) x) then raise sqlstate 'PT400' using message='Կրկնվող արտիկուլ';end if;
 if p_user is not null then
  select * into u from public.zzws_users where id=p_user for share;if not found then raise sqlstate 'PT403' using message='Հաճախորդը չի գտնվել';end if;
  if u.profile_revision is distinct from (p_context->>'profileRevision')::bigint then raise sqlstate 'PT409' using message='Հաճախորդի տվյալները փոխվել են';end if;
  if p_context->>'clientCategory' is distinct from coalesce(u.profile->>'sheet','Dealers') then raise sqlstate 'PT400' using message='Հաշվարկի գնային խումբը չի համընկնում';end if;
 elsif p_context->>'clientCategory' is not null or p_context->>'profileRevision' is not null then raise sqlstate 'PT400' using message='Պատմական հաճախորդի տվյալները չեն հաստատվում';end if;
 select * into s from public.zzws_state where id=true for share;
 if s.version is null then raise sqlstate 'PT412' using message='Գնացուցակը փոխվել է';end if;
 if s.rules_revision::text is distinct from p_context->>'rulesRevision' then raise sqlstate 'PT412' using message='Գնային կանոնները փոխվել են';end if;
 if s.rules is distinct from p_context->'rulesStorageSnapshot' then raise sqlstate 'PT412' using message='Գնային կանոնները փոխվել են';end if;
 select * into v from public.zzws_versions where id=s.version;
 select coalesce(jsonb_object_agg(x->>'articul',x),'{}') into catalog from jsonb_array_elements(v.products) x where x->>'articul' in(select value->>'articul' from jsonb_array_elements(p_lines));
 for r in select value from jsonb_array_elements(p_context->'checkedProducts') loop
  actual=catalog->(r->>'articul');
  -- A newer version differing only in stock (or unrelated products) is safe without repricing.
  if (coalesce(actual,'{}')-'stocks') is distinct from (coalesce(nullif(r->'product','null'),'{}')-'stocks') then raise sqlstate 'PT412' using message='Ապրանքի տվյալները փոխվել են';end if;
  checks=checks||jsonb_build_array(jsonb_build_object('articul',r->>'articul','product',actual));
 end loop;
 for line in select value from jsonb_array_elements(p_lines) loop
  select value into entry from jsonb_array_elements(p_context->'lines') where value->>'articul'=line->>'articul';
  if not found or (entry->>'qty')::numeric is distinct from (line->>'qty')::numeric or (entry->>'chargedUnitPrice')::numeric is distinct from (line->>'unitPrice')::numeric or not exists(select 1 from jsonb_array_elements(checks) where value->>'articul'=line->>'articul') then raise sqlstate 'PT400' using message='Հաշվարկն ու պատվերը չեն համընկնում';end if;
  if entry->'calculation'->>'catalogVersion'=p_context->>'catalogVersion' and entry->>'basisRevision' is null then entry=jsonb_set(entry,'{calculation,catalogVersion}',to_jsonb(s.version::text));end if;
  positions=positions||jsonb_build_array(entry);
 end loop;
 -- Keep the existing server totalOf rounding semantics, including legacy sub-cent prices.
 -- Do not replace JavaScript's established calculation with a different numeric rounding formula.
 if p_total is distinct from (p_context->>'orderTotal')::numeric then raise sqlstate 'PT400' using message='Պատվերի գումարը չի համընկնում';end if;
 result=p_context||jsonb_build_object('catalogVersion',s.version,'checkedAt',now(),'checkedProducts',checks,'lines',positions);
 return result;
end $$;

create function public.zzws_calculation_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.lines is not distinct from old.lines and new.total is not distinct from old.total then return null;end if;
 if not exists(select 1 from public.zzws_order_calculation_contexts where order_id=new.id and order_revision=new.revision and ordered_lines=new.lines and total=new.total) then raise sqlstate 'PT400' using message='Պատվերը չի կարող պահպանվել առանց հաշվարկի տվյալների';end if;
 return null;
end $$;
create constraint trigger zzws_calculation_guard after insert or update on public.zzws_orders deferrable initially deferred for each row execute function public.zzws_calculation_guard();

create function public.zzws_submit_order_v3(p_user uuid,p_request uuid,p_delivery_variant uuid,p_profile_revision bigint,p_delivery jsonb,p_lines jsonb,p_total numeric,p_context jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result jsonb;checked jsonb;begin
 perform public.zzws_receipt_state(p_user);
 perform 1 from public.zzws_users where id=p_user and active for share;if not found then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into o from public.zzws_orders where user_id=p_user and request_id=p_request;if found then return to_jsonb(o);end if;
 if (p_context->>'profileRevision')::bigint is distinct from p_profile_revision then raise sqlstate 'PT409' using message='Հաճախորդի տարբերակը չի համընկնում';end if;
 checked=public.zzws_validate_calculation(p_user,p_context,p_lines,p_total);
 if exists(select 1 from jsonb_array_elements(checked->'lines') x where (x->>'requestedQty')::numeric is distinct from (x->>'qty')::numeric) then raise sqlstate 'PT400' using message='Պահպանեք ամբողջ պահանջված քանակը';end if;
 result=public.zzws_submit_order_v2(p_user,p_request,p_delivery_variant,p_profile_revision,p_delivery,p_lines,p_total);
 checked=checked||jsonb_build_object('orderRevision',(result->>'revision')::integer);
 insert into public.zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context) values((result->>'id')::uuid,(result->>'revision')::integer,1,(checked->>'catalogVersion')::uuid,(checked->>'rulesRevision')::uuid,checked->>'clientCategory',(checked->>'profileRevision')::bigint,p_lines,p_total,checked);
 return result;
end $$;

create function public.zzws_update_order_v3(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_context jsonb,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.zzws_orders;result jsonb;checked jsonb;owner uuid;changed boolean;begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager')) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select user_id into owner from public.zzws_orders where id=p_order;if owner is not null then perform public.zzws_receipt_state(owner);end if;
 -- Profile then catalogue then order: same order as submission; gate serializes receipt writers.
 if owner is not null then perform 1 from public.zzws_users where id=owner for share;end if;
 select * into old from public.zzws_orders where id=p_order;if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 changed=old.lines is distinct from p_lines or old.total is distinct from p_total;
 if changed then checked=public.zzws_validate_calculation(owner,p_context,p_lines,p_total);end if;
 result=public.zzws_update_order(p_order,p_revision,p_lines,p_status,p_comment,p_total,p_detail,p_actor,p_draft,p_delivery,p_confirmation);
 if changed then
  checked=checked||jsonb_build_object('orderRevision',(result->>'revision')::integer);
  insert into public.zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context) values(p_order,(result->>'revision')::integer,1,(checked->>'catalogVersion')::uuid,(checked->>'rulesRevision')::uuid,checked->>'clientCategory',(checked->>'profileRevision')::bigint,p_lines,p_total,checked);
 end if;
 return result;
end $$;

-- The backup endpoint is already restricted to its dedicated server-side maintenance token.
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_calculation;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_set(public.zzws_application_snapshot_before_calculation(),'{tables,order_calculation_contexts}',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_calculation_contexts t));
$$;
-- Preserve the existing storage UI: private evidence counts towards the existing Orders section.
alter function public.zzws_storage_report() rename to zzws_storage_report_before_calculation;
create function public.zzws_storage_report() returns jsonb language plpgsql security invoker set search_path='' as $$
declare report jsonb;people jsonb='[]';person jsonb;extra bigint;physical bigint;begin
 report=public.zzws_storage_report_before_calculation();
 for person in select value from jsonb_array_elements(report->'users') loop
  select coalesce(sum(octet_length(convert_to(to_jsonb(c)::text,'UTF8'))),0) into extra from public.zzws_order_calculation_contexts c join public.zzws_orders o on o.id=c.order_id where o.user_id=(person->>'id')::uuid;
  person=jsonb_set(person,'{sections,orders,bytes}',to_jsonb(coalesce((person#>>'{sections,orders,bytes}')::bigint,0)+extra));people=people||jsonb_build_array(person);
 end loop;
 physical=pg_total_relation_size('public.zzws_order_calculation_contexts'::regclass);
 return report||jsonb_build_object('users',people,'userTablesBytes',(report->>'userTablesBytes')::bigint+physical,'systemDatabaseBytes',greatest(0,(report->>'databaseBytes')::bigint-(report->>'userTablesBytes')::bigint-physical));
end $$;
revoke all on function public.zzws_validate_calculation(uuid,jsonb,jsonb,numeric),public.zzws_calculation_guard(),public.zzws_submit_order_v3(uuid,uuid,uuid,bigint,jsonb,jsonb,numeric,jsonb),public.zzws_update_order_v3(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_application_snapshot(),public.zzws_storage_report() from public,anon,authenticated;
grant execute on function public.zzws_validate_calculation(uuid,jsonb,jsonb,numeric),public.zzws_calculation_guard(),public.zzws_submit_order_v3(uuid,uuid,uuid,bigint,jsonb,jsonb,numeric,jsonb),public.zzws_update_order_v3(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_application_snapshot(),public.zzws_storage_report() to service_role;
commit;
