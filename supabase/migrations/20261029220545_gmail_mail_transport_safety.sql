-- SMTP has no provider idempotency: never replay an ambiguous or expired in-flight send.
create or replace function public.zzws_report_claim(p_actor uuid,p_order uuid,p_revision integer,p_request uuid,p_fingerprint text,p_counts jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  if j.counts->>'transport'='smtp' and j.state='sending' and j.lease_until<=now() or j.created<now()-interval '23 hours' or j.attempts>=2 and (j.state<>'sending' or j.lease_until<=now()) then update public.zzws_report_deliveries set state='uncertain',lease=null,lease_until=null,updated=now() where id=j.id returning * into j;return to_jsonb(j);end if;
  if j.state='sending' and j.lease_until>now() then return to_jsonb(j)||'{"busy":true}'::jsonb;end if;
  update public.zzws_report_deliveries set state='sending',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated=now() where id=j.id returning * into j;
 else
  insert into public.zzws_report_deliveries(order_id,order_revision,actor_id,request_id,fingerprint,state,attempts,lease,lease_until,counts) values(p_order,p_revision,p_actor,p_request,p_fingerprint,'sending',1,gen_random_uuid(),now()+interval '2 minutes',p_counts) returning * into j;
 end if;
 return to_jsonb(j);
end $$;
create or replace function public.zzws_report_result(p_actor uuid,p_job uuid,p_lease uuid,p_result text,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;begin
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.state in ('accepted','completed') then return to_jsonb(j);end if;
 if j.state<>'sending' or j.lease is distinct from p_lease then raise sqlstate 'PT409';end if;
 if p_result not in ('accepted','rejected','unknown') or p_result='accepted' and (p_provider is null or length(p_provider)>200) then raise sqlstate 'PT400';end if;
 update public.zzws_report_deliveries set state=case when p_result='accepted' then 'accepted' when p_result='unknown' and j.counts->>'transport'='smtp' then 'uncertain' when attempts<2 then 'retry' when p_result='unknown' then 'uncertain' else 'failed' end,provider_id=case when p_result='accepted' then p_provider end,accepted_at=case when p_result='accepted' then now() end,lease=null,lease_until=null,updated=now() where id=p_job returning * into j;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_result',jsonb_build_object('orderId',j.order_id,'jobId',j.id,'result',j.state,'attempt',j.attempts,'counts',j.counts)::text);return to_jsonb(j);
end $$;
