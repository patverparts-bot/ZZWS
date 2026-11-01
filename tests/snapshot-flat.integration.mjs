import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';
import {createRuntime} from './support/runtime.mjs';

const migrationPath='supabase/migrations/20261101133339_flatten_current_application_snapshot.sql';
const normalize=value=>value.replaceAll('\r\n','\n');
const hash=value=>createHash('md5').update(normalize(value)).digest('hex');

test('flattened application snapshot preserves all 39 table sets, metadata, BCC ledger, sequences and outbound restore safety',{timeout:120000},async()=>{
 let previous,helpersBefore,r;
 try{
  r=await createRuntime({memory:true,beforeSchemaFile:async(file,db)=>{if(file!==migrationPath)return;previous=(await db.query("select pg_get_functiondef('public.zzws_application_snapshot()'::regprocedure) definition")).rows[0].definition;helpersBefore=(await db.query("select proname,pg_get_functiondef(oid) definition from pg_proc where proname like 'zzws_application_snapshot_before_%' order by proname")).rows;}});
  assert.ok(previous,'The clean installer must apply the reviewed flattening migration');assert.equal(hash(previous),'94ea0e4ca18f7002cccd1a8c82f427af');
  const definition=async()=>(await r.db.query("select pg_get_functiondef('public.zzws_application_snapshot()'::regprocedure) definition")).rows[0].definition;
  const flattened=await definition();assert.ok(!flattened.includes('zzws_application_snapshot_before_'),'The export must not call another full snapshot wrapper');
  assert.deepEqual((await r.db.query("select proname,pg_get_functiondef(oid) definition from pg_proc where proname like 'zzws_application_snapshot_before_%' order by proname")).rows,helpersBefore,'Existing helper definitions must not change');
  const ok=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));const value=await response.json();assert.equal(response.status,200,path+': '+JSON.stringify(value));return value;};
  const client=(await ok('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken,owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken,me=await ok('me',client),admin=await ok('me',owner),product=(await ok('catalog',client)).products.find(p=>p.articul==='test-002');
  const order=await ok('orders',client,{requestId:randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{...me.rowsList[0],method:'Առաքում',comment:'Snapshot regression · հայերեն'},lines:[{articul:product.articul,qty:2,unitPrice:product.wholesale}]});
  await r.db.query("insert into zzws_apk_downloads(user_id,version_code,version,sha256,bytes,source,requested_at,completed_at) values($1,70120,'7.1.20',$2,123456,'web','2026-11-01T01:02:03.123456Z','2026-11-01T01:02:04.123456Z')",[me.id,'a'.repeat(64)]);
  await r.db.query("insert into zzws_apk_usage(user_id,version_code,version) values($1,70120,'7.1.20')",[me.id]);
  await r.db.query("insert into zzws_approval_reminder_snoozes(order_id,recipient_id,proposal_id,defer_request_id,order_revision,snoozed_until,actor,request_id,include_client) values($1,$2,$3,$4,$5,'2027-01-02T03:04:05Z',$2,$6,true)",[order.id,admin.id,randomUUID(),randomUUID(),order.revision,randomUUID()]);
  const recipientLease=randomUUID(),counts={deliverySchema:1,deliveries:[{id:'r0',address:'main@example.am',role:'to',state:'accepted',attempts:1,providerId:'synthetic-main'},{id:'r1',address:'hidden@example.am',role:'bcc',state:'sending',attempts:1,lease:recipientLease}],recipients:{to:['main@example.am'],cc:[],bcc:['hidden@example.am']}};
  await r.db.query("insert into zzws_report_deliveries(order_id,order_revision,actor_id,request_id,fingerprint,state,attempts,lease,lease_until,counts) values($1,$2,$3,$4,$5,'sending',1,$6,now()+interval '2 minutes',$7)",[order.id,order.revision,admin.id,randomUUID(),'b'.repeat(64),randomUUID(),JSON.stringify(counts)]);
  await r.db.query("insert into zzws_telegram_commands(bot_username,update_id,chat_id,reply_kind,state,attempts,lease_token,lease_until) values('snapshot_test_bot',123456,'10001','welcome','sending',1,$1,now()+interval '2 minutes')",[randomUUID()]);
  await r.db.exec('update zzws_external_systems set enabled=true;update zzws_notification_settings set enabled=true');
  await r.db.exec('reset role');
  await r.db.query("select setval('zzws_orders_number_seq',1201,false),setval('zzws_audit_id_seq',2202,true),setval('zzws_order_activity_sequence_seq',3303,true)");

  // Compare in one repeatable-read snapshot: created=now() and every source row
  // are identical across the two export implementations, including raw JSONB.
  await r.db.exec('reset role;begin isolation level repeatable read');
  await r.db.exec(previous);await r.db.exec('create temporary table snapshot_previous as select zzws_application_snapshot() value');
  await r.db.exec(flattened);const comparison=(await r.db.query('select p.value old,zzws_application_snapshot() current,p.value=zzws_application_snapshot() equal from snapshot_previous p')).rows[0];
  assert.equal(comparison.equal,true);assert.deepEqual(comparison.current,comparison.old);assert.equal(Object.keys(comparison.current.tables).length,39);
  const snapshot=comparison.current;assert.equal(snapshot.format,'zzws-application-backup-v1');assert.equal(snapshot.schemaVersion,'zzws-unified-4.1.0');assert.deepEqual(snapshot.restorePolicy,{outboundDisabled:true,authBackupRequired:true,storageBackupRequired:true,serverSecretsSeparate:true});
  assert.deepEqual(snapshot.sequences,{zzws_orders_number_seq:{lastValue:'1201',isCalled:false},zzws_audit_id_seq:{lastValue:'2202',isCalled:true},zzws_order_activity_sequence_seq:{lastValue:'3303',isCalled:true}});
  assert.equal(snapshot.tables.apk_downloads[0].sha256,'a'.repeat(64));assert.equal(snapshot.tables.apk_usage[0].version_code,70120);assert.equal(snapshot.tables.approval_reminder_snoozes[0].include_client,true);
  const report=snapshot.tables.report_deliveries[0];assert.equal(report.state,'uncertain');assert.equal(report.lease,null);assert.equal(report.lease_until,null);assert.deepEqual(report.counts,counts);
  const command=snapshot.tables.telegram_commands[0];assert.equal(command.state,'uncertain');assert.equal(command.lease_token,null);assert.equal(command.lease_until,null);assert.ok(snapshot.tables.external_systems.every(row=>row.enabled===false));assert.ok(snapshot.tables.notification_settings.every(row=>row.enabled===false));
  // Export policy changes only the archive representation, never the live rows.
  assert.equal((await r.db.query('select state from zzws_report_deliveries')).rows[0].state,'sending');assert.equal((await r.db.query('select state from zzws_telegram_commands')).rows[0].state,'sending');assert.ok((await r.db.query('select enabled from zzws_external_systems')).rows.every(row=>row.enabled===true));
  await r.db.exec('rollback');assert.equal(await definition(),flattened);
  const permissions=(await r.db.query("select has_function_privilege('anon','public.zzws_application_snapshot()','execute') anon,has_function_privilege('authenticated','public.zzws_application_snapshot()','execute') authenticated,has_function_privilege('service_role','public.zzws_application_snapshot()','execute') service")).rows[0];assert.deepEqual(permissions,{anon:false,authenticated:false,service:true});

  // A semantically changed prior definition must fail before replacement. Even
  // a bare CR inside a SQL string is a change, not a CRLF representation variant.
  const body=(await readFile(migrationPath,'utf8')).replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
  for(const changed of [previous.replace("'approval_reminder_snoozes'","'unexpected_snoozes'"),previous.replace("'approval_reminder_snoozes'","'approval_\rreminder_snoozes'")]){
   await r.db.exec('begin');await r.db.exec(changed);await assert.rejects(r.db.exec(body),/Snapshot changed concurrently/);await r.db.exec('rollback');assert.equal(await definition(),flattened);
  }
 }finally{await r?.close();}
});
