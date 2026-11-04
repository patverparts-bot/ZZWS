alter table public.zzws_report_email_settings add column from_email text not null default '';
create function public.zzws_email_settings_save(p_actor uuid,p_revision uuid,p_cc jsonb,p_from text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 if p_from is null or length(p_from)>254 or p_from~'[[:cntrl:]]' or (p_from<>'' and p_from!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise sqlstate 'PT400';end if;
 result=public.zzws_report_settings_save(p_actor,p_revision,p_cc);
 update public.zzws_report_email_settings set from_email=p_from where id;
 return result||jsonb_build_object('from_email',p_from);
end $$;
revoke all on function public.zzws_email_settings_save(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.zzws_email_settings_save(uuid,uuid,jsonb,text) to service_role;
