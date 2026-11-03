// Clean local installer; importing opens no connection. Do not replay this on an existing database.
export const cleanSchemaFiles=[
  "supabase/schema.sql",
  "supabase/proposals.sql",
  "supabase/admin-scopes.sql",
  "supabase/security-hardening.sql",
  "supabase/sensitive-actions.sql",
  "supabase/application-backup.sql",
  "supabase/receipt-confirmation.sql",
  "supabase/receipt-any-status.sql",
  "supabase/receipt-eligible-statuses.sql",
  "supabase/receipt-backup.sql",
  "supabase/migrations/20261028042352_order_activity_outbox.sql",
  "supabase/migrations/20261028044400_telegram_delivery_parts.sql",
  "supabase/migrations/20261028041353_delivery_variant_identifiers.sql",
  "supabase/migrations/20261028044621_checked_delivery_submission.sql",
  "supabase/migrations/20261028051435_order_calculation_context.sql",
  "supabase/migrations/20261028074704_unified_channels_integration.sql",
  "supabase/migrations/20261028115009_custom_client_categories.sql",
  "supabase/migrations/20261028121038_atomic_android_registration.sql",
  "supabase/migrations/20261028124430_telegram_user_card_connection.sql",
  "supabase/migrations/20261028130947_telegram_start_commands.sql",
  "supabase/migrations/20261028132335_admin_order_unread.sql",
  "supabase/migrations/20261028171713_bulk_user_cards.sql",
  "supabase/migrations/20261028173106_admin_assisted_orders.sql",
  "supabase/migrations/20261028194626_report_email_delivery.sql",
  "supabase/migrations/20261029062603_release_backup_coverage.sql",
  "supabase/migrations/20261029074731_recovery_metadata.sql",
  "supabase/migrations/20261029092832_unified_mobile_notifications.sql",
  "supabase/migrations/20261029095419_mobile_delivery_edges.sql",
  "supabase/migrations/20261029100738_admin_order_push_preferences.sql",
  "supabase/migrations/20261029141920_web_order_notices.sql",
  "supabase/migrations/20261029144604_closed_order_reason_guard.sql",
  "supabase/migrations/20261029181509_telegram_multiple_administrators.sql",
  "supabase/migrations/20261029194459_invitation_email_delivery.sql",
  "supabase/migrations/20261029210712_editable_email_sender.sql",
  "supabase/migrations/20261029220545_gmail_mail_transport_safety.sql",
  "supabase/migrations/20261030010318_retain_current_admin_session.sql",
  "supabase/catalog-controls.sql",
  "supabase/migrations/20261030191627_reviewed_price_publication.sql",
  "supabase/migrations/20261031125740_admin_mail_connection.sql",
  "supabase/migrations/20261031131222_editable_mail_security.sql",
  "supabase/migrations/20261031191639_customer_order_approval.sql",
  "supabase/migrations/20261031211228_client_accounts.sql",
  "supabase/migrations/20261031231945_apk_download_tracking.sql",
  "supabase/migrations/20261101055050_client_deletion.sql",
  "supabase/migrations/20261101061259_client_archive.sql",
  "supabase/migrations/20261101062819_employee_deletion_history.sql",
  "supabase/migrations/20261101065229_approval_reminder_custom_snooze.sql",
  "supabase/migrations/20261101084043_managed_wholesale_offers.sql",
  "supabase/migrations/20261101092608_storefront_product_arrivals.sql",
  "supabase/migrations/20261101124958_independent_report_recipients.sql",
  "supabase/migrations/20261101133339_flatten_current_application_snapshot.sql",
  "supabase/migrations/20261101142222_company_primary_order_responses.sql",
  "supabase/migrations/20261101211600_recover_historical_product_arrivals.sql",
  "supabase/migrations/20261101224141_application_backup_timeout.sql",
  "supabase/migrations/20261101224815_maintenance_auth_recovery.sql",
  "supabase/migrations/20261101224900_system_data_maintenance.sql",
  "supabase/migrations/20261101225513_maintenance_payload_restore.sql",
  "supabase/migrations/20261102033640_application_backup_maintenance_archives.sql",
  "supabase/migrations/20261102130000_maintenance_archive_file_recovery.sql",
  "supabase/migrations/20261102130100_maintenance_archive_private_policy.sql",
  "supabase/migrations/20261102130200_maintenance_selection_sizes.sql",
  "supabase/migrations/20261102140000_maintenance_disk_report.sql"
];
export const schemaVersion="zzws-unified-4.1.0-optimized";
