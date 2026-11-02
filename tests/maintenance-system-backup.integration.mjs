import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import {homedir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import {createRuntime,root} from './support/runtime.mjs';
const migration='supabase/migrations/20261102033640_application_backup_maintenance_archives.sql';
test('flat system backup retains canonical credential archives and fences without reviving any operation or grant',{timeout:120000},async()=>{
 let installed=false;const r=await createRuntime({memory:true,beforeSchemaFile(file){if(file===migration)installed=true;}}),db=r.db;
 try{
  await db.exec('reset role');if(!installed)await db.exec(await readFile(new URL('../'+migration,import.meta.url),'utf8'));
  const owner=(await db.query("select user_id from zzws_admin_scopes where scope='owner'")).rows[0].user_id,job=randomUUID(),archive=randomUUID(),lease=randomUUID();
  await db.query('update zzws_maintenance_state set protected_owner=$1,freeze_job=$2 where id=true',[owner,job]);
  await db.query("insert into zzws_maintenance_jobs(id,actor_id,session_hash,request_id,kind,selected,plan,fingerprint,state,phase,archive_id,archive_sha,final_confirmed_at) values($1,$2,$3,$4,'clear','[\"orders\"]','{}','synthetic-plan','running','purge',$5,'synthetic',clock_timestamp())",[job,owner,'a'.repeat(64),randomUUID(),archive]);
  const raw='{"format":"zzws-maintenance-archive-v1","schemaVersion":1,"scope":["orders"],"tables":{"orders":[]},"price":1.2300}';
  await db.query("insert into zzws_maintenance_archives(id,job_id,actor_id,kind,scope,manifest,payload,sha256,download_bytes,verified_at) select $1,$2,$3,'clear','[\"orders\"]','{}',$4::jsonb,encode(sha256(convert_to(($4::jsonb)::text,'UTF8')),'hex'),octet_length(convert_to(($4::jsonb)::text,'UTF8')),clock_timestamp()",[archive,job,owner,raw]);
  await db.query("insert into zzws_maintenance_unlocks values($1,$2,$3,now()+interval '1 minute',clock_timestamp())",['b'.repeat(64),owner,'a'.repeat(64)]);
  await db.query("insert into zzws_maintenance_auth_mutations(id,actor_id,session_hash,state) values($1,$2,$3,'active')",[lease,owner,'a'.repeat(64)]);
  await db.query('insert into zzws_maintenance_order_tombstones(user_id,request_id,order_id,job_id) values($1,$2,$3,$4)',[randomUUID(),randomUUID(),randomUUID(),job]);
  await db.exec('set role service_role');
  const snapshot=(await db.query('select zzws_application_snapshot() as data')).rows[0].data;
  assert.equal(Object.keys(snapshot.tables).length,45);assert.equal(snapshot.tables.maintenance_state[0].freeze_job,null);assert.equal(snapshot.tables.maintenance_jobs[0].state,'cancelled');assert.equal(snapshot.tables.maintenance_jobs[0].final_confirmed_at,null);assert.deepEqual(snapshot.tables.maintenance_unlocks,[]);assert.equal(snapshot.tables.maintenance_auth_mutations[0].state,'uncertain');assert.equal(snapshot.tables.maintenance_order_tombstones.length,1);
  const copy=snapshot.tables.maintenance_archives[0];assert.equal(copy.payload,undefined);assert.ok(copy.payload_text.includes('1.2300'));assert.equal(copy.id,archive);
  const transported=JSON.stringify(snapshot),cachedPython=path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),python=process.env.ZZWS_PYTHON||(existsSync(cachedPython)?cachedPython:process.platform==='win32'?'python':'python3');
  const verified=spawnSync(python,['server/verify_snapshot.py'],{cwd:root,input:transported,encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'},windowsHide:true});assert.equal(verified.status,0,verified.stdout+verified.stderr);assert.equal(JSON.parse(verified.stdout).maintenanceArchivesVerified,1);
  const live=(await db.query('select j.state,s.freeze_job from zzws_maintenance_jobs j cross join zzws_maintenance_state s where j.id=$1',[job])).rows[0];assert.equal(live.state,'running');assert.equal(live.freeze_job,job,'the export does not mutate the live operation');
  const archival=(await db.query('select payload::text as text,sha256 from zzws_maintenance_archives where id=$1',[archive])).rows[0];assert.equal(copy.payload_text,archival.text);assert.equal(copy.sha256,archival.sha256);
  await db.exec('reset role;create temp table recovered_archives(like public.zzws_maintenance_archives including all)');
  await db.query("insert into recovered_archives select (jsonb_populate_record(null::public.zzws_maintenance_archives,($1::jsonb-'payload_text')||jsonb_build_object('payload',($1::jsonb->>'payload_text')::jsonb))).*",[JSON.stringify(copy)]);
  const recovered=(await db.query("select payload::text as text,encode(sha256(convert_to(payload::text,'UTF8')),'hex') as sha from recovered_archives")).rows[0];assert.equal(recovered.text,archival.text);assert.equal(recovered.sha,copy.sha256,'the documented PostgreSQL import preserves exact canonical bytes and SHA');
 }finally{await r.close();}
});
