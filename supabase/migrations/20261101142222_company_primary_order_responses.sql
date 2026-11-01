-- Extend responses to an employee's company primary, without changing order authorship.
begin;

-- Parameters come only from a locked order row and the authenticated API actor.
-- No password/session, contact email or phone is copied into the public actor DTO.
create function public.zzws_order_response_actor(p_user uuid,p_owner uuid,p_customer uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.zzws_users;fallback boolean;begin
 select * into actor from public.zzws_users where id=p_user and active and deleted_at is null and archived_at is null;
 if not found then raise sqlstate 'PT403';end if;
 fallback=p_owner is distinct from p_user;
 if fallback and not coalesce((
  actor.profile->>'role'='client' and actor.customer_id is null and actor.id=p_customer
  and not actor.needs_password_setup and not actor.needs_profile_setup
  and exists(select 1 from public.zzws_users author where author.id=p_owner and author.customer_id=actor.id and author.profile->>'role'='client')
 ),false) then raise sqlstate 'PT404';end if;
 return jsonb_build_object('id',actor.id,'firstName',coalesce(actor.person->>'firstName',''),'lastName',coalesce(actor.person->>'lastName',''),
  'login',actor.login,'clientRole',case when actor.profile->>'role'='client' then case when actor.customer_id is null then 'manager' else 'employee' end else null end,'actingForAuthor',fallback);
end $$;

-- Preserve reason-audited reopening; extend only the completed -> received path.
create or replace function public.zzws_closed_order_reason_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare source text=coalesce(current_setting('zzws.source',true),'');begin
 if old.status in ('received','completed','rejected') and new.status is distinct from old.status and source<>'closed_order_reopened' then
  if old.status='completed' and new.status='received' and new.received_at is not null then
   if new.received_by=old.user_id then return new;end if;
   if source='receipt' and new.received_by is not null and new.receipt->'actor'->>'id'=new.received_by::text and current_setting('zzws.actor',true)=new.received_by::text then
    perform public.zzws_order_response_actor(new.received_by,old.user_id,old.customer_id);return new;
   end if;
  end if;
  raise sqlstate 'PT409' using message='Reopen the closed order with a reason first';
 end if;return new;
end $$;

create or replace function public.zzws_respond_order_approval(p_user uuid,p_order uuid,p_revision integer,p_proposal uuid,p_decision text,p_declined jsonb,p_request uuid,p_total numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result public.zzws_orders;a jsonb;kept jsonb;checked jsonb;response jsonb;actual numeric;owner uuid;actor jsonb;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active and profile->>'role'='client') then raise sqlstate 'PT403';end if;
 select user_id into owner from public.zzws_orders where id=p_order;if owner is null then raise sqlstate 'PT404';end if;
 -- All order mutations lock the author's receipt gate before the order itself.
 perform public.zzws_receipt_state(owner);
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 actor=public.zzws_order_response_actor(p_user,o.user_id,o.customer_id);a=o.approval;
 if p_proposal is null or a->>'id' is distinct from p_proposal::text then raise sqlstate 'PT409';end if;
 if p_decision is null or p_decision not in ('accept','reject') or p_request is null or p_declined is null or jsonb_typeof(p_declined)<>'array' or jsonb_array_length(p_declined)>500 then raise sqlstate 'PT400';end if;
 if exists(select 1 from jsonb_array_elements(p_declined) d where jsonb_typeof(d)<>'string') or jsonb_array_length(p_declined)<>(select count(distinct value) from jsonb_array_elements_text(p_declined)) then raise sqlstate 'PT400';end if;
 if exists(select 1 from jsonb_array_elements_text(p_declined) d where not exists(select 1 from jsonb_array_elements(a->'lines') l where l->>'articul'=d)) then raise sqlstate 'PT400';end if;
 response=jsonb_build_object('decision',p_decision,'declinedArticuls',p_declined,'actor',actor);
 if a->>'state' is distinct from 'pending' then
  if a->>'responseRequestId'=p_request::text and ((a->'response')-'actor')=(response-'actor') and coalesce(a->'response'->'actor'->>'id',o.user_id::text)=p_user::text then return to_jsonb(o);end if;
  raise sqlstate 'PT409';
 end if;
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
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(o.id,o.user_id,result.revision,jsonb_build_object('kind','approval_'||case when p_decision='accept' then 'approved' else 'declined' end,'number',o.number,'status',result.status,'proposalId',p_proposal,'declinedArticuls',p_declined,'total',result.total,'actor',actor,'changes','[]'::jsonb),case when p_user=o.user_id then now() else null end);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_approval_response',jsonb_build_object('number',o.number,'revision',result.revision,'decision',p_decision,'declinedArticuls',p_declined,'actor',actor)::text);
 perform public.zzws_receipt_state(owner);return to_jsonb(result);
end $$;

create or replace function public.zzws_defer_order_approval(p_user uuid,p_order uuid,p_revision integer,p_proposal uuid,p_minutes integer,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.zzws_orders;result public.zzws_orders;owner uuid;actor jsonb;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active and profile->>'role'='client') then raise sqlstate 'PT403';end if;
 if p_minutes is null or p_minutes not between 1 and 60 or p_request is null or p_proposal is null then raise sqlstate 'PT400';end if;
 select user_id into owner from public.zzws_orders where id=p_order;if owner is null then raise sqlstate 'PT404';end if;
 perform public.zzws_receipt_state(owner);
 select * into o from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 actor=public.zzws_order_response_actor(p_user,o.user_id,o.customer_id);
 if o.approval->>'id' is distinct from p_proposal::text or o.approval->>'state' is distinct from 'pending' then raise sqlstate 'PT409';end if;
 if o.approval->>'deferRequestId'=p_request::text then
  if (o.approval->>'reviewRequestedMinutes')::integer=p_minutes and coalesce(o.approval->'deferredBy'->>'id',o.user_id::text)=p_user::text then return to_jsonb(o);end if;
  raise sqlstate 'PT409';
 end if;
 if o.revision is distinct from p_revision or o.received_at is not null or o.status in ('completed','received','rejected') then raise sqlstate 'PT409';end if;
 perform set_config('zzws.actor',p_user::text,true);perform set_config('zzws.source','approval_deferred',true);
 update public.zzws_orders set approval=approval||jsonb_build_object('reviewRequestedMinutes',p_minutes,'reviewRequestedAt',now(),'remindAfter',now()+make_interval(mins=>p_minutes),'deferRequestId',p_request,'deferredBy',actor),revision=revision+1,updated=now() where id=o.id returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(o.id,o.user_id,result.revision,jsonb_build_object('kind','approval_deferred','number',o.number,'status',o.status,'proposalId',p_proposal,'minutes',p_minutes,'remindAfter',result.approval->'remindAfter','actor',actor,'changes','[]'::jsonb),case when p_user=o.user_id then now() else null end);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_approval_deferred',jsonb_build_object('number',o.number,'proposalId',p_proposal,'minutes',p_minutes,'remindAfter',result.approval->'remindAfter','actor',actor)::text);return to_jsonb(result);
end $$;

create or replace function public.zzws_confirm_receipt(p_user uuid,p_order uuid,p_revision integer,p_intact boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old public.zzws_orders;result public.zzws_orders;owner uuid;actor jsonb;statement text='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';begin
 select user_id into owner from public.zzws_orders where id=p_order;if owner is null then raise sqlstate 'PT404';end if;
 perform public.zzws_receipt_state(owner);
 select * into old from public.zzws_orders where id=p_order for update;if not found then raise sqlstate 'PT404';end if;
 actor=public.zzws_order_response_actor(p_user,old.user_id,old.customer_id);
 if old.received_at is not null then return to_jsonb(old);end if;
 if p_intact is distinct from true then raise sqlstate 'PT400' using message='Հաստատեք ամբողջական և անվնաս ստացումը';end if;
 if old.revision is distinct from p_revision then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է։ Թարմացրեք տվյալները և կրկին հաստատեք ստացումը';end if;
 if old.status not in ('confirmed','in_progress','completed') or old.approval->>'state'='pending' then raise sqlstate 'PT409' using message='Նոր կամ մերժված պատվերի ստացումը չի հաստատվում';end if;
 perform set_config('zzws.actor',p_user::text,true);perform set_config('zzws.source','receipt',true);
 update public.zzws_orders set status='received',received_at=now(),received_by=p_user,receipt=jsonb_build_object('version',1,'intact',true,'statement',statement,'orderRevision',old.revision,'confirmedAt',now(),'customer',old.customer,'actor',actor),revision=revision+1,updated=now() where id=old.id returning * into result;
 perform public.zzws_record_order_activity(to_jsonb(old),to_jsonb(result),p_user,'receipt');
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(result.id,old.user_id,result.revision,jsonb_build_object('kind','receipt','number',result.number,'oldStatus',old.status,'status','received','statement',statement,'actor',actor),case when p_user=old.user_id then now() else null end);
 insert into public.zzws_receipt_notices(order_id,number,customer,revision,received_at) values(result.id,result.number,result.customer,result.revision,result.received_at);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_received',jsonb_build_object('number',result.number,'target',result.customer,'statement',statement,'actor',actor)::text);
 perform public.zzws_receipt_state(owner);return to_jsonb(result);
end $$;

revoke all on function public.zzws_order_response_actor(uuid,uuid,uuid),public.zzws_closed_order_reason_guard(),public.zzws_respond_order_approval(uuid,uuid,integer,uuid,text,jsonb,uuid,numeric),public.zzws_defer_order_approval(uuid,uuid,integer,uuid,integer,uuid),public.zzws_confirm_receipt(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.zzws_order_response_actor(uuid,uuid,uuid),public.zzws_closed_order_reason_guard(),public.zzws_respond_order_approval(uuid,uuid,integer,uuid,text,jsonb,uuid,numeric),public.zzws_defer_order_approval(uuid,uuid,integer,uuid,integer,uuid),public.zzws_confirm_receipt(uuid,uuid,integer,boolean) to service_role;
commit;
