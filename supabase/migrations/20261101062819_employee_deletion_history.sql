begin;
alter table public.zzws_users add column deleted_by uuid;
alter table public.zzws_users add column deletion_actor jsonb;

create or replace function public.zzws_account_sync() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_id is null and (new.profile is distinct from old.profile or new.active is distinct from old.active) then
  if exists(select 1 from public.zzws_users where customer_id=new.id) and new.profile->>'role'<>'client' then raise sqlstate 'PT403';end if;
  update public.zzws_users set profile=new.profile where customer_id=new.id and deleted_at is null and profile is distinct from new.profile;
  if not new.active then delete from public.zzws_sessions where user_id in(select id from public.zzws_users where customer_id=new.id);end if;
 end if;
 return null;
end $$;

create or replace function public.zzws_team_create(p_manager uuid,p_user uuid,p_login text,p_label text) returns void language plpgsql security invoker set search_path='' as $$
declare root public.zzws_users;begin
 select * into root from public.zzws_users where id=p_manager and active and customer_id is null and profile->>'role'='client' and not needs_password_setup and not needs_profile_setup for update;
 if root.id is null then raise sqlstate 'PT403';end if;
 if (select count(*) from public.zzws_users where customer_id=root.id and deleted_at is null)>=200 then raise sqlstate 'PT400';end if;
 insert into public.zzws_users(id,login,profile,active,customer_id,person,needs_profile_setup) values(p_user,p_login,root.profile,true,root.id,jsonb_build_object('label',left(p_label,200)),true);
 insert into public.zzws_audit(actor,action,detail) values(p_manager,'employee_invite',jsonb_build_object('customerId',root.id,'employeeId',p_user)::text);
end $$;

create or replace function public.zzws_delete_customer(p_actor uuid,p_hash text,p_customer uuid,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare target public.zzws_users; members uuid[]; deleted_time timestamptz=clock_timestamp();
begin
 perform 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id join public.zzws_sessions a on a.user_id=u.id
 where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner' and a.hash=p_hash and a.expires>now() and not a.setup_only and a.confirmed_until>now() for share of u,s,a;
 if not found then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into target from public.zzws_users where id=p_customer for update;
 if target.id is null or target.deleted_at is not null then raise sqlstate 'PT404' using message='Հաճախորդը չի գտնվել';end if;
 if target.profile->>'role' is distinct from 'client' or target.customer_id is not null or target.id=p_actor then raise sqlstate 'PT403' using message='Ընտրեք հաճախորդի գլխավոր քարտը';end if;
 if p_expected is null or target.profile_revision<>p_expected then raise sqlstate 'PT409' using message='Հաճախորդի տվյալներն արդեն փոխվել են։ Վերաբացեք քարտը';end if;
 -- Invitations and order creation lock this same root; concurrent requests finish
 -- before deletion or observe disabled access after the transaction commits.
 perform 1 from public.zzws_users where customer_id=target.id order by id for update;
 select array_agg(id) into members from public.zzws_users where id=target.id or customer_id=target.id;
 delete from public.zzws_sessions where user_id=any(members);
 delete from public.zzws_invitations where user_id=any(members);
 update public.zzws_users set active=false,deleted_at=deleted_time where id=any(members) and deleted_at is null;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_delete',jsonb_build_object('target',jsonb_build_object('id',target.id,'login',target.login,'client',target.profile->>'client','customerCode',target.profile->>'customerCode'),'accounts',cardinality(members),'historyPreserved',true)::text);
 return jsonb_build_object('ok',true,'accounts',cardinality(members));
end $$;
create function public.zzws_team_delete(p_manager uuid,p_hash text,p_employee uuid,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare manager public.zzws_users;employee public.zzws_users;actor jsonb;
begin
 select * into manager from public.zzws_users where id=p_manager and active and deleted_at is null and archived_at is null and customer_id is null and profile->>'role'='client' and not needs_password_setup and not needs_profile_setup for update;
 if manager.id is null then raise sqlstate 'PT403';end if;
 perform 1 from public.zzws_sessions where hash=p_hash and user_id=p_manager and expires>now() and confirmed_until>now() and not setup_only for share;
 if not found then raise sqlstate 'PT403';end if;
 select * into employee from public.zzws_users where id=p_employee and customer_id=manager.id and deleted_at is null for update;
 if employee.id is null then raise sqlstate 'PT404';end if;
 if employee.archived_at is not null or p_expected is null or employee.profile_revision<>p_expected then raise sqlstate 'PT409';end if;
 actor=jsonb_build_object('id',manager.id,'login',manager.login,'name',coalesce(nullif(concat_ws(' ',manager.person->>'firstName',manager.person->>'lastName'),''),manager.login));
 delete from public.zzws_sessions where user_id=employee.id;
 delete from public.zzws_invitations where user_id=employee.id;
 update public.zzws_users set active=false,deleted_at=clock_timestamp(),deleted_by=manager.id,deletion_actor=actor where id=employee.id;
 insert into public.zzws_audit(actor,action,detail) values(manager.id,'employee_delete',jsonb_build_object('customerId',manager.id,'employeeId',employee.id,'employee',employee.person,'login',employee.login,'deletedBy',actor)::text);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.zzws_team_delete(uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.zzws_team_delete(uuid,text,uuid,bigint) to service_role;
commit;
