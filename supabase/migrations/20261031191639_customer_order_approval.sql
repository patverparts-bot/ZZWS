begin;
alter table public.zzws_orders add column approval jsonb not null default '{}',add column approval_context jsonb,add column approval_catalog_version uuid references public.zzws_versions(id);
alter table public.zzws_orders add constraint zzws_approval_shape check(jsonb_typeof(approval)='object' and (approval='{}'::jsonb or (approval ?& array['id','state','lines'] and jsonb_typeof(approval->'lines')='array' and coalesce(approval->>'state' in ('pending','approved','declined'),false))));
create function public.zzws_customer_approval_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare source text=coalesce(current_setting('zzws.source',true),'');is_client boolean;begin
 if tg_op='INSERT' then if new.approval<>'{}'::jsonb then raise sqlstate 'PT400';end if;return new;end if;
 select coalesce(u.profile->>'role'='client',false) into is_client from public.zzws_users u where u.id=old.user_id;
 if source not in ('approval_requested','approval_response','approval_deferred') then
  if new.approval is distinct from old.approval or new.approval_context is distinct from old.approval_context or new.approval_catalog_version is distinct from old.approval_catalog_version or old.approval->>'state'='pending' or is_client and (new.lines is distinct from old.lines or new.total is distinct from old.total)
  then raise sqlstate 'PT409' using message='Սկզբում անհրաժեշտ է հաճախորդի համաձայնությունը';end if;
 end if;return new;
end $$;
create trigger zzws_customer_approval_guard before insert or update on public.zzws_orders for each row execute function public.zzws_customer_approval_guard();
create function public.zzws_propose_order_change(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_context jsonb,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result public.zzws_orders;checked jsonb;who text;offer jsonb;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope in ('owner','manager')) then raise sqlstate 'PT403';end if;
 perform public.zzws_receipt_state((select user_id from public.zzws_orders where id=p_order));
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 if o.revision is distinct from p_revision or o.received_at is not null or o.status in ('completed','received','rejected') then raise sqlstate 'PT409';end if;
 if not exists(select 1 from public.zzws_users where id=o.user_id and active and profile->>'role'='client') then raise sqlstate 'PT403';end if;
 if p_status not in ('new','confirmed','in_progress','rejected') or p_status is null then raise sqlstate 'PT400';end if;
 if p_draft is not null and not exists(select 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='order' and expires>now()) then raise sqlstate 'PT409';end if;
 checked=public.zzws_validate_calculation(o.user_id,p_context,p_lines,p_total);
 select coalesce(profile->>'client',login) into who from public.zzws_users where id=p_actor;
 offer=jsonb_build_object('id',gen_random_uuid(),'state','pending','baseRevision',o.revision,'beforeLines',o.lines,'lines',p_lines,'total',p_total,'comment',left(coalesce(p_comment,''),2000),'requestedStatus',p_status,'delivery',coalesce(p_delivery,o.delivery),'confirmation',coalesce(p_confirmation,o.confirmation),'requestedAt',now(),'requestedBy',who);
 perform set_config('zzws.actor',p_actor::text,true);perform set_config('zzws.source','approval_requested',true);
 update public.zzws_orders set approval=offer,approval_context=checked,approval_catalog_version=(checked->>'catalogVersion')::uuid,revision=revision+1,updated=now() where id=o.id returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(o.id,o.user_id,result.revision,jsonb_build_object('kind','approval_requested','number',o.number,'status',o.status,'proposalId',offer->>'id','changes',coalesce(p_detail->'changes','[]'::jsonb),'total',p_total));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_approval_requested',jsonb_build_object('number',o.number,'revision',result.revision,'proposalId',offer->>'id')::text);
 if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;return to_jsonb(result);
end $$;
alter function public.zzws_update_order_v3(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb) rename to zzws_update_order_v3_before_approval;
create function public.zzws_update_order_v3(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_context jsonb,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope in ('owner','manager')) then raise sqlstate 'PT403';end if;
 select * into o from public.zzws_orders where id=p_order;if not found then raise sqlstate 'PT404';end if;
 if o.user_id is not null and exists(select 1 from public.zzws_users where id=o.user_id and profile->>'role'='client') and (o.lines is distinct from p_lines or o.total is distinct from p_total) then
  return public.zzws_propose_order_change(p_order,p_revision,p_lines,p_status,p_comment,p_total,p_detail,p_actor,p_context,p_draft,p_delivery,p_confirmation);
 end if;
 return public.zzws_update_order_v3_before_approval(p_order,p_revision,p_lines,p_status,p_comment,p_total,p_detail,p_actor,p_context,p_draft,p_delivery,p_confirmation);
end $$;
create function public.zzws_respond_order_approval(p_user uuid,p_order uuid,p_revision integer,p_proposal uuid,p_decision text,p_declined jsonb,p_request uuid,p_total numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result public.zzws_orders;a jsonb;kept jsonb;checked jsonb;response jsonb;actual numeric;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active and profile->>'role'='client') then raise sqlstate 'PT403';end if;
 perform public.zzws_receipt_state(p_user);
 select * into o from public.zzws_orders where id=p_order and user_id=p_user for update;if not found then raise sqlstate 'PT404';end if;a=o.approval;
 if p_proposal is null or a->>'id' is distinct from p_proposal::text then raise sqlstate 'PT409';end if;
 if p_decision is null or p_decision not in ('accept','reject') or p_request is null or p_declined is null or jsonb_typeof(p_declined)<>'array' or jsonb_array_length(p_declined)>500 then raise sqlstate 'PT400';end if;
 if exists(select 1 from jsonb_array_elements(p_declined) d where jsonb_typeof(d)<>'string') or jsonb_array_length(p_declined)<>(select count(distinct value) from jsonb_array_elements_text(p_declined)) then raise sqlstate 'PT400';end if;
 if exists(select 1 from jsonb_array_elements_text(p_declined) d where not exists(select 1 from jsonb_array_elements(a->'lines') l where l->>'articul'=d)) then raise sqlstate 'PT400';end if;
 response=jsonb_build_object('decision',p_decision,'declinedArticuls',p_declined);
 if a->>'state'<>'pending' then if a->>'responseRequestId'=p_request::text and a->'response'=response then return to_jsonb(o);end if;raise sqlstate 'PT409';end if;
 if o.revision is distinct from p_revision or o.received_at is not null or o.status in ('completed','received','rejected') then raise sqlstate 'PT409';end if;
 select coalesce(jsonb_agg(l order by ord),'[]'::jsonb) into kept from jsonb_array_elements(a->'lines') with ordinality x(l,ord) where not(p_declined ? (l->>'articul'));
 if p_decision='accept' and jsonb_array_length(a->'lines')>0 and jsonb_array_length(kept)=0 then raise sqlstate 'PT400' using message='Մերժեք ամբողջ պատվերը կամ ընտրեք առնվազն մեկ ապրանք';end if;
 checked=o.approval_context;
 if p_decision='accept' then
  select coalesce(sum((l->>'qty')::numeric*(l->>'unitPrice')::numeric),0) into actual from jsonb_array_elements(kept) l;
  if p_total is null or p_total<0 or abs(actual-p_total)>0.0050001 then raise sqlstate 'PT400';end if;
  checked=checked||jsonb_build_object('orderTotal',p_total,'operation','customer_approval','approvalId',p_proposal,
   'lines',(select coalesce(jsonb_agg(l order by ord),'[]'::jsonb) from jsonb_array_elements(checked->'lines') with ordinality x(l,ord) where not(p_declined ? (l->>'articul'))),
   'checkedProducts',(select coalesce(jsonb_agg(l order by ord),'[]'::jsonb) from jsonb_array_elements(checked->'checkedProducts') with ordinality x(l,ord) where not(p_declined ? (l->>'articul'))));
 end if;
 a=a||jsonb_build_object('state',case when p_decision='accept' then 'approved' else 'declined' end,'responseRequestId',p_request,'response',response,'respondedAt',now(),'acceptedLines',case when p_decision='accept' then kept else '[]'::jsonb end);
 perform set_config('zzws.actor',p_user::text,true);perform set_config('zzws.source','approval_response',true);
 update public.zzws_orders set approval=a,lines=case when p_decision='accept' then kept else lines end,total=case when p_decision='accept' then p_total else total end,
  status=case when p_decision='reject' or jsonb_array_length(kept)=0 then 'rejected' else 'confirmed' end,
  comment=case when p_decision='accept' then coalesce(a->>'comment','') else comment end,delivery=case when p_decision='accept' then a->'delivery' else delivery end,confirmation=case when p_decision='accept' then a->'confirmation' else confirmation end,revision=revision+1,updated=now() where id=o.id returning * into result;
 if p_decision='accept' then
  checked=checked||jsonb_build_object('orderRevision',result.revision);
  insert into public.zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context)
  values(o.id,result.revision,1,(checked->>'catalogVersion')::uuid,(checked->>'rulesRevision')::uuid,checked->>'clientCategory',(checked->>'profileRevision')::bigint,kept,p_total,checked);
 end if;
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(o.id,p_user,result.revision,jsonb_build_object('kind','approval_'||case when p_decision='accept' then 'approved' else 'declined' end,'number',o.number,'status',result.status,'proposalId',p_proposal,'declinedArticuls',p_declined,'total',result.total,'changes','[]'::jsonb),now());
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_approval_response',jsonb_build_object('number',o.number,'revision',result.revision,'decision',p_decision,'declinedArticuls',p_declined)::text);return to_jsonb(result);
end $$;
do $$declare definition text;begin
 select pg_get_functiondef('public.zzws_record_order_activity(jsonb,jsonb,uuid,text)'::regprocedure) into definition;
 if position('''received_at'']' in definition)=0 then raise exception 'Unexpected order activity definition';end if;
 definition=replace(definition,'''received_at'']','''received_at'',''approval'']');
 definition=replace(definition,'''received_at'',p_after->''received_at'')','''received_at'',p_after->''received_at'',''approval'',p_after->''approval'')');execute definition;
end $$;
alter function public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb) rename to zzws_report_claim_before_approval;
create function public.zzws_report_claim(p_actor uuid,p_order uuid,p_revision integer,p_request uuid,p_fingerprint text,p_counts jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 perform 1 from public.zzws_orders where id=p_order for update;
 if exists(select 1 from public.zzws_orders where id=p_order and approval->>'state'='pending') then raise sqlstate 'PT409' using message='Սպասեք հաճախորդի համաձայնությանը';end if;
 return public.zzws_report_claim_before_approval(p_actor,p_order,p_revision,p_request,p_fingerprint,p_counts);
end $$;
revoke all on function public.zzws_customer_approval_guard(),public.zzws_propose_order_change(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_update_order_v3(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_respond_order_approval(uuid,uuid,integer,uuid,text,jsonb,uuid,numeric),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_customer_approval_guard(),public.zzws_propose_order_change(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_update_order_v3(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,jsonb,uuid,jsonb,jsonb),public.zzws_respond_order_approval(uuid,uuid,integer,uuid,text,jsonb,uuid,numeric),public.zzws_report_claim(uuid,uuid,integer,uuid,text,jsonb) to service_role;

-- Never export an unapproved revision through background accounting/report workers.
do $$declare definition text;begin
 select pg_get_functiondef('public.zzws_enqueue_integration()'::regprocedure) into definition;
 definition=replace(definition,'begin','begin if new.snapshot->''approval''->>''state''=''pending'' then return new;end if;');execute definition;
 select pg_get_functiondef('public.zzws_claim_integration(uuid,integer)'::regprocedure) into definition;
 definition=replace(definition,'q.system_id=p_system and q.state', 'not exists(select 1 from public.zzws_orders o where o.id=q.order_id and o.approval->>''state''=''pending'') and q.system_id=p_system and q.state');execute definition;
 select pg_get_functiondef('public.zzws_report_complete(uuid,uuid,uuid,jsonb,numeric,jsonb,jsonb)'::regprocedure) into definition;
 definition=replace(definition,'result=public.zzws_update_order_v3', 'if o.approval->>''state''=''pending'' or exists(select 1 from public.zzws_users u where u.id=o.user_id and u.profile->>''role''=''client'') and (o.lines is distinct from p_lines or o.total is distinct from p_total) then raise sqlstate ''PT409'' using message=''Customer approval required'';end if;result=public.zzws_update_order_v3');execute definition;
 select pg_get_functiondef('public.zzws_mobile_capture_order()'::regprocedure) into definition;
 definition=replace(definition,'when new.changes ? ''status''', 'when new.changes ? ''approval'' or new.changes ? ''status''');execute definition;
end $$;

create function public.zzws_defer_order_approval(p_user uuid,p_order uuid,p_revision integer,p_proposal uuid,p_minutes integer,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result public.zzws_orders;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active and profile->>'role'='client') then raise sqlstate 'PT403';end if;
 if p_minutes is null or p_minutes not between 1 and 60 or p_request is null or p_proposal is null then raise sqlstate 'PT400';end if;
 select * into o from public.zzws_orders where id=p_order and user_id=p_user for update;if not found then raise sqlstate 'PT404';end if;
 if o.approval->>'id' is distinct from p_proposal::text or o.approval->>'state' is distinct from 'pending' then raise sqlstate 'PT409';end if;
 if o.approval->>'deferRequestId'=p_request::text then if (o.approval->>'reviewRequestedMinutes')::integer=p_minutes then return to_jsonb(o);end if;raise sqlstate 'PT409';end if;
 if o.revision is distinct from p_revision then raise sqlstate 'PT409';end if;
 perform set_config('zzws.actor',p_user::text,true);perform set_config('zzws.source','approval_deferred',true);
 update public.zzws_orders set approval=approval||jsonb_build_object('reviewRequestedMinutes',p_minutes,'reviewRequestedAt',now(),'remindAfter',now()+make_interval(mins=>p_minutes),'deferRequestId',p_request),revision=revision+1,updated=now() where id=o.id returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(o.id,p_user,result.revision,jsonb_build_object('kind','approval_deferred','number',o.number,'status',o.status,'proposalId',p_proposal,'minutes',p_minutes,'remindAfter',result.approval->'remindAfter','changes','[]'::jsonb),now());
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_approval_deferred',jsonb_build_object('number',o.number,'proposalId',p_proposal,'minutes',p_minutes,'remindAfter',result.approval->'remindAfter')::text);return to_jsonb(result);
end $$;
revoke all on function public.zzws_defer_order_approval(uuid,uuid,integer,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.zzws_defer_order_approval(uuid,uuid,integer,uuid,integer,uuid) to service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.zzws_mobile_capture_order()'::regprocedure) into definition;
 definition=replace(definition,'where u.profile->>''role''=''client'' and public.zzws_mobile_event_allowed','where new.source<>''approval_deferred'' and u.profile->>''role''=''client'' and public.zzws_mobile_event_allowed');execute definition;
end $$;

alter function public.zzws_android_job(uuid,uuid) rename to zzws_android_job_before_approval;
create function public.zzws_android_job(p_id uuid,p_token uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare job jsonb;a public.zzws_order_activity;action text;begin
 job=public.zzws_android_job_before_approval(p_id,p_token);if job is null then return null;end if;
 select * into a from public.zzws_order_activity where id=(job->>'eventId')::uuid;
 action=case a.source when 'approval_requested' then 'requested' when 'approval_deferred' then 'deferred' when 'approval_response' then a.snapshot->'approval'->>'state' end;
 if action in ('requested','approved','declined','deferred') then job=job||jsonb_build_object('approvalAction',action,'kind','order.status');if action='deferred' then job=job||jsonb_build_object('reviewMinutes',(a.snapshot->'approval'->>'reviewRequestedMinutes')::integer);end if;end if;return job;
end $$;
revoke all on function public.zzws_android_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_android_job(uuid,uuid) to service_role;
commit;
