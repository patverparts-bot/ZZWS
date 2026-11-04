-- Extend accepted calculation evidence identifiers; no profile/category assignments are updated.
alter table public.zzws_order_calculation_contexts drop constraint if exists zzws_order_calculation_contexts_client_category_check;
alter table public.zzws_order_calculation_contexts add constraint zzws_order_calculation_contexts_client_category_check
check(client_category is null or client_category in ('KP','Dealers') or client_category ~ '^cat_[a-z0-9_-]{1,60}$');
