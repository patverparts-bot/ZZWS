-- Prepared only. Buyer offers are not procurement orders and never send messages.
begin;
-- Assigned only when an offer is finalized, never from a browser counter.
create sequence public.zzws_buyer_offer_number_seq as bigint start with 1 minvalue 1 maxvalue 9007199254740991 no cycle;
create table public.zzws_buyer_offers(
 id uuid primary key default gen_random_uuid(),
 offer_number bigint unique check(offer_number between 1 and 9007199254740991),
 actor_id uuid not null references public.zzws_users(id) on delete cascade,
 buyer_name text not null check(length(btrim(buyer_name)) between 1 and 200),
 buyer_phone text not null check(buyer_phone ~ '^\+[1-9][0-9]{7,14}$'),
 markup_percent numeric(7,2) not null check(markup_percent between 0 and 1000),
 price_category text not null check(price_category in('Dealers','KP') or price_category ~ '^cat_[a-z0-9_-]{1,60}$'),
 source text not null default 'catalog' check(source in('catalog','cart','selection','product','bundle')),
 base_cart jsonb not null default '{}' check(jsonb_typeof(base_cart)='object'),
 state text not null default 'draft' check(state in('draft','finalized','handed_off')),
 request_lines jsonb not null default '[]' check(jsonb_typeof(request_lines)='array'),
 public_lines jsonb not null default '[]' check(jsonb_typeof(public_lines)='array'),
 internal_lines jsonb not null default '[]' check(jsonb_typeof(internal_lines)='array'),
 catalog_version uuid references public.zzws_versions(id), rules_revision uuid, profile_revision bigint,
 total numeric not null default 0 check(total>=0),expected_profit numeric not null default 0,
 finalize_request uuid,created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
 finalized_at timestamptz,handed_off_at timestamptz,
 check((state='draft' and offer_number is null and finalized_at is null and handed_off_at is null) or
       (state='finalized' and offer_number is not null and finalized_at is not null and handed_off_at is null and finalize_request is not null) or
       (state='handed_off' and offer_number is not null and finalized_at is not null and handed_off_at is not null and finalize_request is not null))
);
alter sequence public.zzws_buyer_offer_number_seq owned by public.zzws_buyer_offers.offer_number;
revoke all on sequence public.zzws_buyer_offer_number_seq from public,anon,authenticated;
grant usage,select on sequence public.zzws_buyer_offer_number_seq to service_role;
create index zzws_buyer_offers_actor on public.zzws_buyer_offers(actor_id,created_at desc);
create unique index zzws_buyer_offers_request on public.zzws_buyer_offers(actor_id,finalize_request) where finalize_request is not null;
alter table public.zzws_buyer_offers enable row level security;
revoke all on public.zzws_buyer_offers from public,anon,authenticated;
grant select,insert,update,delete on public.zzws_buyer_offers to service_role;
create policy service_only on public.zzws_buyer_offers for all to service_role using(true) with check(true);
create trigger zzws_maintenance_write_guard before insert or update or delete on public.zzws_buyer_offers
 for each row execute function public.zzws_maintenance_write_guard();

create function public.zzws_finalize_buyer_offer(
 p_actor uuid,p_offer uuid,p_request uuid,p_input jsonb,p_public jsonb,p_internal jsonb,
 p_catalog uuid,p_rules uuid,p_profile bigint,p_total numeric,p_profit numeric
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_buyer_offers;s public.zzws_state;u public.zzws_users;line jsonb;cost jsonb;total_value numeric:=0;cost_value numeric:=0;
begin
 -- Keep the same state-before-business lock order as maintenance.
 select * into s from public.zzws_state where id=true for share;
 select * into u from public.zzws_users where id=p_actor and active and deleted_at is null and archived_at is null for share;
 if not found or (u.profile->>'role'='admin' and not exists(select 1 from public.zzws_admin_scopes where user_id=p_actor and scope in('owner','manager'))) then raise sqlstate 'PT403' using message='Access denied';end if;
 select * into r from public.zzws_buyer_offers where id=p_offer and actor_id=p_actor for update;
 if not found then raise sqlstate 'PT404' using message='Offer not found';end if;
 if r.state<>'draft' then
  if r.finalize_request=p_request and r.request_lines=p_input then return to_jsonb(r);end if;
  raise sqlstate 'PT409' using message='Offer already finalized';
 end if;
 if p_request is null or r.expires_at<=clock_timestamp() or s.version is distinct from p_catalog or s.rules_revision is distinct from p_rules or u.profile_revision is distinct from p_profile then raise sqlstate 'PT409' using message='Refresh offer';end if;
 if jsonb_typeof(p_input)<>'array' or jsonb_typeof(p_public)<>'array' or jsonb_typeof(p_internal)<>'array'
 or jsonb_array_length(p_public) not between 1 and 500 or jsonb_array_length(p_input)<>jsonb_array_length(p_public) or jsonb_array_length(p_internal)<>jsonb_array_length(p_public)
 or (select count(distinct x->>'articul') from jsonb_array_elements(p_public) x)<>jsonb_array_length(p_public) then raise sqlstate 'PT400' using message='Invalid offer';end if;
 for line in select value from jsonb_array_elements(p_public) loop
  select value into cost from jsonb_array_elements(p_internal) where value->>'articul'=line->>'articul';
  if cost is null or length(line->>'articul') not between 1 and 100 or line->>'articul' in('__proto__','constructor','prototype')
  or (line->>'qty')::numeric<>trunc((line->>'qty')::numeric) or (line->>'qty')::numeric not between 1 and 9999
  or (cost->>'qty')::numeric is distinct from (line->>'qty')::numeric
  or (line->>'salePrice')::numeric<>trunc((line->>'salePrice')::numeric) or (line->>'salePrice')::numeric not between 1 and 1e10
  or (cost->>'unitCost')::numeric<=0 or (cost->>'unitCost')::numeric>1e10
  or (line->>'salePrice')::numeric<ceil((cost->>'unitCost')::numeric*(1+r.markup_percent/100))
  or (line->>'amount')::numeric is distinct from (line->>'qty')::numeric*(line->>'salePrice')::numeric
  or not exists(select 1 from jsonb_array_elements(p_input) x where x->>'articul'=line->>'articul' and (x->>'qty')::numeric=(line->>'qty')::numeric and (x->>'salePrice')::numeric=(line->>'salePrice')::numeric)
  then raise sqlstate 'PT400' using message='Invalid offer';end if;
  total_value:=total_value+(line->>'amount')::numeric;cost_value:=cost_value+(cost->>'qty')::numeric*(cost->>'unitCost')::numeric;
 end loop;
 if total_value>1e14 or total_value is distinct from p_total or round(total_value-cost_value,2) is distinct from p_profit then raise sqlstate 'PT400' using message='Invalid total';end if;
 update public.zzws_buyer_offers set request_lines=p_input,public_lines=p_public,internal_lines=p_internal,
  catalog_version=p_catalog,rules_revision=p_rules,profile_revision=p_profile,total=p_total,expected_profit=p_profit,
  state='finalized',offer_number=nextval('public.zzws_buyer_offer_number_seq'),finalize_request=p_request,finalized_at=clock_timestamp(),expires_at=clock_timestamp()+interval '365 days'
 where id=p_offer returning * into r;
 return to_jsonb(r);
end $$;

create function public.zzws_handoff_buyer_offer(p_actor uuid,p_offer uuid,p_request uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_buyer_offers;m public.zzws_user_memory;u public.zzws_users;line jsonb;old_line jsonb;basket jsonb;next_qty integer;v integer;was_done boolean;
begin
 perform 1 from public.zzws_state where id=true for share;
 select * into u from public.zzws_users where id=p_actor and active and deleted_at is null and archived_at is null for share;
 if not found or (u.profile->>'role'='admin' and not exists(select 1 from public.zzws_admin_scopes where user_id=p_actor and scope in('owner','manager'))) then raise sqlstate 'PT403' using message='Access denied';end if;
 select * into r from public.zzws_buyer_offers where id=p_offer and actor_id=p_actor for update;
 if not found then raise sqlstate 'PT404' using message='Offer not found';end if;
 if p_request is null or r.state='draft' then raise sqlstate 'PT409' using message='Finalize offer first';end if;
 insert into public.zzws_user_memory(user_id) values(p_actor) on conflict do nothing;
 select * into m from public.zzws_user_memory where user_id=p_actor for update;
 basket:=coalesce(m.data->'cart','{}');v:=coalesce((m.versions->>'cart')::integer,0);was_done:=r.state='handed_off';
 if jsonb_typeof(basket)<>'object' then raise sqlstate 'PT409' using message='Reopen employee cart';end if;
 if not was_done then
  for line in select value from jsonb_array_elements(r.internal_lines) loop
   old_line:=basket->(line->>'articul');
   if old_line?'proposalHash' then raise sqlstate 'PT409' using message='Resolve existing proposal cart item';end if;
   if r.source='cart' and coalesce((r.base_cart->(line->>'articul')->>'qty')::integer,0)>0 then
    -- Cart-sourced offers describe quantities already in the employee cart.
    -- Preserve a larger concurrent quantity and restore the selected quantity
    -- if another tab removed/reduced it; never add the same source quantity twice.
    next_qty:=greatest(coalesce((old_line->>'qty')::integer,0),(line->>'qty')::integer);
   else
    next_qty:=coalesce((old_line->>'qty')::integer,0)+(line->>'qty')::integer;
   end if;
   if next_qty not between 1 and 9999 then raise sqlstate 'PT409' using message='Cart quantity limit';end if;
   basket:=jsonb_set(basket,array[line->>'articul'],coalesce(old_line,'{}')||jsonb_build_object('articul',line->>'articul','qty',next_qty,
    'addedPrice',(line->>'unitCost')::numeric,'addedPriceMode',case when r.price_category='Dealers' then 'WS' else r.price_category end));
  end loop;
  if (select count(*) from jsonb_object_keys(basket))>5000 then raise sqlstate 'PT409' using message='Cart item limit';end if;
  v:=v+1;
  update public.zzws_user_memory set data=jsonb_set(data,'{cart}',basket),versions=jsonb_set(versions,'{cart}',to_jsonb(v)) where user_id=p_actor;
  update public.zzws_buyer_offers set state='handed_off',handed_off_at=clock_timestamp() where id=p_offer;
 end if;
 return jsonb_build_object('id',r.id,'number','ZZWS-'||lpad(r.offer_number::text,greatest(6,length(r.offer_number::text)),'0'),'actorId',p_actor,'expectedProfit',r.expected_profit,'cart',basket,'version',v,'alreadyTransferred',was_done,'priceCategory',r.price_category);
end $$;
revoke all on function public.zzws_finalize_buyer_offer(uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,bigint,numeric,numeric) from public,anon,authenticated;
revoke all on function public.zzws_handoff_buyer_offer(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_finalize_buyer_offer(uuid,uuid,uuid,jsonb,jsonb,jsonb,uuid,uuid,bigint,numeric,numeric) to service_role;
grant execute on function public.zzws_handoff_buyer_offer(uuid,uuid,uuid) to service_role;
commit;
