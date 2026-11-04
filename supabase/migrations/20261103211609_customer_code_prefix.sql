-- Keep the full customer label and every existing UUID relationship unchanged.
begin;
create function public.zzws_customer_code_key(p_value text) returns text
language sql immutable parallel safe security invoker set search_path='' as $$
 select case when btrim(coalesce(p_value,'')) ~ '^[0-9]{6}'
   then left(btrim(p_value),6) else lower(btrim(coalesce(p_value,''))) end
$$;
revoke all on function public.zzws_customer_code_key(text) from public,anon,authenticated;
grant execute on function public.zzws_customer_code_key(text) to service_role;

-- Do not merge customers or silently reassign a shared six-digit prefix.
do $$ begin
 if exists (
  select 1 from public.zzws_users
  where deleted_at is null and customer_id is null and profile->>'role'='client'
   and coalesce(profile->>'customerCode','')<>''
  group by public.zzws_customer_code_key(profile->>'customerCode') having count(*)>1
 ) then
  raise exception 'Customer code prefixes are not unique; resolve the existing conflicts before applying this migration' using errcode='23505';
 end if;
end $$;
drop index public.zzws_customer_code_unique;
create unique index zzws_customer_code_unique on public.zzws_users(public.zzws_customer_code_key(profile->>'customerCode'))
 where deleted_at is null and customer_id is null and profile->>'role'='client' and coalesce(profile->>'customerCode','')<>'';
commit;
