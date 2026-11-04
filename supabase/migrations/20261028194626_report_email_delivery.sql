-- Metadata only: no attachment bytes, parsed file rows, email body, sender credentials or mail API keys.
create table public.zzws_report_email_settings(id boolean primary key default true check(id),cc jsonb not null default '["","",""]' check(jsonb_typeof(cc)='array' and jsonb_array_length(cc)=3),revision uuid not null default gen_random_uuid(),updated_by uuid references public.zzws_users(id),updated timestamptz not null default now());
insert into public.zzws_report_email_settings(id) values(true);
create table public.zzws_report_deliveries(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.zzws_orders(id),order_revision integer not null,actor_id uuid not null references public.zzws_users(id),request_id uuid not null,fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),state text not null check(state in ('sending','retry','failed','uncertain','accepted','completed')),attempts integer not null default 0 check(attempts between 0 and 2),lease uuid,lease_until timestamptz,provider_id text,accepted_at timestamptz,created timestamptz not null default now(),updated timestamptz not null default now(),counts jsonb not null,unique(order_id,order_revision),unique(order_id,fingerprint));
alter table public.zzws_report_email_settings enable row level security;alter table public.zzws_report_deliveries enable row level security;
revoke all on public.zzws_report_email_settings,public.zzws_report_deliveries from public,anon,authenticated;grant all on public.zzws_report_email_settings,public.zzws_report_deliveries to service_role;
create policy service_only on public.zzws_report_email_settings for all to service_role using(true) with check(true);create policy service_only on public.zzws_report_deliveries for all to service_role using(true) with check(true);
create function public.zzws_report_authorized(p_actor uuid) returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager'));$$;
create function public.zzws_report_claim(p_actor uuid,p_order uuid,p_revision integer,p_request uuid,p_fingerprint text,p_counts jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;j public.zzws_report_deliveries;uid uuid;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select user_id into uid from public.zzws_orders where id=p_order;if uid is not null then perform public.zzws_receipt_state(uid);end if;
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 select * into j from public.zzws_report_deliveries where order_id=p_order and fingerprint=p_fingerprint for update;
 if found and j.state in ('accepted','completed') then return to_jsonb(j);end if;
 if o.revision<>p_revision or o.received_at is not null or o.status='received' then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է';end if;
 if j.id is null then select * into j from public.zzws_report_deliveries where order_id=p_order and order_revision=p_revision for update;end if;
 if j.id is not null then
  if j.fingerprint<>p_fingerprint or j.actor_id<>p_actor or j.order_revision<>p_revision then raise sqlstate 'PT409' using message='Այս պատվերի համար այլ ուղարկում կա';end if;
  if j.state in ('failed','uncertain') then return to_jsonb(j);end if;
  if j.created<now()-interval '23 hours' or j.attempts>=2 and (j.state<>'sending' or j.lease_until<=now()) then update public.zzws_report_deliveries set state='uncertain',lease=null,lease_until=null,updated=now() where id=j.id returning * into j;return to_jsonb(j);end if;
  if j.state='sending' and j.lease_until>now() then return to_jsonb(j)||'{"busy":true}'::jsonb;end if;
  update public.zzws_report_deliveries set state='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated=now() where id=j.id returning * into j;
 else
  insert into public.zzws_report_deliveries(order_id,order_revision,actor_id,request_id,fingerprint,state,attempts,lease,lease_until,counts) values(p_order,p_revision,p_actor,p_request,p_fingerprint,'sending',1,gen_random_uuid(),now()+interval '2 minutes',p_counts) returning * into j;
 end if;
 return to_jsonb(j);
end $$;
create function public.zzws_report_result(p_actor uuid,p_job uuid,p_lease uuid,p_result text,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;begin
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.state in ('accepted','completed') then return to_jsonb(j);end if;
 if j.state<>'sending' or j.lease is distinct from p_lease then raise sqlstate 'PT409';end if;
 if p_result not in ('accepted','rejected','unknown') or p_result='accepted' and (p_provider is null or length(p_provider)>200) then raise sqlstate 'PT400';end if;
 update public.zzws_report_deliveries set state=case when p_result='accepted' then 'accepted' when attempts<2 then 'retry' when p_result='unknown' then 'uncertain' else 'failed' end,provider_id=case when p_result='accepted' then p_provider end,accepted_at=case when p_result='accepted' then now() end,lease=null,lease_until=null,updated=now() where id=p_job returning * into j;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_result',jsonb_build_object('orderId',j.order_id,'jobId',j.id,'result',j.state,'attempt',j.attempts,'counts',j.counts)::text);return to_jsonb(j);
end $$;
create function public.zzws_report_order_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if exists(select 1 from public.zzws_report_deliveries j where j.order_id=old.id and (j.state='accepted' or j.state='sending' and j.lease_until>now()) and j.id::text is distinct from current_setting('zzws.report_completing',true)) then raise sqlstate 'PT409' using message='Սպասեք հաշվետվության ուղարկման ավարտին';end if;return new;
end $$;
create trigger zzws_report_order_guard before update on public.zzws_orders for each row execute function public.zzws_report_order_guard();
create function public.zzws_report_complete(p_actor uuid,p_order uuid,p_job uuid,p_lines jsonb,p_total numeric,p_changes jsonb,p_context jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;o public.zzws_orders;uid uuid;result jsonb;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select user_id into uid from public.zzws_orders where id=p_order;if uid is not null then perform public.zzws_receipt_state(uid);end if;
 select * into o from public.zzws_orders where id=p_order for update;select * into j from public.zzws_report_deliveries where id=p_job and order_id=p_order for update;
 if j.id is null then raise sqlstate 'PT404';end if;
 if j.state='completed' then return jsonb_build_object('accepted',true,'completed',true,'duplicate',true,'orderId',o.id,'status',o.status);end if;
 if j.state<>'accepted' or j.accepted_at is null then raise sqlstate 'PT409';end if;
 if o.revision<>j.order_revision or o.received_at is not null then raise sqlstate 'PT409';end if;
 perform pg_catalog.set_config('zzws.report_completing',j.id::text,true);
 result=public.zzws_update_order_v3(o.id,o.revision,p_lines,'in_progress',o.comment,p_total,jsonb_build_object('number',o.number,'changes',p_changes,'source','report_email','reportId',j.id),p_actor,p_context);
 update public.zzws_report_deliveries set state='completed',updated=now() where id=j.id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_completed',jsonb_build_object('orderId',o.id,'jobId',j.id)::text);
 return jsonb_build_object('accepted',true,'completed',true,'orderId',o.id,'status','in_progress');
end $$;
revoke all on function public.zzws_report_authorized(uuid),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb),public.zzws_report_result(uuid,uuid,uuid,text,text),public.zzws_report_order_guard(),public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_report_authorized(uuid),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb),public.zzws_report_result(uuid,uuid,uuid,text,text),public.zzws_report_order_guard(),public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb) to service_role;
create function public.zzws_report_settings_save(p_actor uuid,p_revision uuid,p_cc jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.zzws_report_email_settings;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope='owner') then raise sqlstate 'PT403';end if;
 if jsonb_typeof(p_cc)<>'array' or jsonb_array_length(p_cc)<>3 then raise sqlstate 'PT400';end if;
 update public.zzws_report_email_settings set cc=p_cc,revision=gen_random_uuid(),updated=now(),updated_by=p_actor where id and revision=p_revision returning * into s;if not found then raise sqlstate 'PT409';end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_settings','CC settings updated');return to_jsonb(s);
end $$;
revoke all on function public.zzws_report_settings_save(uuid,uuid,jsonb) from public,anon,authenticated;grant execute on function public.zzws_report_settings_save(uuid,uuid,jsonb) to service_role;
