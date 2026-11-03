alter table public.zzws_assistant_history add column review_correction jsonb not null default '{}'::jsonb;
grant update (review_correction) on public.zzws_assistant_history to service_role;
create table public.zzws_assistant_lessons (
 history_id uuid primary key references public.zzws_assistant_history(id) on delete cascade,
 intent_key text not null check(length(intent_key)<=10000),
 correction jsonb not null,
 excluded_articuls text[] not null default '{}',
 updated timestamptz not null default now()
);
create index zzws_assistant_lessons_intent on public.zzws_assistant_lessons(intent_key,updated);
alter table public.zzws_assistant_lessons enable row level security;
revoke all on public.zzws_assistant_lessons from public,anon,authenticated;
grant select,insert,update,delete on public.zzws_assistant_lessons to service_role;
create function public.zzws_review_assistant_answer(p_id uuid,p_actor uuid,p_revision integer,p_status text,p_note text,p_correction jsonb,p_key text,p_excluded text[]) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare result public.zzws_assistant_history;
begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise exception 'owner_required';end if;
 update public.zzws_assistant_history set review_status=p_status,review_note=p_note,review_correction=p_correction,reviewed_by=p_actor,reviewed_at=now(),revision=revision+1 where id=p_id and revision=p_revision returning * into result;
 if not found then return null;end if;
 if p_status='incorrect' then
  insert into public.zzws_assistant_lessons(history_id,intent_key,correction,excluded_articuls) values(p_id,p_key,p_correction,p_excluded)
  on conflict(history_id) do update set intent_key=excluded.intent_key,correction=excluded.correction,excluded_articuls=excluded.excluded_articuls,updated=now();
 else delete from public.zzws_assistant_lessons where history_id=p_id;
 end if;
 return jsonb_build_object('id',result.id,'review_status',result.review_status,'review_note',result.review_note,'review_correction',result.review_correction,'reviewed_at',result.reviewed_at,'revision',result.revision,'learningActive',p_status='incorrect');
end $$;
revoke all on function public.zzws_review_assistant_answer(uuid,uuid,integer,text,text,jsonb,text,text[]) from public,anon,authenticated;
grant execute on function public.zzws_review_assistant_answer(uuid,uuid,integer,text,text,jsonb,text,text[]) to service_role;
-- Marks made before this migration also prevent replay of their rejected offers.
-- The canonical key is compiled lazily by the route on the next review; these rows
-- are explicitly surfaced as needing an update, rather than silently guessed.
