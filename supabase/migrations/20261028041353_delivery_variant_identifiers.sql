-- PREPARATION ONLY. Requires the existing ZZWS schema; not applied to production.
begin;
alter table public.zzws_users add column profile_revision bigint not null default 1;

create function public.zzws_delivery_reconcile(p_old jsonb,p_rows jsonb,p_mode text,p_preserve boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb;m jsonb;result jsonb='[]';used text[]='{}';pending integer[]='{}';matches integer;idx integer=0;identity jsonb;rid text;
begin
 if jsonb_typeof(p_old) is distinct from 'array' or jsonb_typeof(p_rows) is distinct from 'array' or p_mode is null or p_mode not in ('manual','import') then raise sqlstate 'PT400' using message='Առաքման տարբերակների սխալ ձևաչափ';end if;
 if jsonb_array_length(p_rows)>3 then raise sqlstate 'PT400' using message='Առաքման տարբերակների սխալ ձևաչափ';end if;
 if p_mode='import' and p_preserve and jsonb_array_length(p_old)>0 then
  if jsonb_array_length(p_rows)<>1 or (p_rows->0)-'id' is distinct from (p_old->0)-'id' or (select count(*) from jsonb_array_elements(p_old) x where x-'id'=(p_rows->0)-'id')<>1 then raise sqlstate 'PT409' using message='Առաքման տարբերակները միանշանակ չեն համընկնում';end if;
  return jsonb_build_array((p_rows->0)||jsonb_build_object('id',p_old->0->>'id'))||(select coalesce(jsonb_agg(x.value order by x.ordinality),'[]') from jsonb_array_elements(p_old) with ordinality x where x.ordinality>1);
 end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r) is distinct from 'object' or exists(select 1 from unnest(array['organization','address','contact']) k where jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>300) then raise sqlstate 'PT400' using message='Առաքման տարբերակի սխալ տվյալներ';end if;
  rid=null;
  if p_mode='manual' then
   if coalesce(r->>'id','')<>'' then
    select value into m from jsonb_array_elements(p_old) where value->>'id'=r->>'id';if not found then raise sqlstate 'PT409' using message='Առաքման տարբերակը չի պատկանում հաճախորդին';end if;rid=m->>'id';
   else rid=gen_random_uuid()::text;end if;
  else
   if coalesce(r->>'id','')<>'' then raise sqlstate 'PT400' using message='Ներմուծման տողը չպետք է պարունակի նոր նույնացուցիչ';end if;
   select count(*),min(value->>'id') into matches,rid from jsonb_array_elements(p_old) where value-'id'=r-'id';
   if matches>1 then raise sqlstate 'PT409' using message='Առաքման տարբերակները միանշանակ չեն համընկնում';end if;
   if matches=0 then pending=array_append(pending,idx);end if;
  end if;
  if rid is not null then if rid=any(used) then raise sqlstate 'PT409' using message='Կրկնվող առաքման տարբերակ';end if;used=array_append(used,rid);end if;
  result=result||jsonb_build_array((r-'id')||case when rid is null then '{}'::jsonb else jsonb_build_object('id',rid) end);idx=idx+1;
 end loop;
 if p_mode='import' and cardinality(pending)>0 and exists(select 1 from jsonb_array_elements(p_old) where not(value->>'id'=any(used))) then raise sqlstate 'PT409' using message='Առաքման տարբերակները միանշանակ չեն համընկնում';end if;
 foreach idx in array pending loop result=jsonb_set(result,array[idx::text,'id'],to_jsonb(gen_random_uuid()::text));end loop;
 return result;
end $$;

-- Preserve every business value and list position. Only append missing identifiers.
do $$ declare u record;r jsonb;rows jsonb;seen text[];rid text;begin
 for u in select id,profile from public.zzws_users for update loop
  if jsonb_typeof(u.profile->'rowsList') is distinct from 'array' then raise exception 'Delivery backfill requires an explicit list';end if;
  rows='[]';seen='{}';
  for r in select value from jsonb_array_elements(u.profile->'rowsList') loop
   rid=coalesce(nullif(r->>'id',''),gen_random_uuid()::text);
   if rid!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or rid=any(seen) then raise exception 'Delivery backfill needs manual review';end if;
   seen=array_append(seen,rid);rows=rows||jsonb_build_array(r||jsonb_build_object('id',rid));
  end loop;
  update public.zzws_users set profile=jsonb_set(profile,'{rowsList}',rows) where id=u.id;
 end loop;
end $$;

create function public.zzws_profile_revision_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare r jsonb;seen text[]='{}';rows jsonb;begin
 rows=new.profile->'rowsList';
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>3 then raise sqlstate 'PT400' using message='Առաքման տարբերակների սխալ ձևաչափ';end if;
 if exists(select 1 from jsonb_array_elements(rows) where coalesce(value->>'id','')='') then
  rows=public.zzws_delivery_reconcile(case when tg_op='INSERT' then '[]'::jsonb else old.profile->'rowsList' end,rows,case when tg_op='INSERT' then 'manual' else 'import' end,false);
  new.profile=jsonb_set(new.profile,'{rowsList}',rows);
 end if;
 if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows)>3 then raise sqlstate 'PT400' using message='Առաքման տարբերակների սխալ ձևաչափ';end if;
 for r in select value from jsonb_array_elements(rows) loop
  if coalesce(r->>'id','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or r->>'id'=any(seen) then raise sqlstate 'PT400' using message='Առաքման տարբերակի սխալ նույնացուցիչ';end if;seen=array_append(seen,r->>'id');
 end loop;
 if tg_op='UPDATE' then new.profile_revision=old.profile_revision+case when new.profile is distinct from old.profile or new.login is distinct from old.login or new.active is distinct from old.active then 1 else 0 end;else new.profile_revision=1;end if;
 return new;
end $$;
create trigger zzws_profile_revision_guard before insert or update on public.zzws_users for each row execute function public.zzws_profile_revision_guard();

create function public.zzws_delivery_owned(p_user uuid,p_variant uuid,p_revision bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare u public.zzws_users;r jsonb;begin
 select * into u from public.zzws_users where id=p_user and active for share;if not found then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 if u.profile_revision is distinct from p_revision then raise sqlstate 'PT409' using message='Հաճախորդի տվյալներն արդեն փոխվել են';end if;
 select value into r from jsonb_array_elements(u.profile->'rowsList') where value->>'id'=p_variant::text;if not found then raise sqlstate 'PT403' using message='Առաքման տարբերակը հասանելի չէ';end if;return r;
end $$;

-- Preserve the existing audited persistence implementation behind a checked entry point.
alter function public.zzws_save_user(uuid,text,jsonb,boolean,uuid) rename to zzws_save_user_stage1_legacy;
create function public.zzws_save_user_v2(p_id uuid,p_login text,p_profile jsonb,p_active boolean,p_actor uuid,p_expected bigint) returns void language plpgsql security invoker set search_path='' as $$
declare old public.zzws_users;begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into old from public.zzws_users where id=p_id for update;
 if old.id is not null and old.profile_revision is distinct from p_expected then raise sqlstate 'PT409' using message='Հաճախորդի տվյալներն արդեն փոխվել են';end if;
 p_profile=jsonb_set(p_profile,'{rowsList}',public.zzws_delivery_reconcile(coalesce(old.profile->'rowsList','[]'),p_profile->'rowsList','manual',false));
 perform public.zzws_save_user_stage1_legacy(p_id,p_login,p_profile,p_active,p_actor);
end $$;
create function public.zzws_save_user(p_id uuid,p_login text,p_profile jsonb,p_active boolean,p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare old public.zzws_users;begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into old from public.zzws_users where id=p_id for update;
 p_profile=jsonb_set(p_profile,'{rowsList}',public.zzws_delivery_reconcile(coalesce(old.profile->'rowsList','[]'),p_profile->'rowsList','import',false));
 perform public.zzws_save_user_stage1_legacy(p_id,p_login,p_profile,p_active,p_actor);
end $$;

create function public.zzws_import_users_v2(p_draft uuid,p_actor uuid,p_users jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb;old public.zzws_users;prepared jsonb='[]';profile jsonb;begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 perform 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='users' and expires>now() for update;if not found then raise sqlstate 'PT409' using message='Ներմուծման նախադիտման ժամկետը լրացել է';end if;
 for item in select value from jsonb_array_elements(p_users) loop
  select * into old from public.zzws_users where login=item->>'login' for update;
  if old.id is not null and (old.id::text is distinct from item->>'expectedUserId' or old.profile_revision is distinct from (item->>'expectedProfileRevision')::bigint) or old.id is null and nullif(item->>'expectedUserId','') is not null then raise sqlstate 'PT409' using message='Հաճախորդի տվյալներն արդեն փոխվել են';end if;
  profile=jsonb_set(item->'profile','{rowsList}',public.zzws_delivery_reconcile(coalesce(old.profile->'rowsList','[]'),item->'profile'->'rowsList','import',coalesce((item->>'preserveExtraContacts')::boolean,false)));
  prepared=prepared||jsonb_build_array(item||jsonb_build_object('profile',profile,'preserveExtraContacts',false));
 end loop;
 -- Existing import updates every client in one transaction and keeps administrative protections.
 perform public.zzws_import_users(p_draft,p_actor,prepared);
end $$;

revoke all on function public.zzws_delivery_reconcile(jsonb,jsonb,text,boolean),public.zzws_profile_revision_guard(),public.zzws_delivery_owned(uuid,uuid,bigint),public.zzws_save_user(uuid,text,jsonb,boolean,uuid),public.zzws_save_user_v2(uuid,text,jsonb,boolean,uuid,bigint),public.zzws_import_users_v2(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_delivery_reconcile(jsonb,jsonb,text,boolean),public.zzws_profile_revision_guard(),public.zzws_delivery_owned(uuid,uuid,bigint),public.zzws_save_user(uuid,text,jsonb,boolean,uuid),public.zzws_save_user_v2(uuid,text,jsonb,boolean,uuid,bigint),public.zzws_import_users_v2(uuid,uuid,jsonb) to service_role;
commit;
