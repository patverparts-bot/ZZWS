begin;
-- Checksums are retained without archive contents, so a downloaded verified file
-- remains recognizable after its server copy is deliberately removed.
create table zzws_maintenance_private.archive_receipts(
 sha256 text primary key check(sha256 ~ '^[a-f0-9]{64}$'),protected_owner uuid not null,
 bytes bigint not null check(bytes>0),scope jsonb not null,created timestamptz not null default clock_timestamp()
);
create table zzws_maintenance_private.archive_delete_confirmations(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),actor_id uuid not null,session_hash text not null,
 archive_id uuid not null,archive_sha text not null,stage integer not null check(stage between 1 and 3),
 expires timestamptz not null default clock_timestamp()+interval '10 minutes',created timestamptz not null default clock_timestamp()
);
alter table zzws_maintenance_private.archive_receipts enable row level security;
alter table zzws_maintenance_private.archive_delete_confirmations enable row level security;
revoke all on zzws_maintenance_private.archive_receipts,zzws_maintenance_private.archive_delete_confirmations from public,anon,authenticated;

create function public.zzws_maintenance_archive_import(p_actor uuid,p_hash text,p_unlock text,p_text text)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);payload jsonb;sha text;n bigint;a public.zzws_maintenance_archives;job_id uuid;selected text[];known boolean;
begin
 perform zzws_maintenance_private.require_unlock(p_actor,p_hash,p_unlock);
 if p_text is null or octet_length(p_text) not between 2 and 52428800 then raise sqlstate 'PT400' using message='Invalid archive size';end if;
 begin payload:=p_text::jsonb;exception when invalid_text_representation then raise sqlstate 'PT400' using message='Invalid archive JSON';end;
 if payload->>'format' is distinct from 'zzws-maintenance-archive-v1' or payload->>'schemaVersion' is distinct from '1'
  or payload->>'protectedOwner' is distinct from protected::text or jsonb_typeof(payload->'scope') is distinct from 'array'
  or jsonb_typeof(payload->'tables') is distinct from 'object' then raise sqlstate 'PT400' using message='Not an archive of this system';end if;
 sha:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');n:=octet_length(convert_to(payload::text,'UTF8'));
 select exists(select 1 from public.zzws_maintenance_archives x where x.verified_at is not null and x.sha256=sha and x.payload->>'protectedOwner'=protected::text and encode(sha256(convert_to(x.payload::text,'UTF8')),'hex')=sha)
  or exists(select 1 from zzws_maintenance_private.archive_receipts r where r.sha256=sha and r.protected_owner=protected and r.bytes=n) into known;
 if not known then raise sqlstate 'PT400' using message='Archive checksum is not recognized';end if;
 select array_agg(value) into selected from jsonb_array_elements_text(payload->'scope');
 perform zzws_maintenance_private.category_closure(selected);
 perform zzws_maintenance_private.vault_validate(payload);
 -- Do not upload while an existing operation is preparing or applying data.
 perform 1 from public.zzws_maintenance_state where id=true for update;
 if exists(select 1 from public.zzws_maintenance_jobs where state in('queued','running','awaiting_confirmation')) then raise sqlstate 'PT409' using message='Finish the current operation first';end if;
 select * into a from public.zzws_maintenance_archives where verified_at is not null and sha256=sha order by created desc limit 1;
 if not found then
  job_id:=gen_random_uuid();
  insert into public.zzws_maintenance_jobs(id,actor_id,session_hash,kind,selected,plan,fingerprint,state,phase,completed_steps,total_steps)
   values(job_id,p_actor,p_hash,'restore',payload->'scope',jsonb_build_object('imported',true),sha,'completed','imported',0,0);
  insert into public.zzws_maintenance_archives(job_id,actor_id,kind,scope,manifest,payload,sha256,download_bytes,verified_at)
   values(job_id,p_actor,'import',payload->'scope',jsonb_build_object('counts',zzws_maintenance_private.counts(payload)),payload,sha,n,clock_timestamp()) returning * into a;
  update public.zzws_maintenance_jobs set archive_id=a.id,archive_sha=sha where id=job_id;
  insert into public.zzws_audit(actor,action,detail) values(p_actor,'maintenance_archive_import',jsonb_build_object('archiveId',a.id,'sha256',sha)::text);
 end if;
 insert into zzws_maintenance_private.archive_receipts(sha256,protected_owner,bytes,scope) values(sha,protected,n,payload->'scope') on conflict(sha256) do nothing;
 return jsonb_build_object('archive',jsonb_build_object('id',a.id,'created',a.created,'kind',a.kind,'scope',a.scope,'counts',a.manifest->'counts','sha256',a.sha256,'verified',true,'downloadBytes',a.download_bytes));
end $$;

create function public.zzws_maintenance_archive_delete(p_actor uuid,p_hash text,p_unlock text,p_archive uuid,p_token_hash text,p_step integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare protected uuid:=public.zzws_maintenance_assert_owner(p_actor,p_hash);a public.zzws_maintenance_archives;confirmation zzws_maintenance_private.archive_delete_confirmations;
begin
 perform zzws_maintenance_private.require_unlock(p_actor,p_hash,p_unlock);
 if p_step is null or p_step not between 1 and 3 or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise sqlstate 'PT400';end if;
 -- Serialize delete/restore decisions on the maintenance singleton.
 perform 1 from public.zzws_maintenance_state where id=true for update;
 select * into confirmation from zzws_maintenance_private.archive_delete_confirmations where token_hash=p_token_hash for update;
 if found then
  if confirmation.actor_id<>p_actor or confirmation.session_hash<>p_hash or confirmation.archive_id<>p_archive or confirmation.expires<=clock_timestamp() then raise sqlstate 'PT403';end if;
  if confirmation.stage=p_step then return jsonb_build_object('step',p_step,'deleted',p_step=3);end if;
  if confirmation.stage<>p_step-1 then raise sqlstate 'PT409';end if;
 elsif p_step<>1 then raise sqlstate 'PT409';end if;
 select * into a from public.zzws_maintenance_archives where id=p_archive for update;
 if not found then raise sqlstate 'PT404';end if;
 if a.verified_at is null or a.sha256 is distinct from encode(sha256(convert_to(a.payload::text,'UTF8')),'hex') then raise sqlstate 'PT409';end if;
 if exists(select 1 from public.zzws_maintenance_jobs where (archive_id=p_archive or source_archive_id=p_archive)
  and (state in('queued','running','awaiting_confirmation') or state='preview' and kind='restore' and expires>clock_timestamp())) then raise sqlstate 'PT409' using message='Archive is required by an active operation';end if;
 if confirmation.token_hash is not null and confirmation.archive_sha<>a.sha256 then raise sqlstate 'PT409';end if;
 if p_step=1 then
  insert into zzws_maintenance_private.archive_delete_confirmations(token_hash,actor_id,session_hash,archive_id,archive_sha,stage)
   values(p_token_hash,p_actor,p_hash,p_archive,a.sha256,1);
 elsif p_step=2 then update zzws_maintenance_private.archive_delete_confirmations set stage=2 where token_hash=p_token_hash;
 else
  insert into zzws_maintenance_private.archive_receipts(sha256,protected_owner,bytes,scope)
   values(a.sha256,(a.payload->>'protectedOwner')::uuid,a.download_bytes,a.scope) on conflict(sha256) do nothing;
  delete from public.zzws_maintenance_archives where id=p_archive;
  update zzws_maintenance_private.archive_delete_confirmations set stage=3 where token_hash=p_token_hash;
  insert into public.zzws_audit(actor,action,detail) values(p_actor,'maintenance_archive_delete',jsonb_build_object('archiveId',p_archive,'sha256',a.sha256,'passwordConfirmations',3)::text);
 end if;
 return jsonb_build_object('step',p_step,'deleted',p_step=3);
end $$;
revoke all on function public.zzws_maintenance_archive_import(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.zzws_maintenance_archive_delete(uuid,text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.zzws_maintenance_archive_import(uuid,text,text,text) to service_role;
grant execute on function public.zzws_maintenance_archive_delete(uuid,text,text,uuid,text,integer) to service_role;
commit;
