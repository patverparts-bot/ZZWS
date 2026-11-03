-- Capability links expose only a frozen, explicitly shared offer, never a catalogue.
create table public.zzws_proposals (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 owner_id uuid not null references public.zzws_users(id) on delete cascade,
 lines jsonb not null check (jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 2000),
 price_mode text not null check (price_mode in ('KP','Dealers')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 check (expires_at = created_at + interval '7 days')
);
alter table public.zzws_proposals enable row level security;
create policy service_only on public.zzws_proposals for all to service_role using(true) with check(true);
revoke all on public.zzws_proposals from public,anon,authenticated;
grant select,insert,delete on public.zzws_proposals to service_role;
create index zzws_proposals_expiry on public.zzws_proposals(expires_at);
