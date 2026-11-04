-- Private recovery metadata only. This does not restore data or enable outbound delivery.
begin;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_recovery;
create function public.zzws_application_snapshot() returns jsonb
language sql security invoker set search_path='' as $$
 with previous as materialized(select public.zzws_application_snapshot_before_recovery() value)
 select value || jsonb_build_object('schemaVersion','zzws-unified-3.8.0','sequences',jsonb_build_object(
 'zzws_orders_number_seq',(select jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_orders_number_seq),
 'zzws_audit_id_seq',(select jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_audit_id_seq),
 'zzws_order_activity_sequence_seq',(select jsonb_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_order_activity_sequence_seq)))
 from previous;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
