-- Keep only the authenticated acting session for a non-credential self edit.
-- The legacy save still revokes every other target session in this transaction.
create function public.zzws_save_user_v3(
 p_id uuid,p_login text,p_profile jsonb,p_active boolean,p_actor uuid,p_expected bigint,p_session_hash text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare previous public.zzws_users; retained public.zzws_sessions;
begin
 if p_id=p_actor then
  select * into previous from public.zzws_users where id=p_id for update;
  if previous.active and p_active and previous.login=p_login
   and previous.profile->>'role'='admin' and p_profile->>'role'='admin' then
   select * into retained from public.zzws_sessions
    where hash=p_session_hash and user_id=p_actor and expires>now() and not setup_only
    for update;
  end if;
 end if;
 perform public.zzws_save_user_v2(p_id,p_login,p_profile,p_active,p_actor,p_expected);
 if retained.hash is not null then
  insert into public.zzws_sessions select (retained).*;
  return true;
 end if;
 return false;
end $$;
revoke all on function public.zzws_save_user_v3(uuid,text,jsonb,boolean,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.zzws_save_user_v3(uuid,text,jsonb,boolean,uuid,bigint,text) to service_role;
