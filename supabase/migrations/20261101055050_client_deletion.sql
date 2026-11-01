-- Remove customers from use without deleting their immutable order/report history.
begin;
alter table public.zzws_users add column deleted_at timestamptz;
drop index public.zzws_customer_code_unique;
create unique index zzws_customer_code_unique on public.zzws_users(lower(profile->>'customerCode')) where deleted_at is null and customer_id is null and profile->>'role'='client' and coalesce(profile->>'customerCode','')<>'';

create function public.zzws_deleted_account_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.deleted_at is not null then raise sqlstate 'PT409' using message='Հաճախորդը ջնջված է։ Թարմացրեք հաճախորդների ցանկը';end if;
 if new.deleted_at is not null and (new.active or new.profile->>'role' is distinct from 'client') then raise sqlstate 'PT409' using message='Ջնջված հաճախորդի հասանելիությունը չի կարող միացվել';end if;
 return new;
end $$;
create trigger zzws_deleted_account_guard before insert or update on public.zzws_users for each row execute function public.zzws_deleted_account_guard();

create function public.zzws_delete_customer(p_actor uuid,p_hash text,p_customer uuid,p_expected bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 update public.zzws_users set active=false,deleted_at=deleted_time where id=any(members);
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_delete',jsonb_build_object('target',jsonb_build_object('id',target.id,'login',target.login,'client',target.profile->>'client','customerCode',target.profile->>'customerCode'),'accounts',cardinality(members),'historyPreserved',true)::text);
 return jsonb_build_object('ok',true,'accounts',cardinality(members));
end $$;
revoke all on function public.zzws_deleted_account_guard(),public.zzws_delete_customer(uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.zzws_deleted_account_guard(),public.zzws_delete_customer(uuid,text,uuid,bigint) to service_role;
commit;
