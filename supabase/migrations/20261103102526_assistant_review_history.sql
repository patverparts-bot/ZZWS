-- Immutable server-generated question/answer snapshots; reviews are separate columns.
create table public.zzws_assistant_history (
 id uuid primary key default gen_random_uuid(),
 created timestamptz not null default now(),
 user_id uuid not null,
 actor jsonb not null,
 conversation_id uuid not null,
 request jsonb not null check (jsonb_typeof(request)='object'),
 response jsonb not null check (jsonb_typeof(response)='object'),
 search_text text not null,
 review_status text not null default 'unreviewed' check (review_status in ('unreviewed','incorrect','correct')),
 review_note text not null default '' check (length(review_note)<=2000),
 reviewed_by uuid,
 reviewed_at timestamptz,
 revision integer not null default 0 check (revision>=0)
);
create index zzws_assistant_history_created on public.zzws_assistant_history (created desc,id desc);
create index zzws_assistant_history_review on public.zzws_assistant_history (review_status,created desc,id desc);
create index zzws_assistant_history_conversation on public.zzws_assistant_history (conversation_id,created,id);
alter table public.zzws_assistant_history enable row level security;
revoke all on public.zzws_assistant_history from public,anon,authenticated;
grant select,insert on public.zzws_assistant_history to service_role;
grant update (review_status,review_note,reviewed_by,reviewed_at,revision) on public.zzws_assistant_history to service_role;
