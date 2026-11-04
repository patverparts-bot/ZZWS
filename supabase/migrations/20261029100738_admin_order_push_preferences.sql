begin;
alter table public.zzws_mobile_preferences add column admin_new_orders boolean not null default true,
 add column admin_status_changes boolean not null default true;
alter table public.zzws_mobile_events drop constraint zzws_mobile_events_kind_check,
 drop constraint zzws_mobile_events_check;
alter table public.zzws_mobile_events add constraint zzws_mobile_events_kind_check
 check(kind in ('order.created','order.status','order.changed','order.comment','catalog.prices','catalog.offers','system')),
 add constraint zzws_mobile_events_check check((order_id is not null)=(kind in ('order.created','order.status','order.changed','order.comment')));

create or replace function public.zzws_mobile_capture_order() returns trigger language plpgsql security invoker set search_path='' as $$begin
 insert into public.zzws_mobile_events(id,kind,order_id,order_revision,source_key,created)
 values(new.id,case when new.event_type='order.created' then 'order.created'
 when new.changes ? 'status' then 'order.status'
 when new.changes ? 'comment' and not(new.changes ?| array['lines','total']) then 'order.comment'
 else 'order.changed' end,new.order_id,new.revision,'order:'||new.id,new.occurred_at);
 if exists(select 1 from public.zzws_notification_settings where id and enabled) then
  insert into public.zzws_notification_outbox(event_id,recipient_id)
  select new.id,r.id from public.zzws_notification_recipients r join public.zzws_users u on u.id=r.user_id
  where u.profile->>'role'='client' and public.zzws_mobile_event_allowed(r.id,new.id) on conflict do nothing;
 end if;return new;
end $$;

create or replace function public.zzws_mobile_event_allowed(p_recipient uuid,p_event uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.zzws_notification_recipients r
 join public.zzws_users u on u.id=r.user_id and u.active
 join public.zzws_admin_devices d on d.user_id=u.id and d.token=r.destination and d.active
 join public.zzws_mobile_events e on e.id=p_event
 left join public.zzws_mobile_preferences p on p.user_id=u.id
 where r.id=p_recipient and r.channel='android' and r.active
 and (u.profile->>'role'='admin' and
   (e.order_id is not null and public.zzws_notification_allowed(r.id) or e.order_id is null and exists(select 1 from public.zzws_user_channels c join public.zzws_admin_scopes s on s.user_id=c.user_id where c.user_id=u.id and c.mobile_admin_enabled and s.scope in ('owner','manager','viewer','price')))
   or u.profile->>'role'='client' and p.enabled and (e.order_id is null or exists(select 1 from public.zzws_orders o where o.id=e.order_id and o.user_id=u.id)))
 and coalesce(p.enabled,u.profile->>'role'='admin')
 and case e.kind
 when 'order.created' then case when u.profile->>'role'='admin' then coalesce(p.admin_new_orders,true) else coalesce(p.orders,true) end
 when 'order.status' then case when u.profile->>'role'='admin' then coalesce(p.admin_status_changes,true) else coalesce(p.orders,true) end
 when 'order.changed' then coalesce(p.orders,true) when 'order.comment' then coalesce(p.comments,true)
 when 'catalog.prices' then coalesce(p.prices,false) when 'catalog.offers' then coalesce(p.offers,false) else coalesce(p.system,true) end);
$$;

create or replace function public.zzws_save_mobile_preferences(p_user uuid,p_value jsonb,p_expected integer) returns jsonb language plpgsql security invoker set search_path='' as $$declare result public.zzws_mobile_preferences;begin
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403';end if;
 if p_value ?| array['admin_new_orders','admin_status_changes'] and not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes s on s.user_id=u.id join public.zzws_user_channels c on c.user_id=u.id where u.id=p_user and u.active and u.profile->>'role'='admin' and c.mobile_admin_enabled and s.scope in ('owner','manager','viewer')) then raise sqlstate 'PT403';end if;
 insert into public.zzws_mobile_preferences(user_id) values(p_user) on conflict do nothing;
 update public.zzws_mobile_preferences set enabled=(p_value->>'enabled')::boolean,orders=(p_value->>'orders')::boolean,comments=(p_value->>'comments')::boolean,prices=(p_value->>'prices')::boolean,offers=(p_value->>'offers')::boolean,system=(p_value->>'system')::boolean,
 admin_new_orders=case when p_value ? 'admin_new_orders' then (p_value->>'admin_new_orders')::boolean else admin_new_orders end,
 admin_status_changes=case when p_value ? 'admin_status_changes' then (p_value->>'admin_status_changes')::boolean else admin_status_changes end,
 revision=revision+1 where user_id=p_user and revision=p_expected returning * into result;
 if not found then raise sqlstate 'PT409';end if;
 if not result.enabled then update public.zzws_notification_outbox q set state='cancelled',lease_token=null,lease_until=null where state in ('pending','retry','leased') and exists(select 1 from public.zzws_notification_recipients r where r.id=q.recipient_id and r.channel='android' and r.user_id=p_user);end if;
 return to_jsonb(result);
end $$;
commit;
