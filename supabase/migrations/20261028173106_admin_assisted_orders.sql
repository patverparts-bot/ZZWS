-- Local/test only. Provenance is separate from the customer who owns the order.
alter table public.zzws_orders add column created_by jsonb;
create function public.zzws_order_author_immutable() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if new.created_by is distinct from old.created_by then raise sqlstate 'PT403' using message='Պատվերը լրացրած աշխատակիցը չի կարող փոխվել';end if;return new;
end $$;
create trigger zzws_order_author_immutable before update on public.zzws_orders for each row execute function public.zzws_order_author_immutable();
create function public.zzws_submit_customer_order(p_actor uuid,p_user uuid,p_request uuid,p_delivery_variant uuid,p_profile_revision bigint,p_delivery jsonb,p_lines jsonb,p_total numeric,p_context jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.zzws_users;u public.zzws_users;o public.zzws_orders;gate jsonb;variant jsonb;checked jsonb;snapshot jsonb;author jsonb;begin
 select * into a from public.zzws_users where id=p_actor and active and profile->>'role'='admin' for share;
 if not found then raise sqlstate 'PT403' using message='Պատվեր ստեղծելու իրավունքը բացակայում է';end if;
 perform 1 from public.zzws_admin_scopes where user_id=p_actor and scope in ('owner','manager') for share;if not found then raise sqlstate 'PT403' using message='Պատվեր ստեղծելու իրավունքը բացակայում է';end if;
 gate=public.zzws_receipt_state(p_user);
 select * into u from public.zzws_users where id=p_user and active and profile->>'role'='client' for share;if not found then raise sqlstate 'PT403' using message='Ընտրեք գործող հաճախորդ';end if;
 select * into o from public.zzws_orders where user_id=p_user and request_id=p_request;
 if found then if o.created_by->>'id' is distinct from p_actor::text then raise sqlstate 'PT409' using message='Ուղարկման նույնացուցիչն արդեն օգտագործվել է';end if;return to_jsonb(o);end if;
 if p_delivery_variant is null or p_profile_revision is null or (p_context->>'profileRevision')::bigint is distinct from p_profile_revision then raise sqlstate 'PT409' using message='Թարմացրեք հաճախորդի տվյալները';end if;
 variant=public.zzws_delivery_owned(p_user,p_delivery_variant,p_profile_revision);
 if (gate->>'blocked')::boolean then raise sqlstate 'PT429' using message='Հաճախորդը պետք է հաստատի նախորդ պատվերների ստացումը';end if;
 checked=public.zzws_validate_calculation(p_user,p_context,p_lines,p_total);
 if jsonb_array_length(p_lines)=0 or exists(select 1 from jsonb_array_elements(checked->'lines') x where (x->>'requestedQty')::numeric is distinct from (x->>'qty')::numeric or (x->>'catalogUnitPrice')::numeric is distinct from (x->>'chargedUnitPrice')::numeric) then raise sqlstate 'PT400' using message='Պահպանեք հաճախորդի գինը և պահանջված քանակը';end if;
 snapshot=jsonb_build_object('organization',variant->>'organization','address',left(coalesce(p_delivery->>'address',variant->>'address',''),300),'contact',left(coalesce(p_delivery->>'contact',variant->>'contact',''),300),'method',left(coalesce(p_delivery->>'method',''),300),'date',left(coalesce(p_delivery->>'date',''),300),'comment',left(coalesce(p_delivery->>'comment',''),2000),'deliveryVariantId',p_delivery_variant,'profileRevision',p_profile_revision);
 author=jsonb_build_object('id',a.id,'login',a.login,'name',a.profile->>'client');
 perform pg_catalog.set_config('zzws.actor',p_actor::text,true);perform pg_catalog.set_config('zzws.source','admin_assisted',true);
 insert into public.zzws_orders(user_id,request_id,customer,delivery,delivery_variant_id,lines,original_lines,total,created_by) values(p_user,p_request,jsonb_build_object('id',u.id,'login',u.login,'client',u.profile->>'client'),snapshot,p_delivery_variant,p_lines,p_lines,p_total,author) returning * into o;
 checked=checked||jsonb_build_object('orderRevision',o.revision);
 insert into public.zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context) values(o.id,o.revision,1,(checked->>'catalogVersion')::uuid,(checked->>'rulesRevision')::uuid,checked->>'clientCategory',(checked->>'profileRevision')::bigint,p_lines,p_total,checked);
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(o.id,p_user,o.revision,jsonb_build_object('kind','created_by_admin','number',o.number,'status',o.status,'total',o.total,'createdBy',author));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_submit_for_customer',jsonb_build_object('number',o.number,'target',o.customer,'createdBy',author)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(o);
end $$;
revoke all on function public.zzws_order_author_immutable(),public.zzws_submit_customer_order(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_order_author_immutable(),public.zzws_submit_customer_order(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,numeric,jsonb) to service_role;
