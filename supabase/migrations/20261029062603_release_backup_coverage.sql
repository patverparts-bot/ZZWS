-- Extend private application exports; never export attachment bytes, sessions or server secrets.
begin;
alter function public.zzws_application_snapshot() rename to zzws_application_snapshot_before_release;
create function public.zzws_application_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 with old as materialized(select public.zzws_application_snapshot_before_release() value)
 select value||jsonb_build_object('schemaVersion','zzws-unified-3.7.0','restorePolicy',jsonb_build_object('outboundDisabled',true,'authBackupRequired',true,'storageBackupRequired',true,'serverSecretsSeparate',true),'tables',(value->'tables')||jsonb_build_object(
 'report_email_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_report_email_settings t),
 'report_deliveries',(select coalesce(jsonb_agg(to_jsonb(t)||case when t.state='sending' then jsonb_build_object('state','uncertain','lease',null,'lease_until',null) else '{}'::jsonb end),'[]') from public.zzws_report_deliveries t),
 'admin_order_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_order_reads t),
 'telegram_commands',(select coalesce(jsonb_agg(to_jsonb(t)||case when t.state='sending' then jsonb_build_object('state','uncertain','lease_token',null,'lease_until',null) else '{}'::jsonb end),'[]') from public.zzws_telegram_commands t))) from old;
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;
commit;
