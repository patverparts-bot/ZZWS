alter table public.zzws_proposals add column valid_days integer not null default 7 check(valid_days between 1 and 365);
do $$declare item record;begin
 for item in select conname from pg_constraint where conrelid='public.zzws_proposals'::regclass and contype='c' and pg_get_constraintdef(oid) like '%expires_at%' and pg_get_constraintdef(oid) like '%created_at%' loop
  execute format('alter table public.zzws_proposals drop constraint %I',item.conname);
 end loop;
end $$;
alter table public.zzws_proposals add constraint zzws_proposals_validity check(expires_at=created_at+make_interval(days=>valid_days));
