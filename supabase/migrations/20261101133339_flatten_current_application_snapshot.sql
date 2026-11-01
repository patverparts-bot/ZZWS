begin;

-- Production cancellation 57014 was caused by two full JSONB wrapper copies:
-- 34.33 s for the wrapped export versus 3.60 s for the flat 36-table helper.
-- Preserve the exact existing schema/restore policy, all 39 tables and sequences.
-- The guard ignores CRLF representation only; every other definition byte must match.
do $guard$
begin
 if md5(replace(pg_get_functiondef('public.zzws_application_snapshot()'::regprocedure),E'\r\n',E'\n'))<>'94ea0e4ca18f7002cccd1a8c82f427af' then
  raise exception 'Snapshot changed concurrently; re-review before applying';
 end if;
end;
$guard$;

create or replace function public.zzws_application_snapshot()
returns jsonb language sql security invoker set search_path='' as $snapshot$
select json_build_object(
 'format','zzws-application-backup-v1','created',now(),'schemaVersion','zzws-unified-4.1.0',
 'restorePolicy',json_build_object('outboundDisabled',true,'authBackupRequired',true,'storageBackupRequired',true,'serverSecretsSeparate',true),
 'sequences',json_build_object(
 'zzws_orders_number_seq',(select json_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_orders_number_seq),
 'zzws_audit_id_seq',(select json_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_audit_id_seq),
 'zzws_order_activity_sequence_seq',(select json_build_object('lastValue',last_value::text,'isCalled',is_called) from public.zzws_order_activity_sequence_seq)),
 'tables',json_build_object(
 'apk_downloads',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_apk_downloads t),
 'apk_usage',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_apk_usage t),
 'approval_reminder_snoozes',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_approval_reminder_snoozes t),
 'catalog_bulletins',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_catalog_bulletins t),
 'bulletin_reads',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_bulletin_reads t),
 'mobile_preferences',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_mobile_preferences t),
 'mobile_events',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_mobile_events t),
 'report_email_settings',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_report_email_settings t),
 'report_deliveries',(select coalesce(json_agg(to_jsonb(t)||case when t.state='sending' then jsonb_build_object('state','uncertain','lease',null,'lease_until',null) else '{}'::jsonb end),'[]'::json) from public.zzws_report_deliveries t),
 'admin_order_reads',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_admin_order_reads t),
 'telegram_commands',(select coalesce(json_agg(to_jsonb(t)||case when t.state='sending' then jsonb_build_object('state','uncertain','lease_token',null,'lease_until',null) else '{}'::jsonb end),'[]'::json) from public.zzws_telegram_commands t),
 'user_channels',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_user_channels t),
 'admin_devices',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_admin_devices t),
 'external_systems',(select coalesce(json_agg(to_jsonb(t)||jsonb_build_object('enabled',false)),'[]'::json) from public.zzws_external_systems t),
 'partner_counterparties',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_partner_counterparties t),
 'delivery_counterparties',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_delivery_counterparties t),
 'integration_outbox',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_integration_outbox t),
 'integration_documents',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_integration_documents t),
 'order_integration_resolutions',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_order_integration_resolutions t),
 'order_calculation_contexts',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_order_calculation_contexts t),
 'users',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_users t),
 'versions',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_versions t),
 'state',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_state t),
 'orders',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_orders t),
 'order_events',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_order_events t),
 'saved_carts',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_saved_carts t),
 'user_memory',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_user_memory t),
 'admin_scopes',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_admin_scopes t),
 'receipt_settings',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_receipt_settings t),
 'client_receipt_controls',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_client_receipt_controls t),
 'order_gate',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_order_gate t),
 'receipt_notices',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_receipt_notices t),
 'admin_notice_reads',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_admin_notice_reads t),
 'order_activity',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_order_activity t),
 'notification_recipients',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_notification_recipients t),
 'telegram_parts',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_telegram_parts t),
 'notification_outbox',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_notification_outbox t),
 'notification_settings',(select json_agg(to_jsonb(t)||jsonb_build_object('enabled',false)) from public.zzws_notification_settings t),
 'audit',(select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.zzws_audit t)) )::jsonb;
$snapshot$;

-- CREATE OR REPLACE preserves the existing service-only execution privileges.
commit;
