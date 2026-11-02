begin;

-- The service-only export includes the complete application snapshot. It can
-- exceed authenticator's default 8-second timeout as catalogue history grows.
-- Give only this existing RPC a bounded exception; preserve its body and ACLs.
alter function public.zzws_application_snapshot() set statement_timeout = '60s';
notify pgrst, 'reload schema';

commit;
