begin;

-- Internal credential recovery, never an exposed RPC. The owner-authorized job
-- engine is the only caller. No service/public role gets schema/function access.
create schema if not exists zzws_maintenance_private;
revoke all on schema zzws_maintenance_private from public,anon,authenticated,service_role;

create or replace function zzws_maintenance_private.auth_guard(p_ids uuid[],p_protected uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_protected is null or not exists(
   select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id
   where u.id=p_protected and u.active and u.profile->>'role'='admin' and s.scope='owner'
 ) then raise sqlstate 'PT403' using message='Protected owner is unavailable'; end if;
 if p_ids is null or cardinality(p_ids)>100000 or array_position(p_ids,null) is not null
    or p_protected=any(p_ids)
    or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x)
 then raise sqlstate 'PT400' using message='Invalid credential scope'; end if;
end $$;

create or replace function zzws_maintenance_private.auth_schema(p_table text)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated,'identity',a.attidentity) order by a.attnum),'[]'::jsonb)
 from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass('auth.'||p_table)
 and a.attnum>0 and not a.attisdropped;
$$;

create or replace function zzws_maintenance_private.auth_snapshot(p_ids uuid[],p_protected uuid)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare name text; rows jsonb; tables jsonb:='{}'; schemas jsonb:='{}'; count_users integer;
begin
 perform zzws_maintenance_private.auth_guard(p_ids,p_protected);
 select count(*) into count_users from auth.users where id=any(p_ids);
 if count_users<>cardinality(p_ids) then raise sqlstate 'PT409' using message='Credential scope changed'; end if;
 foreach name in array array['users','identities','mfa_factors','mfa_recovery_code_sets','webauthn_credentials'] loop
  if pg_catalog.to_regclass('auth.'||name) is null then continue; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from auth.%I t where %I=any($1)',name,case when name='users' then 'id' else 'user_id' end)
   into rows using p_ids;
  -- Expired sessions and one-time challenges are not credentials. Restore must
  -- require a new login and cannot revive a historical password-reset link.
  if name='users' then
   select coalesce(jsonb_agg(value||(
    select coalesce(jsonb_object_agg(key,case when key like '%_at' then 'null'::jsonb when key='email_change_confirm_status' then '0'::jsonb else '""'::jsonb end),'{}'::jsonb)
    from jsonb_each(value) where key=any(array['confirmation_token','recovery_token','email_change_token_new','email_change_token_current','phone_change_token','reauthentication_token','email_change','phone_change','confirmation_sent_at','recovery_sent_at','email_change_sent_at','phone_change_sent_at','reauthentication_sent_at','email_change_confirm_status'])
   )),'[]'::jsonb) into rows from jsonb_array_elements(rows);
  elsif name='mfa_factors' then
   select coalesce(jsonb_agg(value||(
    select coalesce(jsonb_object_agg(key,'null'::jsonb),'{}'::jsonb) from jsonb_each(value)
    where key in ('last_challenged_at','last_webauthn_challenge_data')
   )),'[]'::jsonb) into rows from jsonb_array_elements(rows);
  end if;
  tables:=tables||jsonb_build_object(name,rows);
  schemas:=schemas||jsonb_build_object(name,zzws_maintenance_private.auth_schema(name));
 end loop;
 return jsonb_build_object('format','zzws-auth-credentials-v1','protectedOwner',p_protected,'userIds',to_jsonb(p_ids),'tables',tables,'schemas',schemas,'sessionsRestored',false,'oneTimeTokensRestored',false);
end $$;

create or replace function zzws_maintenance_private.auth_validate(p_snapshot jsonb,p_protected uuid)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare ids uuid[]; name text; rows jsonb; row jsonb; allowed text[]; count_users integer;
begin
 if p_snapshot->>'format' is distinct from 'zzws-auth-credentials-v1' or p_snapshot->>'protectedOwner' is distinct from p_protected::text
    or jsonb_typeof(p_snapshot->'userIds') is distinct from 'array' or jsonb_typeof(p_snapshot->'tables') is distinct from 'object'
    or jsonb_typeof(p_snapshot->'schemas') is distinct from 'object'
 then raise sqlstate 'PT400' using message='Invalid credential archive'; end if;
 select coalesce(array_agg(value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(p_snapshot->'userIds');
 perform zzws_maintenance_private.auth_guard(ids,p_protected);
 foreach name in array array['users','identities','mfa_factors','mfa_recovery_code_sets','webauthn_credentials'] loop
  if pg_catalog.to_regclass('auth.'||name) is null then
   if p_snapshot->'tables' ? name then raise sqlstate 'PT409' using message='Credential schema changed'; end if;
   continue;
  end if;
  rows:=p_snapshot->'tables'->name;
  if jsonb_typeof(rows) is distinct from 'array'
    or p_snapshot->'schemas'->name is distinct from zzws_maintenance_private.auth_schema(name)
  then raise sqlstate 'PT409' using message='Credential schema changed'; end if;
  select array_agg(value->>'name') into allowed from jsonb_array_elements(p_snapshot->'schemas'->name);
  for row in select value from jsonb_array_elements(rows) loop
   if jsonb_typeof(row) is distinct from 'object' or exists(select 1 from jsonb_object_keys(row) k where not k=any(allowed))
      or (select count(*) from jsonb_object_keys(row))<>cardinality(allowed)
      or not coalesce((row->>case when name='users' then 'id' else 'user_id' end)::uuid=any(ids),false)
   then raise sqlstate 'PT400' using message='Credential record outside archive scope'; end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_snapshot->'tables') k(key) where k.key<>all(array['users','identities','mfa_factors','mfa_recovery_code_sets','webauthn_credentials']))
 then raise sqlstate 'PT400' using message='Unknown credential table'; end if;
 select count(distinct (value->>'id')::uuid) into count_users from jsonb_array_elements(p_snapshot->'tables'->'users');
 if count_users<>cardinality(ids) or jsonb_array_length(p_snapshot->'tables'->'users')<>cardinality(ids)
 then raise sqlstate 'PT400' using message='Incomplete credential archive'; end if;
 return ids;
end $$;

create or replace function zzws_maintenance_private.auth_delete(p_ids uuid[],p_protected uuid)
returns integer language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare removed integer;
begin
 perform zzws_maintenance_private.auth_guard(p_ids,p_protected);
 -- Application dependency rows must already have been archived and removed by
 -- the calling transaction. Never silently cascade an unarchived user profile.
 if exists(select 1 from public.zzws_users where id=any(p_ids)) then
  raise sqlstate 'PT409' using message='Application account dependencies remain';
 end if;
 delete from auth.users where id=any(p_ids) and id<>p_protected;
 get diagnostics removed=row_count;
 return removed;
end $$;

create or replace function zzws_maintenance_private.auth_restore(p_snapshot jsonb,p_protected uuid)
returns integer language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare ids uuid[]; name text; columns_sql text; values_sql text; rows jsonb; restored integer:=0;
begin
 ids:=zzws_maintenance_private.auth_validate(p_snapshot,p_protected);
 if exists(select 1 from auth.users where id=any(ids)) then
  raise sqlstate 'PT409' using message='Credential account already exists';
 end if;
 foreach name in array array['users','identities','mfa_factors','mfa_recovery_code_sets','webauthn_credentials'] loop
  if pg_catalog.to_regclass('auth.'||name) is null then continue; end if;
  rows:=p_snapshot->'tables'->name;
  -- Only real non-generated columns from this database may enter INSERT.
  select string_agg(format('%I',a.attname),',' order by a.attnum),string_agg(format('r.%I',a.attname),',' order by a.attnum)
   into columns_sql,values_sql from pg_catalog.pg_attribute a
   where a.attrelid=pg_catalog.to_regclass('auth.'||name) and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  execute format('insert into auth.%I(%s) overriding system value select %s from jsonb_populate_recordset(null::auth.%I,$1) r',name,columns_sql,values_sql,name) using rows;
  if name='users' then get diagnostics restored=row_count; end if;
 end loop;
 return restored;
end $$;

revoke all on all functions in schema zzws_maintenance_private from public,anon,authenticated,service_role;
commit;
