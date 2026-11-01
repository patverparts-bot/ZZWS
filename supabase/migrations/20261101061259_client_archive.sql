begin;
alter table public.zzws_users add column archived_at timestamptz;
alter table public.zzws_users add column archive_reason text;
alter table public.zzws_users add column archived_by uuid;
alter table public.zzws_users add column archive_actor text;
alter table public.zzws_users add column archive_active boolean;
create index zzws_archived_customers on public.zzws_users(archived_at desc,id) where archived_at is not null and customer_id is null and deleted_at is null;

create function public.zzws_archive_account_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare authorized boolean=coalesce(current_setting('zzws.archive_customer',true),'')=coalesce(new.customer_id,new.id)::text;
begin
 if tg_op='UPDATE' then
  if (old.archived_at is not null or new.archived_at is distinct from old.archived_at or new.archive_reason is distinct from old.archive_reason or new.archive_active is distinct from old.archive_active or new.archived_by is distinct from old.archived_by or new.archive_actor is distinct from old.archive_actor) and not authorized then
   raise sqlstate 'PT409' using message='Հաճախորդն արխիվում է։ Օգտագործեք արխիվից վերականգնելու գործողությունը';
  end if;
 end if;
 if new.archived_at is not null and (new.active or new.deleted_at is not null or new.profile->>'role' is distinct from 'client' or new.archive_active is null or coalesce(length(btrim(new.archive_reason)),0) not between 3 and 1000) then raise sqlstate 'PT409' using message='Ստուգեք հաճախորդի արխիվի տվյալները';end if;
 return new;
end $$;
create trigger zzws_archive_account_guard before insert or update on public.zzws_users for each row execute function public.zzws_archive_account_guard();
create function public.zzws_archive_revision_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived_at is distinct from old.archived_at then new.profile_revision=old.profile_revision+1;end if;
 return new;
end $$;
-- Runs after the existing profile revision trigger, including already disabled roots.
create trigger zzws_zz_archive_revision before update on public.zzws_users for each row execute function public.zzws_archive_revision_guard();

create function public.zzws_archive_customer(p_actor uuid,p_hash text,p_customer uuid,p_expected bigint,p_reason text,p_restore boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.zzws_users;actor public.zzws_users;members uuid[];event_reason text;stamp timestamptz=clock_timestamp();
begin
 select u.* into actor from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id join public.zzws_sessions a on a.user_id=u.id
 where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner' and a.hash=p_hash and a.expires>now() and not a.setup_only and a.confirmed_until>now() for share of u,s,a;
 if actor.id is null then raise sqlstate 'PT403';end if;
 select * into target from public.zzws_users where id=p_customer for update;
 if target.id is null or target.deleted_at is not null then raise sqlstate 'PT404';end if;
 if target.customer_id is not null or target.profile->>'role' is distinct from 'client' then raise sqlstate 'PT403';end if;
 if p_expected is null or target.profile_revision<>p_expected then raise sqlstate 'PT409';end if;
 if (p_restore and target.archived_at is null) or (not p_restore and target.archived_at is not null) then raise sqlstate 'PT409';end if;
 event_reason=case when p_restore then target.archive_reason else btrim(p_reason) end;
 if not p_restore and (coalesce(length(event_reason),0) not between 3 and 1000 or event_reason~'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]') then raise sqlstate 'PT400';end if;
 perform 1 from public.zzws_users where customer_id=target.id and deleted_at is null order by id for update;
 select array_agg(id) into members from public.zzws_users where (id=target.id or customer_id=target.id) and deleted_at is null;
 perform set_config('zzws.archive_customer',target.id::text,true);
 delete from public.zzws_sessions where user_id=any(members);
 delete from public.zzws_invitations where user_id=any(members);
 if p_restore then
  update public.zzws_users set active=coalesce(archive_active,false),archived_at=null,archive_reason=null,archived_by=null,archive_actor=null,archive_active=null where id=any(members) and archived_at=target.archived_at;
 else
  update public.zzws_users set archive_active=active,active=false,archived_at=stamp,archive_reason=event_reason,archived_by=p_actor,archive_actor=coalesce(nullif(actor.profile->>'client',''),actor.login) where id=any(members);
 end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,case when p_restore then 'customer_restore' else 'customer_archive' end,jsonb_build_object('actor',jsonb_build_object('id',actor.id,'login',actor.login,'client',actor.profile->>'client'),'target',jsonb_build_object('id',target.id,'login',target.login,'client',target.profile->>'client','customerCode',target.profile->>'customerCode'),'reason',event_reason,'accounts',cardinality(members))::text);
 return jsonb_build_object('ok',true,'accounts',cardinality(members));
end $$;

create function public.zzws_customer_archive_list(p_query text default '',p_offset integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
 with matches as materialized(
  select u.id,u.profile->>'client' client,u.profile->>'customerCode' code,u.profile_revision,u.archived_at,u.archive_reason,u.archive_actor,u.archive_active,
   (select count(*) from public.zzws_users e where e.customer_id=u.id and e.deleted_at is null) employees
  from public.zzws_users u where u.deleted_at is null and u.archived_at is not null and u.customer_id is null and u.profile->>'role'='client'
  and (coalesce(p_query,'')='' or concat_ws(' ',u.profile->>'client',u.profile->>'customerCode',u.archive_reason,u.archive_actor) ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%')
 ), page as(select * from matches order by archived_at desc,id limit 50 offset greatest(0,least(p_offset,100000)))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'client',client,'customerCode',code,'profileRevision',profile_revision,'archivedAt',archived_at,'archiveReason',archive_reason,'archivedBy',archive_actor,'wasActive',archive_active,'employees',employees)) from page),'[]'::jsonb),'total',(select count(*) from matches),'limit',50,'offset',greatest(0,least(p_offset,100000)));
$$;
revoke all on function public.zzws_archive_account_guard(),public.zzws_archive_revision_guard(),public.zzws_archive_customer(uuid,text,uuid,bigint,text,boolean),public.zzws_customer_archive_list(text,integer) from public,anon,authenticated;
grant execute on function public.zzws_archive_account_guard(),public.zzws_archive_revision_guard(),public.zzws_archive_customer(uuid,text,uuid,bigint,text,boolean),public.zzws_customer_archive_list(text,integer) to service_role;
commit;
