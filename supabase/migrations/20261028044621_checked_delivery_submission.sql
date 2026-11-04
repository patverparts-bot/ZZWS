-- Local draft only. Requires 03a plus the existing receipt-confirmation migrations.
begin;
alter table public.zzws_orders add column delivery_variant_id uuid;

create function public.zzws_order_delivery_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare variant jsonb;revision bigint;begin
 if tg_op='UPDATE' then
  if (new.user_id is distinct from old.user_id and not(new.user_id is null and not exists(select 1 from public.zzws_users where id=old.user_id))) or new.delivery_variant_id is distinct from old.delivery_variant_id then raise sqlstate 'PT403' using message='Պատվերի գործընկերը չի կարող փոխվել';end if;
  -- Historical orders retain their original snapshot; instructions may still be edited.
  if old.delivery_variant_id is not null and new.delivery->>'organization' is distinct from old.delivery->>'organization' then raise sqlstate 'PT403' using message='Պատվերի գործընկերը չի կարող փոխվել';end if;
  if old.delivery_variant_id is not null and (new.delivery->>'deliveryVariantId' is distinct from old.delivery->>'deliveryVariantId' or new.delivery->>'profileRevision' is distinct from old.delivery->>'profileRevision') then raise sqlstate 'PT403' using message='Պատվերի առաքման նույնացուցիչը չի կարող փոխվել';end if;
  return new;
 end if;
 if new.delivery_variant_id is null then raise sqlstate 'PT400' using message='Կրկին ընտրեք առաքման տարբերակը';end if;
 begin revision=(new.delivery->>'profileRevision')::bigint;exception when invalid_text_representation or numeric_value_out_of_range then raise sqlstate 'PT400' using message='Թարմացրեք առաքման տվյալները';end;
 variant=public.zzws_delivery_owned(new.user_id,new.delivery_variant_id,revision);
 new.delivery=jsonb_set(new.delivery,'{organization}',to_jsonb(variant->>'organization'));
 new.delivery=jsonb_set(new.delivery,'{deliveryVariantId}',to_jsonb(new.delivery_variant_id::text));
 return new;
end $$;
create trigger zzws_order_delivery_guard before insert or update on public.zzws_orders for each row execute function public.zzws_order_delivery_guard();

create function public.zzws_submit_order_v2(p_user uuid,p_request uuid,p_delivery_variant uuid,p_profile_revision bigint,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;gate jsonb;u public.zzws_users;variant jsonb;snapshot jsonb;customer jsonb;begin
 -- Same lock order as receipt operations. Serializes duplicate requests and the three-order gate.
 gate=public.zzws_receipt_state(p_user);
 select * into u from public.zzws_users where id=p_user and active for share;
 if not found then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into result from public.zzws_orders where user_id=p_user and request_id=p_request;
 if found then return to_jsonb(result);end if;
 if p_delivery_variant is null or p_profile_revision is null then raise sqlstate 'PT400' using message='Թարմացրեք էջը և կրկին ընտրեք առաքման տարբերակը';end if;
 variant=public.zzws_delivery_owned(p_user,p_delivery_variant,p_profile_revision);
 if (gate->>'blocked')::boolean then raise sqlstate 'PT429' using message='Նոր պատվերի համար նախ հաստատեք բոլոր չստացված պատվերների ստացումը';end if;
 snapshot=jsonb_build_object('organization',variant->>'organization','address',left(coalesce(p_delivery->>'address',variant->>'address',''),300),'contact',left(coalesce(p_delivery->>'contact',variant->>'contact',''),300),'method',left(coalesce(p_delivery->>'method',''),300),'date',left(coalesce(p_delivery->>'date',''),300),'comment',left(coalesce(p_delivery->>'comment',''),2000),'deliveryVariantId',p_delivery_variant,'profileRevision',p_profile_revision);
 customer=jsonb_build_object('id',u.id,'login',u.login,'client',u.profile->>'client');
 insert into public.zzws_orders(user_id,request_id,customer,delivery,delivery_variant_id,lines,original_lines,total) values(p_user,p_request,customer,snapshot,p_delivery_variant,p_lines,p_lines,p_total) returning * into result;
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_submit',jsonb_build_object('number',result.number,'target',customer)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;

-- The former signature remains only for retries of already accepted requests.
-- A new request through an old endpoint cannot bypass mandatory variant/revision checks.
create or replace function public.zzws_submit_order(p_user uuid,p_request uuid,p_customer jsonb,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 return public.zzws_submit_order_v2(p_user,p_request,null,null,p_delivery,p_lines,p_total);
end $$;
revoke all on function public.zzws_order_delivery_guard(),public.zzws_submit_order_v2(uuid,uuid,uuid,bigint,jsonb,jsonb,numeric),public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.zzws_order_delivery_guard(),public.zzws_submit_order_v2(uuid,uuid,uuid,bigint,jsonb,jsonb,numeric),public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric) to service_role;
commit;
