begin;
-- A closed order can change status only through the reason-audited reopening RPC.
-- The original customer may still confirm receipt of a completed delivery.
create function public.zzws_closed_order_reason_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if old.status in ('received','completed','rejected') and new.status is distinct from old.status
 and coalesce(current_setting('zzws.source',true),'')<>'closed_order_reopened'
 and not(old.status='completed' and new.status='received' and new.received_by=old.user_id and new.received_at is not null)
 then raise sqlstate 'PT409' using message='Reopen the closed order with a reason first';end if;return new;
end $$;
create trigger zzws_closed_order_reason_guard before update on public.zzws_orders for each row execute function public.zzws_closed_order_reason_guard();
revoke all on function public.zzws_closed_order_reason_guard() from public,anon,authenticated;
grant execute on function public.zzws_closed_order_reason_guard() to service_role;
commit;
