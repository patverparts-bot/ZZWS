-- Local/test migration. Keep legacy import API intact and add explicit full-card batches.
create function public.zzws_import_user_cards(p_draft uuid,p_actor uuid,p_users jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare item jsonb; prior public.zzws_users; prior_scope text; prior_channel integer; prior_receipt uuid; profile jsonb; target uuid;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope='owner') then raise sqlstate 'PT403' using message='Անհրաժեշտ է սեփականատիրոջ իրավունք';end if;
 perform pg_advisory_xact_lock(9302803);
 perform 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='users' and expires>now() for update;if not found then raise sqlstate 'PT409' using message='Նախադիտումը լրացել է';end if;
 if jsonb_typeof(p_users)<>'array' or jsonb_array_length(p_users) not between 1 and 1000 then raise sqlstate 'PT400' using message='Սխալ խմբաքանակ';end if;
 -- Lock/check the whole batch before changing any card or privilege.
 for item in select value from jsonb_array_elements(p_users) order by value->>'login' loop
  target=(item->>'id')::uuid;if target=p_actor then raise sqlstate 'PT403' using message='Սեփական քարտի ներմուծումն արգելված է';end if;
  select * into prior from public.zzws_users where login=item->>'login' for update;
  if (prior.id is not null and (prior.id<>target or prior.id::text is distinct from item->>'expectedUserId' or prior.profile_revision is distinct from (item->>'expectedProfileRevision')::bigint)) or (prior.id is null and nullif(item->>'expectedUserId','') is not null) then raise sqlstate 'PT409' using message='Օգտատերը փոխվել է';end if;
  select scope into prior_scope from public.zzws_admin_scopes where user_id=target for update;
  if prior_scope is distinct from item->>'expectedScope' then raise sqlstate 'PT409' using message='Իրավունքները փոխվել են';end if;
  select revision into prior_channel from public.zzws_user_channels where user_id=target for update;
  if coalesce(prior_channel,0) is distinct from (item->>'expectedChannelRevision')::integer then raise sqlstate 'PT409' using message='Կապերը փոխվել են';end if;
  select revision into prior_receipt from public.zzws_client_receipt_controls where user_id=target for update;
  if prior_receipt is distinct from (item->>'expectedReceiptRevision')::uuid then raise sqlstate 'PT409' using message='Ստացման կարգավորումը փոխվել է';end if;
  if item->'profile'->>'role' not in ('admin','client') or (item->>'scope' is not null and item->>'scope' not in ('owner','manager','price','viewer')) then raise sqlstate 'PT400' using message='Սխալ դեր';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_users) order by value->>'login' loop
  target=(item->>'id')::uuid;select * into prior from public.zzws_users where id=target;
  profile=jsonb_set(item->'profile','{rowsList}',public.zzws_delivery_reconcile(coalesce(prior.profile->'rowsList','[]'),item->'profile'->'rowsList','import',false));
  -- Batch CAS and ownership reconciliation above replace the manual-only wrapper.
  perform public.zzws_save_user_stage1_legacy(target,item->>'login',profile,(item->>'active')::boolean,p_actor);
  if profile->>'role'='client' or (item->>'setScope')::boolean then
   if profile->>'role'='client' or item->>'scope' is null then delete from public.zzws_admin_scopes where user_id=target;
   else insert into public.zzws_admin_scopes(user_id,scope) values(target,item->>'scope') on conflict(user_id) do update set scope=excluded.scope;end if;
  end if;
  if profile->>'role'='admin' and (item->>'setChannels')::boolean then
   perform public.zzws_save_channels_v2(p_actor,target,(item->'channels'->>'mobile')::boolean,(item->'channels'->>'telegram')::boolean,(item->>'expectedChannelRevision')::integer,true,item->'channels'->>'telegramId',true,item->'channels'->>'bot');
  elsif profile->>'role'='client' then
   update public.zzws_admin_devices set active=false,updated=now() where user_id=target;
   update public.zzws_user_channels set mobile_admin_enabled=false,telegram_enabled=false,revision=revision+1,updated=now() where user_id=target and (mobile_admin_enabled or telegram_enabled);
  end if;
  if profile->>'role'='client' and item->'receipt'<>'null'::jsonb then perform public.zzws_save_receipt_control(p_actor,target,item->'receipt'->>'mode',(item->'receipt'->>'until')::timestamptz,(item->>'expectedReceiptRevision')::uuid);end if;
 end loop;
 -- Revoke delivery eligibility after role/access changes, without retargeting queued messages.
 update public.zzws_notification_recipients set active=false where active and not public.zzws_notification_allowed(id);
 update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null,last_error='recipient_revoked' where q.state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and not r.active);
 delete from public.zzws_drafts where id=p_draft;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'users_import',jsonb_build_object('format',2,'count',jsonb_array_length(p_users))::text);
end $$;
revoke all on function public.zzws_import_user_cards(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_import_user_cards(uuid,uuid,jsonb) to service_role;
