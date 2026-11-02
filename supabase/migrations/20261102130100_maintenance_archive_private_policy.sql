begin;
-- These tables have no client data access. All work is inside the owner-checked RPCs.
create policy deny_direct_access on zzws_maintenance_private.archive_receipts for all to public using(false) with check(false);
create policy deny_direct_access on zzws_maintenance_private.archive_delete_confirmations for all to public using(false) with check(false);
commit;
