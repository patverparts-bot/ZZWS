-- Recipient selection is independent from the public capability used for viewing.
alter table public.zzws_proposals add column customer_id uuid references public.zzws_users(id) on delete cascade;
create index zzws_proposals_customer on public.zzws_proposals(customer_id);
create table public.zzws_proposal_cart(
 user_id uuid not null references public.zzws_users(id) on delete cascade,
 articul text not null,
 token_hash text not null references public.zzws_proposals(token_hash) on delete cascade,
 primary key(user_id,articul)
);
create index zzws_proposal_cart_token on public.zzws_proposal_cart(token_hash);
alter table public.zzws_proposal_cart enable row level security;
revoke all on public.zzws_proposal_cart from public,anon,authenticated;
grant select,insert,update,delete on public.zzws_proposal_cart to service_role;
create policy service_only on public.zzws_proposal_cart for all to service_role using(true) with check(true);

-- Recheck the capability in the same transaction that creates the accepted order.
create function public.zzws_check_proposal_order() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry jsonb; offer public.zzws_proposals; receiver uuid; quantity numeric; price numeric;
begin
 if new.context->>'operation' is distinct from 'submit' then return new;end if;
 select coalesce(u.customer_id,u.id) into receiver from public.zzws_users u where u.id=(select o.user_id from public.zzws_orders o where o.id=new.order_id);
 for entry in select value from jsonb_array_elements(new.context->'lines') where value->>'priceOrigin'='proposal' loop
  select p.* into offer from public.zzws_proposals p join public.zzws_proposal_cart g on g.token_hash=p.token_hash where p.token_hash=entry->>'proposalHash' and g.user_id=(select o.user_id from public.zzws_orders o where o.id=new.order_id) and g.articul=entry->>'articul' and p.customer_id=receiver and p.expires_at>now();
  if not found then raise sqlstate 'PT403' using message='Առաջարկը հասանելի չէ կամ ժամկետը լրացել է';end if;
  select sum((x->>'quantity')::numeric),min((x->>'price')::numeric) into quantity,price from jsonb_array_elements(offer.lines) x where x->>'articul'=entry->>'articul';
  if quantity is null or (entry->>'chargedUnitPrice')::numeric is distinct from price then raise sqlstate 'PT400' using message='Առաջարկի գինը կամ քանակը չի համընկնում';end if;
 end loop;
 return new;
end $$;
revoke all on function public.zzws_check_proposal_order() from public,anon,authenticated;
grant execute on function public.zzws_check_proposal_order() to service_role;
create trigger zzws_check_proposal_order before insert on public.zzws_order_calculation_contexts for each row execute function public.zzws_check_proposal_order();

create table public.zzws_proposal_reads(user_id uuid not null references public.zzws_users(id) on delete cascade,token_hash text not null references public.zzws_proposals(token_hash) on delete cascade,read_at timestamptz not null default now(),primary key(user_id,token_hash));
create index zzws_proposal_reads_token on public.zzws_proposal_reads(token_hash);
alter table public.zzws_proposal_reads enable row level security;
revoke all on public.zzws_proposal_reads from public,anon,authenticated;
grant select,insert,update,delete on public.zzws_proposal_reads to service_role;
create policy service_only on public.zzws_proposal_reads for all to service_role using(true) with check(true);
