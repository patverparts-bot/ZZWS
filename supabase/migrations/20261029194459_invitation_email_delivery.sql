-- Only delivery metadata is stored, never the invitation code or recipient addresses.
alter table public.zzws_invitations add column mail_key text,add column mail_fingerprint text,add column mail_state text check(mail_state in ('sending','accepted','retry','uncertain')),add column mail_attempts integer not null default 0,add column mail_started_at timestamptz,add column mail_provider_id text;
create function public.zzws_invitation_mail_claim(p_actor uuid,p_user uuid,p_hash text,p_key text,p_fingerprint text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_invitations;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403';end if;
 if p_hash!~'^[a-f0-9]{64}$' or p_key!~'^[a-f0-9]{64}$' or p_fingerprint!~'^[a-f0-9]{64}$' then raise sqlstate 'PT400';end if;
 select * into r from public.zzws_invitations where user_id=p_user for update;
 if not found or r.hash<>p_hash or r.expires<=clock_timestamp() or not exists(select 1 from public.zzws_users where id=p_user and active and needs_password_setup) then raise sqlstate 'PT409' using message='Invitation expired or changed';end if;
 if r.mail_key is not null and (r.mail_key<>p_key or r.mail_fingerprint<>p_fingerprint) then raise sqlstate 'PT409' using message='Recipients changed; generate a new invitation';end if;
 if r.mail_state='accepted' then return jsonb_build_object('state','accepted');end if;
 if r.mail_state in ('sending','uncertain') or r.mail_attempts>=3 or r.mail_started_at<clock_timestamp()-interval '23 hours' then return jsonb_build_object('state','uncertain');end if;
 update public.zzws_invitations set mail_key=p_key,mail_fingerprint=p_fingerprint,mail_state='sending',mail_attempts=mail_attempts+1,mail_started_at=coalesce(mail_started_at,clock_timestamp()) where user_id=p_user;
 return jsonb_build_object('state','send');end $$;
create function public.zzws_invitation_mail_finish(p_actor uuid,p_user uuid,p_hash text,p_key text,p_result text,p_provider text default null) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403';end if;
 if p_result not in ('accepted','retry','uncertain') then raise sqlstate 'PT400';end if;
 update public.zzws_invitations set mail_state=p_result,mail_provider_id=case when p_result='accepted' then left(p_provider,200) else null end where user_id=p_user and hash=p_hash and mail_key=p_key and mail_state='sending';
 if not found then return false;end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'invitation_email',jsonb_build_object('target',p_user,'result',p_result)::text);
 return true;end $$;
revoke all on function public.zzws_invitation_mail_claim(uuid,uuid,text,text,text),public.zzws_invitation_mail_finish(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.zzws_invitation_mail_claim(uuid,uuid,text,text,text),public.zzws_invitation_mail_finish(uuid,uuid,text,text,text,text) to service_role;
