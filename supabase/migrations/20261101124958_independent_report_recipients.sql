begin;

-- Metadata lives in existing counts JSONB and existing encrypted backups. No mail
-- body, attachment bytes, authentication credential or provider error is stored.
create function public.zzws_report_delivery_state(p_counts jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case
  when count(*)>0 and count(*) filter(where value->>'state'='accepted')=count(*) then 'accepted'
  when count(*) filter(where value->>'state' in ('pending','retry'))>0 then 'retry'
  when count(*) filter(where value->>'state'='sending')>0 then 'sending'
  when count(*) filter(where value->>'state'='uncertain')>0 then 'uncertain'
  else 'failed' end
 from jsonb_array_elements(p_counts->'deliveries');
$$;

-- Reconcile only expired in-flight recipients. Untouched siblings remain pending.
create function public.zzws_report_recipient_status(p_actor uuid,p_job uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;entries jsonb;next_state text;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema'<>'1' or not(j.counts ? 'deliverySchema') then return to_jsonb(j);end if;
 if j.state='sending' and j.lease_until>clock_timestamp() then return to_jsonb(j)||'{"busy":true}'::jsonb;end if;
 if j.state='sending' then
  select jsonb_agg(case when value->>'state'='sending' then (value-'lease')||jsonb_build_object('state','uncertain','reason','lease_expired') else value end order by ordinal)
  into entries from jsonb_array_elements(j.counts->'deliveries') with ordinality t(value,ordinal);
  j.counts=jsonb_set(j.counts,'{deliveries}',entries);next_state=public.zzws_report_delivery_state(j.counts);
  update public.zzws_report_deliveries set counts=j.counts,state=next_state,accepted_at=case when next_state='accepted' then coalesce(accepted_at,clock_timestamp()) else accepted_at end,provider_id=case when next_state='accepted' then coalesce(provider_id,'per-recipient/'||id::text) else provider_id end,lease=null,lease_until=null,updated=now() where id=j.id returning * into j;
 end if;
 return to_jsonb(j);
end $$;

alter function public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb) rename to zzws_report_claim_before_recipients;
create function public.zzws_report_claim(p_actor uuid,p_order uuid,p_revision integer,p_request uuid,p_fingerprint text,p_counts jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;j public.zzws_report_deliveries;uid uuid;entries jsonb;next_state text;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select user_id into uid from public.zzws_orders where id=p_order;if uid is not null then perform public.zzws_receipt_state(uid);end if;
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 if o.approval->>'state'='pending' then raise sqlstate 'PT409' using message='Customer approval required';end if;
 select * into j from public.zzws_report_deliveries where order_id=p_order and (fingerprint=p_fingerprint or order_revision=p_revision) order by (fingerprint=p_fingerprint) desc limit 1 for update;
 if j.id is not null and (j.counts->>'deliverySchema' is distinct from '1') or j.id is null and (p_counts->>'deliverySchema' is distinct from '1') then
  return public.zzws_report_claim_before_recipients(p_actor,p_order,p_revision,p_request,p_fingerprint,p_counts);
 end if;
 if j.id is not null then
  if j.actor_id<>p_actor or j.fingerprint<>p_fingerprint or j.order_revision<>p_revision then raise sqlstate 'PT409';end if;
  if j.state in ('accepted','completed') then return to_jsonb(j);end if;
 end if;
 if o.revision<>p_revision or o.received_at is not null or o.status in ('received','completed','rejected') then raise sqlstate 'PT409';end if;
 if j.id is null then
  if jsonb_typeof(p_counts->'deliveries') is distinct from 'array' or jsonb_array_length(p_counts->'deliveries') not between 1 and 50 then raise sqlstate 'PT400';end if;
  if exists(select 1 from jsonb_array_elements(p_counts->'deliveries') e where jsonb_typeof(e) is distinct from 'object' or coalesce(e->>'id','')!~'^r[0-9]{1,2}$' or coalesce(e->>'role','') not in ('to','cc','bcc') or coalesce(e->>'state','') not in ('pending','invalid') or e->'attempts' is distinct from '0'::jsonb or jsonb_typeof(e->'address') is distinct from 'string' or length(e->>'address')>254)
   or (select count(*) from jsonb_array_elements(p_counts->'deliveries'))<>(select count(distinct e->>'id') from jsonb_array_elements(p_counts->'deliveries') e)
   or (select count(*) from jsonb_array_elements(p_counts->'deliveries') e where e->>'state'='pending')<>(select count(distinct lower(e->>'address')) from jsonb_array_elements(p_counts->'deliveries') e where e->>'state'='pending')
  then raise sqlstate 'PT400';end if;
  insert into public.zzws_report_deliveries(order_id,order_revision,actor_id,request_id,fingerprint,state,attempts,lease,lease_until,counts)
   values(p_order,p_revision,p_actor,p_request,p_fingerprint,'sending',1,gen_random_uuid(),clock_timestamp()+interval '2 minutes',p_counts) returning * into j;
 else
  j=jsonb_populate_record(null::public.zzws_report_deliveries,public.zzws_report_recipient_status(p_actor,j.id));
  if j.state='sending' and j.lease_until>clock_timestamp() then return to_jsonb(j)||'{"busy":true}'::jsonb;end if;
  if j.created<clock_timestamp()-interval '23 hours' then
   select jsonb_agg(case when value->>'state' in ('pending','retry') then value||jsonb_build_object('state','failed','reason','expired') else value end order by ordinal)
   into entries from jsonb_array_elements(j.counts->'deliveries') with ordinality t(value,ordinal);j.counts=jsonb_set(j.counts,'{deliveries}',entries);
  end if;
  next_state=public.zzws_report_delivery_state(j.counts);
  if next_state<>'retry' then
   update public.zzws_report_deliveries set counts=j.counts,state=next_state,accepted_at=case when next_state='accepted' then coalesce(accepted_at,now()) else accepted_at end,lease=null,lease_until=null,updated=now() where id=j.id returning * into j;return to_jsonb(j);
  end if;
  update public.zzws_report_deliveries set counts=j.counts,state='sending',attempts=least(2,attempts+1),lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',updated=now() where id=j.id returning * into j;
 end if;
 return to_jsonb(j);
end $$;

create function public.zzws_report_recipient_claim(p_actor uuid,p_job uuid,p_lease uuid,p_recipient text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;r jsonb;entries jsonb;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema' is distinct from '1' or j.state<>'sending' or j.lease is distinct from p_lease or j.lease_until<=clock_timestamp() then raise sqlstate 'PT409';end if;
 select value into r from jsonb_array_elements(j.counts->'deliveries') where value->>'id'=p_recipient;
 if r is null then raise sqlstate 'PT400';end if;
 if coalesce(r->>'state','') not in ('pending','retry') or coalesce(r->>'attempts','')!~'^[01]$' then return jsonb_build_object('send',false,'recipient',r);end if;
 r=r||jsonb_build_object('state','sending','attempts',(r->>'attempts')::integer+1,'lease',gen_random_uuid());
 select jsonb_agg(case when value->>'id'=p_recipient then r else value end order by ordinal) into entries from jsonb_array_elements(j.counts->'deliveries') with ordinality t(value,ordinal);
 update public.zzws_report_deliveries set counts=jsonb_set(counts,'{deliveries}',entries),lease_until=clock_timestamp()+interval '2 minutes',updated=now() where id=j.id;
 return jsonb_build_object('send',true,'recipient',r);
end $$;

create function public.zzws_report_recipient_result(p_actor uuid,p_job uuid,p_lease uuid,p_recipient text,p_recipient_lease uuid,p_result text,p_provider text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;r jsonb;entries jsonb;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema' is distinct from '1' or j.state<>'sending' or j.lease is distinct from p_lease then raise sqlstate 'PT409';end if;
 select value into r from jsonb_array_elements(j.counts->'deliveries') where value->>'id'=p_recipient;
 if r is null or r->>'state'<>'sending' or (r->>'lease')::uuid is distinct from p_recipient_lease then raise sqlstate 'PT409';end if;
 if p_result is null or p_result not in ('accepted','rejected','unknown') or p_result='accepted' and (p_provider is null or length(p_provider) not between 1 and 200) then raise sqlstate 'PT400';end if;
 r=(r-'lease'-'reason')||jsonb_build_object('state',case when p_result='accepted' then 'accepted' when p_result='unknown' then 'uncertain' when (r->>'attempts')::integer<2 then 'retry' else 'failed' end);
 if p_result='accepted' then r=r||jsonb_build_object('providerId',p_provider,'acceptedAt',clock_timestamp());else r=r||jsonb_build_object('reason',case when p_result='unknown' then 'unknown_outcome' else 'rejected' end);end if;
 select jsonb_agg(case when value->>'id'=p_recipient then r else value end order by ordinal) into entries from jsonb_array_elements(j.counts->'deliveries') with ordinality t(value,ordinal);
 update public.zzws_report_deliveries set counts=jsonb_set(counts,'{deliveries}',entries),updated=now() where id=j.id returning * into j;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_recipient_result',jsonb_build_object('orderId',j.order_id,'jobId',j.id,'recipientId',p_recipient,'result',r->>'state','attempt',r->'attempts')::text);
 return to_jsonb(j);
end $$;

create function public.zzws_report_recipient_finish(p_actor uuid,p_job uuid,p_lease uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;next_state text;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema' is distinct from '1' or j.state<>'sending' or j.lease is distinct from p_lease then raise sqlstate 'PT409';end if;
 if exists(select 1 from jsonb_array_elements(j.counts->'deliveries') where value->>'state'='sending') then return to_jsonb(j)||'{"busy":true}'::jsonb;end if;
 next_state=public.zzws_report_delivery_state(j.counts);
 update public.zzws_report_deliveries set state=next_state,accepted_at=case when next_state='accepted' then now() else accepted_at end,provider_id=case when next_state='accepted' then 'per-recipient/'||id::text else provider_id end,lease=null,lease_until=null,updated=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;

-- An older Edge process must not promote a recipient-ledger job using the old
-- all-or-nothing result RPC. Completion also verifies the recipient invariant.
alter function public.zzws_report_result(uuid,uuid,uuid,text,text) rename to zzws_report_result_before_recipients;
create function public.zzws_report_result(p_actor uuid,p_job uuid,p_lease uuid,p_result text,p_provider text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;begin
 select * into j from public.zzws_report_deliveries where id=p_job for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema'='1' then raise sqlstate 'PT409' using message='Per-recipient result required';end if;
 return public.zzws_report_result_before_recipients(p_actor,p_job,p_lease,p_result,p_provider);
end $$;
alter function public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb) rename to zzws_report_complete_before_recipients;
create function public.zzws_report_complete(p_actor uuid,p_order uuid,p_job uuid,p_lines jsonb,p_total numeric,p_changes jsonb,p_context jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.zzws_report_deliveries;uid uuid;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 -- Preserve the original receipt-gate, order, job lock order in the delegated RPC.
 select user_id into uid from public.zzws_orders where id=p_order;if uid is not null then perform public.zzws_receipt_state(uid);end if;
 perform 1 from public.zzws_orders where id=p_order for update;
 select * into j from public.zzws_report_deliveries where id=p_job and order_id=p_order for update;
 if j.id is null or j.actor_id<>p_actor then raise sqlstate 'PT403';end if;
 if j.counts->>'deliverySchema'='1' and public.zzws_report_delivery_state(j.counts)<>'accepted' then raise sqlstate 'PT409' using message='Recipients are not all accepted';end if;
 return public.zzws_report_complete_before_recipients(p_actor,p_order,p_job,p_lines,p_total,p_changes,p_context);
end $$;

revoke all on function public.zzws_report_delivery_state(jsonb),public.zzws_report_recipient_status(uuid,uuid),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb),public.zzws_report_recipient_claim(uuid,uuid,uuid,text),public.zzws_report_recipient_result(uuid,uuid,uuid,text,uuid,text,text),public.zzws_report_recipient_finish(uuid,uuid,uuid),public.zzws_report_result(uuid,uuid,uuid,text,text),public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_report_delivery_state(jsonb),public.zzws_report_recipient_status(uuid,uuid),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb),public.zzws_report_recipient_claim(uuid,uuid,uuid,text),public.zzws_report_recipient_result(uuid,uuid,uuid,text,uuid,text,text),public.zzws_report_recipient_finish(uuid,uuid,uuid),public.zzws_report_result(uuid,uuid,uuid,text,text),public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb) to service_role;

commit;
