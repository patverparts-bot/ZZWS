begin;
create table public.zzws_catalog_bulletins(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('prices','offers')),
 title text not null default '' check(length(title)<=200),articles text[] not null default '{}',
 before_version uuid references public.zzws_versions(id),after_version uuid references public.zzws_versions(id),
 active boolean not null default true,created timestamptz not null default now(),actor uuid references public.zzws_users(id),
 request_id uuid unique,check(kind<>'prices' or (before_version is not null and after_version is not null))
);
create table public.zzws_bulletin_reads(user_id uuid not null references public.zzws_users(id) on delete cascade,
 bulletin_id uuid not null references public.zzws_catalog_bulletins(id) on delete cascade,seen_at timestamptz not null default now(),primary key(user_id,bulletin_id));
create index zzws_bulletins_recent on public.zzws_catalog_bulletins(created desc);
do $$ declare t text;begin foreach t in array array['zzws_catalog_bulletins','zzws_bulletin_reads'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;
create function public.zzws_capture_price_bulletin() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if old.version is not null and new.version is not null and old.version is distinct from new.version then
  insert into public.zzws_catalog_bulletins(kind,before_version,after_version) values('prices',old.version,new.version);
 end if;return new;
end $$;
create trigger zzws_capture_price_bulletin after update of version on public.zzws_state for each row execute function public.zzws_capture_price_bulletin();
create function public.zzws_publish_offer(p_actor uuid,p_request uuid,p_title text,p_articles text[],p_active boolean) returns jsonb language plpgsql security invoker set search_path='' as $$declare item public.zzws_catalog_bulletins;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','price')) then raise sqlstate 'PT403' using message='Forbidden';end if;
 if p_request is null or p_title is null or length(trim(p_title)) not between 1 and 200 or coalesce(array_length(p_articles,1),0) not between 1 and 200 or p_active is null then raise sqlstate 'PT400' using message='Invalid offer';end if;
 perform pg_advisory_xact_lock(29141920);
 select * into item from public.zzws_catalog_bulletins where request_id=p_request;
 if found then if item.actor<>p_actor or item.title<>trim(p_title) or item.articles<>p_articles then raise sqlstate 'PT409' using message='Request already used';end if;return to_jsonb(item);end if;
 update public.zzws_catalog_bulletins set active=false where kind='offers' and active;
 insert into public.zzws_catalog_bulletins(kind,title,articles,actor,request_id,active) values('offers',trim(p_title),p_articles,p_actor,p_request,p_active) returning * into item;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'catalog_offer',jsonb_build_object('id',item.id,'count',cardinality(p_articles),'active',p_active)::text);
 if p_active then perform public.zzws_mobile_notice('catalog.offers','offer:'||item.id);end if;
 return to_jsonb(item);
end $$;
create function public.zzws_reopen_order(p_actor uuid,p_order uuid,p_revision integer,p_status text,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$declare old public.zzws_orders;result public.zzws_orders;owner uuid;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and s.scope in ('owner','manager')) then raise sqlstate 'PT403' using message='Forbidden';end if;
 if p_status is null or p_status not in ('new','confirmed','in_progress') or length(trim(coalesce(p_reason,''))) not between 5 and 2000 then raise sqlstate 'PT400' using message='Reason required';end if;
 select user_id into owner from public.zzws_orders where id=p_order;
 if owner is not null then perform public.zzws_receipt_state(owner);end if;
 select * into old from public.zzws_orders where id=p_order for update;
 if not found then raise sqlstate 'PT404' using message='Order not found';end if;
 if old.revision is distinct from p_revision or old.status not in ('received','completed','rejected') then raise sqlstate 'PT409' using message='Order changed or is not closed';end if;
 perform pg_catalog.set_config('zzws.actor',p_actor::text,true);perform pg_catalog.set_config('zzws.source','closed_order_reopened',true);
 update public.zzws_orders set status=p_status,comment=trim(p_reason),received_at=null,received_by=null,receipt='{}',revision=revision+1,updated=now() where id=p_order returning * into result;
 perform public.zzws_record_order_activity(to_jsonb(old),to_jsonb(result),p_actor,'closed_order_reopened');
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(result.id,result.user_id,result.revision,jsonb_build_object('number',result.number,'kind','closed_order_reopened','oldStatus',old.status,'status',result.status,'comment',trim(p_reason),'actorId',p_actor,'actorLogin',(select login from public.zzws_users where id=p_actor),'total',result.total));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'closed_order_reopened',jsonb_build_object('number',result.number,'orderId',result.id,'reason',trim(p_reason),'oldStatus',old.status,'status',result.status)::text);
 delete from public.zzws_receipt_notices where order_id=result.id;
 if owner is not null then perform public.zzws_receipt_state(owner);end if;return to_jsonb(result);
end $$;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_bulletins;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with previous as materialized(select public.zzws_application_snapshot_before_bulletins() value)
 select value||jsonb_build_object('schemaVersion','zzws-unified-4.1.0','tables',(value->'tables')||jsonb_build_object('catalog_bulletins',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_catalog_bulletins t),'bulletin_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_bulletin_reads t))) from previous;
$$;
revoke all on function public.zzws_capture_price_bulletin(),public.zzws_publish_offer(uuid,uuid,text,text[],boolean),public.zzws_reopen_order(uuid,uuid,integer,text,text),public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_capture_price_bulletin(),public.zzws_publish_offer(uuid,uuid,text,text[],boolean),public.zzws_reopen_order(uuid,uuid,integer,text,text),public.zzws_application_snapshot() to service_role;
commit;
