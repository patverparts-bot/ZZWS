-- Existing offers keep their identifiers, articles, visibility and unlimited lifetime.
alter table public.zzws_catalog_bulletins
 add column revision integer not null default 1 check(revision>0),
 add column expires_on date,
 add column deleted_at timestamptz,
 add column last_request uuid,
 add column last_actor uuid,
 add column last_fingerprint text;
create unique index zzws_offer_last_request on public.zzws_catalog_bulletins(last_request) where last_request is not null;

create function public.zzws_manage_offer(p_actor uuid,p_request uuid,p_id uuid,p_revision integer,p_title text,p_articles text[],p_active boolean,p_expires_on date,p_delete boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.zzws_catalog_bulletins; fingerprint text;
begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','price')) then raise sqlstate 'PT403';end if;
 if p_request is null or p_delete is null or (p_id is not null and (p_revision is null or p_revision<1)) or (p_delete and p_id is null) then raise sqlstate 'PT400';end if;
 if not p_delete and (p_title is null or length(trim(p_title)) not between 1 and 200 or coalesce(array_length(p_articles,1),0) not between 1 and 200 or p_active is null or exists(select 1 from unnest(p_articles) a where a is null or length(trim(a)) not between 1 and 30)) then raise sqlstate 'PT400';end if;
 if not p_delete and p_active and p_expires_on<(now() at time zone 'Asia/Yerevan')::date then raise sqlstate 'PT400';end if;
 fingerprint=md5(jsonb_build_array(p_id,p_revision,p_title,p_articles,p_active,p_expires_on,p_delete)::text);
 perform pg_advisory_xact_lock(29141920);
 select * into item from public.zzws_catalog_bulletins where last_request=p_request or request_id=p_request;
 if found then
  if item.last_actor is distinct from p_actor or item.last_fingerprint is distinct from fingerprint then raise sqlstate 'PT409';end if;
  return to_jsonb(item);
 end if;
 if p_id is not null then
  select * into item from public.zzws_catalog_bulletins where id=p_id and kind='offers' for update;
  if not found or item.deleted_at is not null or item.revision<>p_revision then raise sqlstate 'PT409';end if;
 end if;
 if p_delete then
  update public.zzws_catalog_bulletins set active=false,deleted_at=now(),revision=revision+1,last_request=p_request,last_actor=p_actor,last_fingerprint=fingerprint where id=p_id returning * into item;
 else
  if p_active then update public.zzws_catalog_bulletins set active=false,revision=revision+1 where kind='offers' and active and id is distinct from p_id;end if;
  if p_id is null then
   insert into public.zzws_catalog_bulletins(kind,title,articles,actor,request_id,active,expires_on,last_request,last_actor,last_fingerprint)
   values('offers',trim(p_title),p_articles,p_actor,p_request,p_active,p_expires_on,p_request,p_actor,fingerprint) returning * into item;
  else
   update public.zzws_catalog_bulletins set title=trim(p_title),articles=p_articles,active=p_active,expires_on=p_expires_on,revision=revision+1,last_request=p_request,last_actor=p_actor,last_fingerprint=fingerprint where id=p_id returning * into item;
   delete from public.zzws_bulletin_reads where bulletin_id=p_id;
  end if;
 end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'catalog_offer',jsonb_build_object('id',item.id,'operation',case when p_delete then 'delete' when p_id is null then 'create' else 'edit' end,'title',item.title,'count',cardinality(item.articles),'active',item.active,'expiresOn',item.expires_on,'revision',item.revision)::text);
 if not p_delete and p_active then perform public.zzws_mobile_notice('catalog.offers','offer:'||item.id||':'||item.revision);end if;
 return to_jsonb(item);
end $$;
revoke all on function public.zzws_manage_offer(uuid,uuid,uuid,integer,text,text[],boolean,date,boolean) from public,anon,authenticated;
grant execute on function public.zzws_manage_offer(uuid,uuid,uuid,integer,text,text[],boolean,date,boolean) to service_role;
-- Keep older admin clients compatible while the website is being refreshed.
create or replace function public.zzws_publish_offer(p_actor uuid,p_request uuid,p_title text,p_articles text[],p_active boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select public.zzws_manage_offer(p_actor,p_request,null,null,p_title,p_articles,p_active,null,false)
$$;
revoke all on function public.zzws_publish_offer(uuid,uuid,text,text[],boolean) from public,anon,authenticated;
grant execute on function public.zzws_publish_offer(uuid,uuid,text,text[],boolean) to service_role;
