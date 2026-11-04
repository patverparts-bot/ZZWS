-- Local preparation only. Extend the installed maintenance implementation;
-- do not replace it with an older full copy or activate other deferred work.
begin;

-- Keep the original routine OIDs: already-planned callers must also see the
-- extended implementation. Copy reviewed bodies to internal helpers instead
-- of renaming the routines that callers may already reference.
do $copy_routines$
declare item record;definition text;prefix text;
begin
 for item in select * from (values
  ('zzws_maintenance_private.allowed_tables()','zzws_maintenance_private.allowed_tables','zzws_maintenance_private.allowed_tables_before_buyer_offers'),
  ('zzws_maintenance_private.table_plan(text[],uuid)','zzws_maintenance_private.table_plan','zzws_maintenance_private.table_plan_before_buyer_offers'),
  ('public.zzws_application_snapshot()','public.zzws_application_snapshot','public.zzws_application_snapshot_before_buyer_offers')
 ) names(signature,original_name,saved_name) loop
  definition:=pg_catalog.pg_get_functiondef(item.signature::regprocedure);
  prefix:='CREATE OR REPLACE FUNCTION '||item.original_name||'(';
  if left(definition,length(prefix))<>prefix then raise exception 'Review buyer offer lifecycle routine %',item.signature;end if;
  execute overlay(definition placing 'CREATE OR REPLACE FUNCTION '||item.saved_name||'(' from 1 for length(prefix));
 end loop;
end $copy_routines$;

create or replace function zzws_maintenance_private.allowed_tables() returns text[]
language sql immutable set search_path='' as $$
 select array(select distinct value from unnest(zzws_maintenance_private.allowed_tables_before_buyer_offers()||array['buyer_offers']) value order by value);
$$;

create or replace function zzws_maintenance_private.table_plan(p_selected text[],p_protected uuid)
returns table(name text,condition text,rank integer) language plpgsql stable set search_path='' as $$
begin
 return query select * from zzws_maintenance_private.table_plan_before_buyer_offers(p_selected,p_protected);
 -- Buyer offers are not orders. Explicit workspace/catalogue/full cleanup
 -- includes them; customer scope follows the existing FK descendant closure.
 if 'full-reset'=any(p_selected) or 'workspace'=any(p_selected) or 'catalog'=any(p_selected) then
  return query select 'buyer_offers'::text,'true'::text,40;
 end if;
end $$;

-- Preserve the exact installed restore implementation and its ACLs. Its
-- explicit table whitelist is extended once, with a fail-closed shape check.
do $extend_restore$
declare signature text;definition text;parts text[];matched text[];count_matches integer;
begin
 foreach signature in array array[
  'zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb)',
  'zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb)'
 ] loop
  definition:=pg_catalog.pg_get_functiondef(signature::regprocedure);
  count_matches:=0;
  for parts in select regexp_matches(definition,'(allowed\s+constant\s+text\[\]\s*:=\s*array\[)([^;]*)(\];)','gi') loop
   count_matches:=count_matches+1;matched:=parts;
  end loop;
  if count_matches<>1 then raise exception 'Review buyer offer restore whitelist for %',signature;end if;
  if position('''buyer_offers''' in matched[2])=0 then
   execute replace(definition,matched[1]||matched[2]||matched[3],matched[1]||matched[2]||',''buyer_offers'''||matched[3]);
  end if;
 end loop;
end $extend_restore$;

create or replace function public.zzws_application_snapshot() returns jsonb
language sql security invoker set search_path='' set statement_timeout='60s' as $$
 select jsonb_set(public.zzws_application_snapshot_before_buyer_offers(),'{tables,buyer_offers}',
  coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.zzws_buyer_offers t),'[]'::jsonb));
$$;

do $guard$
declare existing oid;
begin
 select t.tgfoid into existing from pg_catalog.pg_trigger t
 where t.tgrelid='public.zzws_buyer_offers'::regclass and t.tgname='zzws_maintenance_write_guard';
 if found then
  if existing<>'public.zzws_maintenance_write_guard()'::regprocedure then raise exception 'Unexpected buyer offer maintenance trigger';end if;
 else
  create trigger zzws_maintenance_write_guard before insert or update or delete on public.zzws_buyer_offers
   for each row execute function public.zzws_maintenance_write_guard();
 end if;
end $guard$;

revoke all on function zzws_maintenance_private.allowed_tables(),zzws_maintenance_private.allowed_tables_before_buyer_offers(),
 zzws_maintenance_private.table_plan(text[],uuid),zzws_maintenance_private.table_plan_before_buyer_offers(text[],uuid) from public,anon,authenticated,service_role;
revoke all on function public.zzws_application_snapshot(),public.zzws_application_snapshot_before_buyer_offers() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot(),public.zzws_application_snapshot_before_buyer_offers() to service_role;
notify pgrst,'reload schema';
commit;
