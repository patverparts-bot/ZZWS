begin;
create table public.zzws_approval_reminder_snoozes(
 order_id uuid not null references public.zzws_orders(id) on delete cascade,
 recipient_id uuid not null references public.zzws_users(id) on delete cascade,
 proposal_id uuid not null,defer_request_id uuid not null,order_revision integer not null,
 snoozed_until timestamptz not null check(isfinite(snoozed_until)),
 actor uuid not null references public.zzws_users(id) on delete cascade,
 request_id uuid not null,include_client boolean not null default false,updated_at timestamptz not null default now(),
 primary key(order_id,recipient_id),unique(recipient_id,request_id)
);
create index zzws_approval_snooze_recipient on public.zzws_approval_reminder_snoozes(recipient_id,snoozed_until);
alter table public.zzws_approval_reminder_snoozes enable row level security;
revoke all on public.zzws_approval_reminder_snoozes from public,anon,authenticated;
grant all on public.zzws_approval_reminder_snoozes to service_role;
create policy service_only on public.zzws_approval_reminder_snoozes for all to service_role using(true) with check(true);

create function public.zzws_snooze_approval_reminder(p_actor uuid,p_order uuid,p_revision integer,p_proposal uuid,p_defer uuid,p_until timestamptz,p_client boolean,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;s public.zzws_approval_reminder_snoozes;result jsonb;
begin
 perform 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope in ('owner','manager') for share of u,a;if not found then raise sqlstate 'PT403';end if;
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 if o.revision is distinct from p_revision or o.received_at is not null or o.status not in ('new','confirmed','in_progress') or o.approval->>'state' is distinct from 'pending' or o.approval->>'id' is distinct from p_proposal::text or o.approval->>'deferRequestId' is distinct from p_defer::text or coalesce((o.approval->>'reviewRequestedMinutes')::integer,0)<1 or not((o.approval->>'remindAfter')::timestamptz<=now()) then raise sqlstate 'PT409';end if;
 if p_request is null or p_proposal is null or p_defer is null or p_until is null or p_client is null or not isfinite(p_until) then raise sqlstate 'PT400';end if;
 select * into s from public.zzws_approval_reminder_snoozes where recipient_id=p_actor and request_id=p_request;
 if found then
  if s.order_id is distinct from p_order or s.proposal_id is distinct from p_proposal or s.defer_request_id is distinct from p_defer or s.order_revision is distinct from p_revision or s.snoozed_until is distinct from p_until or s.include_client is distinct from p_client then raise sqlstate 'PT409';end if;
  return jsonb_build_object('ok',true,'snoozedUntil',s.snoozed_until,'clientSnoozed',s.include_client);
 end if;
 if p_until<=clock_timestamp() then raise sqlstate 'PT400';end if;
 insert into public.zzws_approval_reminder_snoozes(order_id,recipient_id,proposal_id,defer_request_id,order_revision,snoozed_until,actor,request_id,include_client)
 values(o.id,p_actor,p_proposal,p_defer,p_revision,p_until,p_actor,p_request,p_client)
 on conflict(order_id,recipient_id) do update set proposal_id=excluded.proposal_id,defer_request_id=excluded.defer_request_id,order_revision=excluded.order_revision,snoozed_until=excluded.snoozed_until,actor=excluded.actor,request_id=excluded.request_id,include_client=excluded.include_client,updated_at=now();
 if p_client then
  if not exists(select 1 from public.zzws_users where id=o.user_id and active and profile->>'role'='client') then raise sqlstate 'PT409';end if;
  insert into public.zzws_approval_reminder_snoozes(order_id,recipient_id,proposal_id,defer_request_id,order_revision,snoozed_until,actor,request_id,include_client)
  values(o.id,o.user_id,p_proposal,p_defer,p_revision,p_until,p_actor,p_request,true)
  on conflict(order_id,recipient_id) do update set proposal_id=excluded.proposal_id,defer_request_id=excluded.defer_request_id,order_revision=excluded.order_revision,snoozed_until=excluded.snoozed_until,actor=excluded.actor,request_id=excluded.request_id,include_client=true,updated_at=now();
 end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'approval_reminder_snoozed',jsonb_build_object('orderId',o.id,'number',o.number,'proposalId',p_proposal,'deferRequestId',p_defer,'until',p_until,'includeClient',p_client)::text);
 return jsonb_build_object('ok',true,'snoozedUntil',p_until,'clientSnoozed',p_client);
end $$;
revoke all on function public.zzws_snooze_approval_reminder(uuid,uuid,integer,uuid,uuid,timestamptz,boolean,uuid) from public,anon,authenticated;
grant execute on function public.zzws_snooze_approval_reminder(uuid,uuid,integer,uuid,uuid,timestamptz,boolean,uuid) to service_role;

alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_custom_snooze;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with previous as materialized(select public.zzws_application_snapshot_before_custom_snooze() value)
 select value||jsonb_build_object('tables',(value->'tables')||jsonb_build_object('approval_reminder_snoozes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.zzws_approval_reminder_snoozes t))) from previous;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
