-- Forward-only transition. Keeps existing user IDs, credentials, memory and history.
begin;
alter table public.zzws_users add column customer_id uuid references public.zzws_users(id) on delete restrict;
alter table public.zzws_users add column person jsonb not null default '{}';
alter table public.zzws_users add column needs_profile_setup boolean not null default false;
alter table public.zzws_users add column last_login timestamptz;
update public.zzws_users set profile=profile||jsonb_build_object('customerCode',case when login~'^[0-9]+$' then login else '' end),needs_profile_setup=true where profile->>'role'='client';
create index zzws_team_customer on public.zzws_users(customer_id);
create unique index zzws_customer_code_unique on public.zzws_users(lower(profile->>'customerCode')) where customer_id is null and profile->>'role'='client' and coalesce(profile->>'customerCode','')<>'';

create function public.zzws_account_inherit() returns trigger language plpgsql security invoker set search_path='' as $$
declare root public.zzws_users;begin
 if tg_op='UPDATE' and new.customer_id is distinct from old.customer_id then raise sqlstate 'PT403' using message='Հաճախորդը չի կարող փոխվել';end if;
 if new.customer_id is not null then
  select * into root from public.zzws_users where id=new.customer_id for share;
  if root.id is null or root.customer_id is not null or root.profile->>'role'<>'client' or new.id=root.id then raise sqlstate 'PT403';end if;
  new.profile=root.profile;
 end if;
 return new;
end $$;
-- Alphabetical trigger order: inheritance precedes profile revision validation.
create trigger zzws_account_inherit before insert or update on public.zzws_users for each row execute function public.zzws_account_inherit();
create function public.zzws_account_sync() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_id is null and (new.profile is distinct from old.profile or new.active is distinct from old.active) then
  if exists(select 1 from public.zzws_users where customer_id=new.id) and new.profile->>'role'<>'client' then raise sqlstate 'PT403';end if;
  update public.zzws_users set profile=new.profile where customer_id=new.id and profile is distinct from new.profile;
  if not new.active then delete from public.zzws_sessions where user_id in(select id from public.zzws_users where customer_id=new.id);end if;
 end if;
 return null;
end $$;
create trigger zzws_account_sync after update on public.zzws_users for each row execute function public.zzws_account_sync();

create function public.zzws_team_create(p_manager uuid,p_user uuid,p_login text,p_label text) returns void language plpgsql security invoker set search_path='' as $$
declare root public.zzws_users;begin
 select * into root from public.zzws_users where id=p_manager and active and customer_id is null and profile->>'role'='client' and not needs_password_setup and not needs_profile_setup for update;
 if root.id is null then raise sqlstate 'PT403';end if;
 if (select count(*) from public.zzws_users where customer_id=root.id)>=200 then raise sqlstate 'PT400';end if;
 insert into public.zzws_users(id,login,profile,active,customer_id,person,needs_profile_setup) values(p_user,p_login,root.profile,true,root.id,jsonb_build_object('label',left(p_label,200)),true);
 insert into public.zzws_audit(actor,action,detail) values(p_manager,'employee_invite',jsonb_build_object('customerId',root.id,'employeeId',p_user)::text);
end $$;
create function public.zzws_team_access(p_manager uuid,p_user uuid,p_active boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.zzws_users where id=p_manager and active and customer_id is null and profile->>'role'='client' and not needs_password_setup and not needs_profile_setup for share;if not found then raise sqlstate 'PT403';end if;
 update public.zzws_users set active=p_active where id=p_user and customer_id=p_manager;if not found then raise sqlstate 'PT403';end if;
 delete from public.zzws_sessions where user_id=p_user;
 insert into public.zzws_audit(actor,action,detail) values(p_manager,'employee_access',jsonb_build_object('employeeId',p_user,'active',p_active)::text);
end $$;
create function public.zzws_account_person(p_user uuid,p_hash text,p_person jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.zzws_sessions where hash=p_hash and user_id=p_user and expires>now() and not setup_only for share;if not found then raise sqlstate 'PT403';end if;
 update public.zzws_users set person=p_person,needs_profile_setup=false where id=p_user and active and profile->>'role'='client';if not found then raise sqlstate 'PT403';end if;
 insert into public.zzws_audit(actor,action) values(p_user,'account_profile');
end $$;
create function public.zzws_account_activate(p_user uuid,p_hash text,p_invitation text,p_login text,p_person jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare u public.zzws_users;begin
 select * into u from public.zzws_users where id=p_user and active for update;
 if u.id is null or not u.needs_password_setup or u.password_setup_claim is distinct from p_hash then raise sqlstate 'PT409';end if;
 perform 1 from public.zzws_sessions where hash=p_hash and user_id=p_user and setup_only and expires>now() for update;if not found then raise sqlstate 'PT403';end if;
 perform 1 from public.zzws_invitations where user_id=p_user and hash=p_invitation and expires>now() for update;if not found then raise sqlstate 'PT403';end if;
 if u.customer_id is not null then perform 1 from public.zzws_users where id=u.customer_id and active and profile->>'role'='client' for share;if not found then raise sqlstate 'PT403';end if;end if;
 update public.zzws_users set login=p_login,person=p_person,needs_password_setup=false,needs_profile_setup=false,password_setup_claim=null where id=p_user;
 delete from public.zzws_sessions where user_id=p_user;
 delete from public.zzws_invitations where user_id=p_user;
 insert into public.zzws_audit(actor,action) values(p_user,'password_setup');
end $$;

alter table public.zzws_orders add column customer_id uuid references public.zzws_users(id) on delete set null;
create index zzws_orders_customer on public.zzws_orders(customer_id,created desc);
update public.zzws_orders o set customer_id=o.user_id,customer=o.customer||jsonb_build_object('customerCode',case when o.customer->>'login'~'^[0-9]+$' then o.customer->>'login' else '' end) where o.user_id is not null;
-- Existing orders have deferred calculation guards; finish these before adding a trigger.
set constraints all immediate;
create function public.zzws_order_account_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
declare u public.zzws_users;root public.zzws_users;begin
 if tg_op='UPDATE' then
  if new.customer is distinct from old.customer or (new.customer_id is distinct from old.customer_id and not(new.customer_id is null and not exists(select 1 from public.zzws_users where id=old.customer_id))) then raise sqlstate 'PT403';end if;
  return new;
 end if;
 select * into u from public.zzws_users where id=new.user_id for share;
 if u.profile->>'role'='client' then
  select * into root from public.zzws_users where id=coalesce(u.customer_id,u.id) and active for share;if not found then raise sqlstate 'PT403';end if;
  if u.needs_profile_setup or u.needs_password_setup then raise sqlstate 'PT403' using message='Լրացրեք անձնական տվյալները';end if;
  new.customer_id=root.id;
  new.customer=(new.customer-'login')||jsonb_build_object('customerCode',coalesce(root.profile->>'customerCode',''),'customerId',root.id);
  if coalesce(u.person->>'email','')<>'' then
   new.customer=new.customer||jsonb_build_object('author',u.person||jsonb_build_object('id',u.id));
  end if;
 end if;
 return new;
end $$;
create trigger zzws_order_account_snapshot before insert or update on public.zzws_orders for each row execute function public.zzws_order_account_snapshot();

revoke all on function public.zzws_account_inherit(),public.zzws_account_sync(),public.zzws_team_create(uuid,uuid,text,text),public.zzws_team_access(uuid,uuid,boolean),public.zzws_account_person(uuid,text,jsonb),public.zzws_account_activate(uuid,text,text,text,jsonb),public.zzws_order_account_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_account_inherit(),public.zzws_account_sync(),public.zzws_team_create(uuid,uuid,text,text),public.zzws_team_access(uuid,uuid,boolean),public.zzws_account_person(uuid,text,jsonb),public.zzws_account_activate(uuid,text,text,text,jsonb),public.zzws_order_account_snapshot() to service_role;
commit;
