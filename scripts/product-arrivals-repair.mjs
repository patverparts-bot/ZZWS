// Offline SQL builder only. Importing opens no database connection.
export const arrivalRepairStateSQL=`select jsonb_build_object(
 'currentVersion',s.version,'rulesRevision',s.rules_revision,'catalogRevision',s.catalog_controls_revision,
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'created',to_char(v.created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'productsMd5',md5(v.products::text),'productCount',jsonb_array_length(v.products)) order by v.created,v.id) from public.zzws_versions v),'[]'::jsonb)) as snapshot
 from public.zzws_state s where s.id=true`;

export const arrivalRepairPlanSQL=`with versions as (
 select v.*,row_number() over(order by created,id) as position from public.zzws_versions v
), entries as (
 select v.id,v.created,v.position,p.ordinality,p.value as product,p.value->>'articul' as articul,
 lag(v.position) over(partition by p.value->>'articul' order by v.position) as previous_position
 from versions v cross join lateral jsonb_array_elements(v.products) with ordinality p
), islands as (
 select e.*,sum(case when previous_position=position-1 then 0 else 1 end) over(partition by articul order by position) as island from entries e
), streaks as (
 select i.*,min(position) over(partition by articul,island) as streak_start,
 min(created) over(partition by articul,island) as streak_created from islands i
), proposed as (
 select s.*,streak_start>1 and not coalesce(jsonb_typeof(product->'introducedAt')='string' and pg_input_is_valid(product->>'introducedAt','timestamp with time zone'),false) as needs_repair,
 to_jsonb(to_char(streak_created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) as arrival from streaks s
), rebuilt as (
 select id,min(created) as created,jsonb_agg(case when needs_repair then jsonb_set(product,'{introducedAt}',arrival,true) else product end order by ordinality) as products,count(*) filter(where needs_repair) as changed from proposed group by id
)
select jsonb_build_object(
 'patches',coalesce((select jsonb_agg(jsonb_build_object('versionId',id,'articul',articul,'hadOldKey',product?'introducedAt','oldValue',product->'introducedAt','newValue',arrival) order by created,id,ordinality) from proposed where needs_repair),'[]'::jsonb),
 'versions',(select jsonb_agg(jsonb_build_object('id',r.id,'created',to_char(r.created at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'productsMd5',md5(r.products::text),'productCount',jsonb_array_length(r.products),'changed',r.changed) order by r.created,r.id) from rebuilt r),
 'currentCandidates',(select count(*) from proposed p join public.zzws_state s on s.version=p.id where s.id=true and needs_repair),
 'existingValidDates',(select count(*) from proposed where coalesce(jsonb_typeof(product->'introducedAt')='string' and pg_input_is_valid(product->>'introducedAt','timestamp with time zone'),false)),
 'duplicateSkuVersions',(select count(*) from (select id,articul from entries group by id,articul having count(*)>1) duplicate)
) as plan`;

export function completeArrivalRepair(before,computed,newRevision){
 if(computed.duplicateSkuVersions!==0)throw Error('Duplicate SKU in version; do not repair');
 if(!/^[a-f0-9-]{36}$/i.test(newRevision))throw Error('Invalid cache revision');
 if(!Array.isArray(computed.patches)||!computed.patches.length)throw Error('No historical metadata repair required');
 const versions=computed.versions.map(({changed,...v})=>v);
 if(versions.length!==before.versions.length)throw Error('Snapshot inventory changed');
 return {format:'zzws-product-arrivals-repair-v1',before,after:{...before,catalogRevision:newRevision,versions},patches:computed.patches,summary:{currentCandidates:computed.currentCandidates,changedMetadataRows:computed.patches.length,changedVersions:computed.versions.filter(v=>v.changed>0).length,existingValidDates:computed.existingValidDates}};
}

export function renderArrivalRepair(plan,{inverse=false}={}){
 if(plan.format!=='zzws-product-arrivals-repair-v1')throw Error('Unknown repair format');
 const json=JSON.stringify(plan,null,2);let tag='$arrival_repair_manifest$';for(let n=1;json.includes(tag);n++)tag='$arrival_repair_manifest_'+n+'$';let bodyTag='$arrival_repair_body$';for(let n=1;json.includes(bodyTag);n++)bodyTag='$arrival_repair_body_'+n+'$';
 const expected=inverse?'after':'before',target=inverse?'before':'after';
 return `-- Historical catalogue arrival metadata ${inverse?'inverse':'repair'}; no prices, stocks or publication dates change.
-- Exact state/product hashes are checked under the publication state lock. JSON below contains metadata only.
do ${bodyTag}
declare manifest jsonb := ${tag}${json}${tag}::jsonb; actual jsonb; changed integer;
begin
 perform 1 from public.zzws_state where id=true for update;
 perform 1 from public.zzws_versions order by created,id for update;
 select snapshot into actual from (${arrivalRepairStateSQL}) state;
 if actual is null then raise exception 'Catalogue state is missing' using errcode='PT409'; end if;
 if actual=manifest->'${target}' then return; end if;
 ${inverse?'':"if actual->'currentVersion'='null'::jsonb and actual->'versions'='[]'::jsonb then return; end if; -- Fresh installation has no historical metadata to recover."}
 if actual is distinct from manifest->'${expected}' then raise exception 'Arrival repair CAS failed: catalogue/state changed; regenerate read-only plan' using errcode='PT409'; end if;
 with patches as (
  select p.value as p from jsonb_array_elements(manifest->'patches') p
 ), rebuilt as (
  select v.id,jsonb_agg(case when patch.p is null then item.value
   ${inverse?"when (patch.p->>'hadOldKey')::boolean then jsonb_set(item.value,'{introducedAt}',patch.p->'oldValue',true) else item.value-'introducedAt'":"else jsonb_set(item.value,'{introducedAt}',patch.p->'newValue',true)"} end order by item.ordinality) as products
  from public.zzws_versions v cross join lateral jsonb_array_elements(v.products) with ordinality item
  left join patches patch on (patch.p->>'versionId')::uuid=v.id and patch.p->>'articul'=item.value->>'articul'
  group by v.id having bool_or(patch.p is not null)
 ) update public.zzws_versions v set products=r.products from rebuilt r where r.id=v.id;
 get diagnostics changed=row_count;
 if changed<>(manifest->'summary'->>'changedVersions')::integer then raise exception 'Arrival repair version count mismatch' using errcode='PT409'; end if;
 -- This is the existing catalogue/storefront presentation cache revision, never the pricing rules revision.
 update public.zzws_state set catalog_controls_revision=(manifest->'${target}'->>'catalogRevision')::uuid where id=true;
 select snapshot into actual from (${arrivalRepairStateSQL}) state;
 if actual is distinct from manifest->'${target}' then raise exception 'Arrival repair postcondition failed; all changes rolled back' using errcode='PT409'; end if;
end;
${bodyTag};
`;
}
