-- Prepared only: apply with the matching API after deployment recovery.
begin;
alter table public.zzws_proposals drop constraint zzws_proposals_price_mode_check;
alter table public.zzws_proposals add constraint zzws_proposals_price_mode_check
 check(price_mode in ('KP','Dealers') or price_mode ~ '^cat_[a-z0-9_-]{1,60}$');
create or replace function public.zzws_edit_proposal(p_actor uuid,p_id text,p_revision integer,p_lines jsonb,p_mode text,p_days integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.zzws_proposals;
begin
 if not exists(select 1 from public.zzws_users where id=p_actor and active and profile->>'role'='admin') then raise sqlstate 'PT403' using message='Access denied';end if;
 select * into p from public.zzws_proposals where token_hash=p_id and owner_id=p_actor for update;
 if not found then raise sqlstate 'PT404' using message='Offer not found';end if;
 if p.revision<>p_revision or p.revoked_at is not null then raise sqlstate 'PT409' using message='Offer changed; reopen it';end if;
 if p_days not between 1 and 365 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 2000 or not (p_mode in ('KP','Dealers') or p_mode ~ '^cat_[a-z0-9_-]{1,60}$') or (p_mode not in ('KP','Dealers') and not exists(select 1 from public.zzws_state where id=true and rules ? p_mode)) then raise sqlstate 'PT400' using message='Invalid offer';end if;
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

commit;
