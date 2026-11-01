-- Preserve arrival dates across successful price imports, including rollback snapshots.
-- The initial price list establishes the baseline; only additions to an existing list are new.
create or replace function public.zzws_publish_reviewed(p_draft uuid,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.zzws_drafts; active_version uuid; result uuid; previous jsonb; products jsonb;
begin
 select * into d from public.zzws_drafts where id=p_draft and actor=p_actor and kind='price' and expires>now() for update;
 if not found or jsonb_typeof(d.payload) is distinct from 'object' or jsonb_typeof(d.payload->'products') is distinct from 'array' or not(d.payload ? 'baseVersion') then
  raise exception 'Preview expired; reload file' using errcode='PT409';
 end if;
 select version into active_version from public.zzws_state where id=true for update;
 if active_version is distinct from (d.payload->>'baseVersion')::uuid then
  raise exception 'Price version changed; reload preview' using errcode='PT409';
 end if;
 select v.products into previous from public.zzws_versions v where v.id=active_version;
 with before as (select value as product from jsonb_array_elements(coalesce(previous,'[]'::jsonb)))
 select jsonb_agg((n.product-'introducedAt') || case
   when b.product is not null and b.product ? 'introducedAt' then jsonb_build_object('introducedAt',b.product->'introducedAt')
   when b.product is null and active_version is not null then jsonb_build_object('introducedAt',to_jsonb(now()))
   else '{}'::jsonb end order by n.position) into products
 from jsonb_array_elements(d.payload->'products') with ordinality as n(product,position)
 left join before b on b.product->>'articul'=n.product->>'articul';
 update public.zzws_drafts set payload=products where id=p_draft;
 result:=public.zzws_publish(p_draft,p_actor);
 return result;
end;
$$;
revoke all on function public.zzws_publish_reviewed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_publish_reviewed(uuid,uuid) to service_role;

-- Filter to the requesting client's available SKUs before ranking/limiting.
-- A generic REST row limit must not hide this client's actual most-purchased goods.
create or replace function public.zzws_storefront_popularity(p_user uuid,p_days integer,p_articuls text[])
returns table(articul text,orders bigint,customers bigint,personal_orders bigint)
language sql stable security invoker set search_path='' as $$
 select p.articul,p.orders,p.customers,p.personal_orders
 from public.zzws_catalog_popularity(p_user,p_days) p
 where p.articul=any(p_articuls)
 order by p.orders desc,p.articul
 limit 8;
$$;
revoke all on function public.zzws_storefront_popularity(uuid,integer,text[]) from public,anon,authenticated;
grant execute on function public.zzws_storefront_popularity(uuid,integer,text[]) to service_role;
