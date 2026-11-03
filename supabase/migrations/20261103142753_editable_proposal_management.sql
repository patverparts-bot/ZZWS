alter table public.zzws_proposals add column revision integer not null default 1 check(revision>0);
alter table public.zzws_proposals add column updated_at timestamptz;
alter table public.zzws_proposals add column revoked_at timestamptz;
create function public.zzws_proposal_revision_default() returns trigger language plpgsql security invoker set search_path='' as $$begin new.revision=coalesce(new.revision,1);return new;end $$;
revoke all on function public.zzws_proposal_revision_default() from public,anon,authenticated;
grant execute on function public.zzws_proposal_revision_default() to service_role;
create trigger zzws_proposal_revision_default before insert on public.zzws_proposals for each row execute function public.zzws_proposal_revision_default();
create function public.zzws_edit_proposal(p_actor uuid,p_id text,p_revision integer,p_lines jsonb,p_mode text,p_days integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.zzws_proposals;
begin
 if not exists(select 1 from public.zzws_users where id=p_actor and active and profile->>'role'='admin') then raise sqlstate 'PT403' using message='Access denied';end if;
 select * into p from public.zzws_proposals where token_hash=p_id and owner_id=p_actor for update;
 if not found then raise sqlstate 'PT404' using message='Offer not found';end if;
 if p.revision<>p_revision or p.revoked_at is not null then raise sqlstate 'PT409' using message='Offer changed; reopen it';end if;
 if p_days not between 1 and 365 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 2000 or p_mode not in ('KP','Dealers') then raise sqlstate 'PT400' using message='Invalid offer';end if;
 update public.zzws_proposals set lines=p_lines,price_mode=p_mode,valid_days=p_days,expires_at=created_at+make_interval(days=>p_days),revision=revision+1,updated_at=now() where token_hash=p_id returning * into p;
 insert into public.zzws_proposal_cart(user_id,articul,token_hash)
 select distinct g.user_id,x->>'articul',p_id from public.zzws_proposal_cart g cross join jsonb_array_elements(p_lines) x where g.token_hash=p_id
 on conflict(user_id,articul) do nothing;
 delete from public.zzws_proposal_cart g where g.token_hash=p_id and not exists(select 1 from jsonb_array_elements(p_lines) x where x->>'articul'=g.articul);
 return to_jsonb(p);
end $$;
revoke all on function public.zzws_edit_proposal(uuid,text,integer,jsonb,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_edit_proposal(uuid,text,integer,jsonb,text,integer) to service_role;
grant update on public.zzws_proposals to service_role;
create function public.zzws_proposal_action(p_actor uuid,p_id text,p_revision integer,p_delete boolean) returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.zzws_proposals; owner boolean;
begin
 if not exists(select 1 from public.zzws_users where id=p_actor and active and profile->>'role'='admin') then raise sqlstate 'PT403' using message='Access denied';end if;
 owner=exists(select 1 from public.zzws_admin_scopes where user_id=p_actor and scope='owner');
 select * into p from public.zzws_proposals where token_hash=p_id for update;
 if not found or (p.owner_id<>p_actor and not owner) or (p_delete and not owner) then raise sqlstate 'PT403' using message='Access denied';end if;
 if p.revision<>p_revision then raise sqlstate 'PT409' using message='Offer changed';end if;
 if p_delete then delete from public.zzws_proposals where token_hash=p_id;
 else update public.zzws_proposals set revoked_at=now(),revision=revision+1,updated_at=now() where token_hash=p_id;delete from public.zzws_proposal_cart where token_hash=p_id;end if;
 return true;
end $$;
revoke all on function public.zzws_proposal_action(uuid,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.zzws_proposal_action(uuid,text,integer,boolean) to service_role;
