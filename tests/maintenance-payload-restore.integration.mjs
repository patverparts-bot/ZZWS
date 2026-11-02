import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
let pg;try{pg=await import('@electric-sql/pglite');}catch{pg=await import('../work/admin-notifications-stage1/supabase/tests/node_modules/@electric-sql/pglite/dist/index.js');}
const sql=async name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const rows=async(db,name)=>(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as rows from ${name} t`)).rows[0].rows;
async function fixture(){const db=new pg.PGlite(),owner=randomUUID(),client=randomUUID(),admin=randomUUID(),version=randomUUID(),system=randomUUID();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text unique,encrypted_password text);
 create table zzws_users(id uuid primary key references auth.users(id),login text unique,active boolean,profile jsonb,customer_id uuid references zzws_users(id));
 create table zzws_admin_scopes(user_id uuid primary key references zzws_users(id),scope text);
 create table zzws_versions(id uuid primary key,actor uuid references zzws_users(id),products jsonb);
 create table zzws_state(id boolean primary key,version uuid references zzws_versions(id),rules jsonb,rules_revision uuid default gen_random_uuid(),catalog_controls jsonb,catalog_controls_revision uuid default gen_random_uuid());
 create table zzws_orders(id uuid primary key,number bigint generated always as identity unique,user_id uuid references zzws_users(id),customer_id uuid references zzws_users(id),approval_catalog_version uuid references zzws_versions(id),status text);
 create table zzws_order_events(id uuid primary key,order_id uuid references zzws_orders(id),actor uuid references zzws_users(id),detail jsonb);
 create table zzws_notification_outbox(id uuid primary key,event_id uuid references zzws_order_events(id),state text,lease_token uuid,lease_until timestamptz,last_error text);
 create table zzws_external_systems(id uuid primary key,enabled boolean,configuration jsonb);
 create table zzws_integration_documents(order_id uuid references zzws_orders(id),system_id uuid references zzws_external_systems(id),document text,primary key(order_id,system_id));
 create table zzws_user_memory(user_id uuid primary key references zzws_users(id),data jsonb,versions jsonb,cleared jsonb default '{}');
 create table zzws_order_gate(user_id uuid primary key references zzws_users(id),locked boolean);
 create table unrelated(id integer primary key,price integer,stock integer);insert into unrelated values(1,987654,9);
 create table phantom_deliveries(kind text);
 create function phantom_notice() returns trigger language plpgsql as $$begin insert into phantom_deliveries values(TG_TABLE_NAME);return NEW;end$$;
 create trigger historical_order_notice after insert on zzws_orders for each row execute function phantom_notice();
 create trigger historical_event_notice after insert on zzws_order_events for each row execute function phantom_notice();
 alter table zzws_order_events enable always trigger historical_event_notice;`);
 await db.exec(await sql('20261101224815_maintenance_auth_recovery.sql'));await db.exec(await sql('20261101225513_maintenance_payload_restore.sql'));
 for(const [id,login,role]of [[owner,'protected-owner','admin'],[client,'original-client','client'],[admin,'current-manager','admin']]){await db.query('insert into auth.users values($1,$2,$3)',[id,login+'@example.invalid','credential-'+login]);await db.query('insert into zzws_users values($1,$2,true,$3,null)',[id,login,JSON.stringify({role,label:login})]);}
 await db.query("insert into zzws_admin_scopes values($1,'owner'),($2,'manager')",[owner,admin]);await db.query('insert into zzws_versions values($1,$2,$3)',[version,admin,JSON.stringify([{articul:'synthetic-product',price:12345}])]);await db.query("insert into zzws_state(id,version,rules,catalog_controls) values(true,$1,'{}','{}')",[version]);await db.query("insert into zzws_external_systems values($1,true,'{\"endpoint\":\"synthetic\"}')",[system]);
 return {db,owner,client,admin,version,system};
}
test('actual recovery SQL restores order dependencies without changing existing parents, reviving sessions or sending notices',{timeout:120000},async()=>{
 const f=await fixture(),{db,owner,client,admin,version,system}=f;
 try{const order=randomUUID(),event=randomUUID(),outbox=randomUUID(),auth=(await db.query('select zzws_maintenance_private.auth_snapshot($1::uuid[],$2) as data',[[client,admin],owner])).rows[0].data;
  const references={tables:{users:await rows(db,'zzws_users'),versions:await rows(db,'zzws_versions'),external_systems:await rows(db,'zzws_external_systems')}};
  const payload={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['orders'],auth,references,tables:{orders:[{id:order,number:7,user_id:client,customer_id:client,approval_catalog_version:version,status:'confirmed'}],order_events:[{id:event,order_id:order,actor:admin,detail:{answer:'synthetic-response'}}],notification_outbox:[{id:outbox,event_id:event,state:'pending',lease_token:null,lease_until:null,last_error:null}],integration_documents:[{order_id:order,system_id:system,document:'synthetic-document'}]}};
  const mainBefore=(await db.query('select to_jsonb(u) as row from auth.users u where id=$1',[owner])).rows[0].row;
  await db.query('delete from zzws_users where id=$1',[client]);await db.query('select zzws_maintenance_private.auth_delete($1::uuid[],$2)',[[client],owner]);await db.exec('update zzws_state set version=null;delete from zzws_versions;');
  await db.query("update zzws_users set profile='{\"role\":\"admin\",\"label\":\"current-edited-manager\"}' where id=$1",[admin]);await db.query("update auth.users set encrypted_password='current-manager-password' where id=$1",[admin]);
  await db.query("select setval(pg_get_serial_sequence('zzws_orders','number'),100,true)");
  const impact=(await db.query('select zzws_maintenance_private.restore_preview($1::jsonb,$2) as result',[JSON.stringify(payload),owner])).rows[0].result;
  assert.equal(impact.missingReferences.find(r=>r.id==='users').count,1);assert.equal(impact.missingReferences.find(r=>r.id==='versions').count,1);assert.equal(impact.authMissingCount,1);assert.deepEqual(impact.blockers,[]);
  const conflicting=structuredClone(payload);conflicting.references.tables.users.find(r=>r.id===client).login='protected-owner';
  const conflictImpact=(await db.query('select zzws_maintenance_private.restore_preview($1::jsonb,$2) as result',[JSON.stringify(conflicting),owner])).rows[0].result;assert.ok(conflictImpact.blockers.some(r=>r.code==='reference_login_conflict'));
  const lateFailure=structuredClone(payload);lateFailure.tables.order_events[0].actor=randomUUID();
  await assert.rejects(db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2)',[JSON.stringify(lateFailure),owner]),e=>e.code==='PT409');
  assert.equal((await db.query('select count(*)::integer as n from auth.users where id=$1',[client])).rows[0].n,0,'a late FK error rolls back the credential recreation');
  assert.equal((await db.query('select count(*)::integer as n from zzws_users where id=$1',[client])).rows[0].n,0,'a late FK error rolls back dependent profiles');
  assert.deepEqual(await rows(db,'zzws_versions'),[]);assert.deepEqual(await rows(db,'zzws_orders'),[]);assert.deepEqual(await rows(db,'phantom_deliveries'),[]);
  assert.deepEqual((await db.query("select tgname,tgenabled from pg_trigger where not tgisinternal order by tgname")).rows,[{tgname:'historical_event_notice',tgenabled:'A'},{tgname:'historical_order_notice',tgenabled:'O'}]);
  const result=(await db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2) as result',[JSON.stringify(payload),owner])).rows[0].result;
  assert.equal(result.restored.orders,1);assert.equal(result.outboundReplayed,false);assert.equal((await rows(db,'zzws_orders'))[0].number,7);
  assert.equal((await rows(db,'zzws_order_events'))[0].detail.answer,'synthetic-response');assert.equal((await rows(db,'zzws_integration_documents'))[0].document,'synthetic-document');
  assert.equal((await rows(db,'zzws_notification_outbox'))[0].state,'cancelled');assert.deepEqual(await rows(db,'phantom_deliveries'),[]);
  assert.equal((await db.query('select encrypted_password from auth.users where id=$1',[client])).rows[0].encrypted_password,'credential-original-client');assert.equal((await db.query('select encrypted_password from auth.users where id=$1',[admin])).rows[0].encrypted_password,'current-manager-password');
  assert.equal((await db.query('select profile->>\'label\' as label from zzws_users where id=$1',[admin])).rows[0].label,'current-edited-manager');
  assert.deepEqual((await db.query('select to_jsonb(u) as row from auth.users u where id=$1',[owner])).rows[0].row,mainBefore);
  assert.equal((await db.query('select enabled from zzws_external_systems where id=$1',[system])).rows[0].enabled,true,'existing external configuration is untouched');
  assert.equal((await db.query("select nextval(pg_get_serial_sequence('zzws_orders','number')) as n")).rows[0].n,101,'restoring an older number cannot rewind the sequence');
  assert.deepEqual((await db.query("select tgname,tgenabled from pg_trigger where not tgisinternal order by tgname")).rows,[{tgname:'historical_event_notice',tgenabled:'A'},{tgname:'historical_order_notice',tgenabled:'O'}]);
  assert.deepEqual(await rows(db,'unrelated'),[{id:1,price:987654,stock:9}]);
 }finally{await db.close();}
});
test('workspace recovery advances versions beyond both snapshots and rejects malformed or protected scopes atomically',{timeout:120000},async()=>{
 const f=await fixture(),{db,owner,client}=f;
 try{await db.query("insert into zzws_user_memory(user_id,data,versions) values($1,'{}','{\"cart\":14}')",[client]);await db.query('insert into zzws_order_gate values($1,false)',[client]);
  const payload={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['workspace'],tables:{user_memory:[{user_id:client,data:{cart:{sku:2}},versions:{cart:3}}],order_gate:[{user_id:client,locked:true}]},references:{tables:{}}};
  const previous={tables:{user_memory:[{user_id:client,data:{cart:{current:9}},versions:{cart:13}}]}};
  await db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2,$3::jsonb)',[JSON.stringify(payload),owner,JSON.stringify(previous)]);
  const restored=(await rows(db,'zzws_user_memory'))[0];assert.deepEqual(restored.data,{cart:{sku:2}});assert.equal(restored.versions.cart,15);assert.equal(restored.cleared.cart,15);assert.ok(restored.cleared.filters>0);assert.equal((await rows(db,'zzws_order_gate'))[0].locked,true);
  const memoryBefore=await rows(db,'zzws_user_memory'),stateBefore=await rows(db,'zzws_state'),gateBefore=await rows(db,'zzws_order_gate');
  const referenceOnly={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['orders'],tables:{},references:{tables:{user_memory:[{...memoryBefore[0],data:{cart:{unselected:999}},versions:{cart:1}}],state:[{...stateBefore[0],rules:{unselected:'must-not-overwrite'}}],order_gate:[{user_id:client,locked:false}]}}};
  await db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2)',[JSON.stringify(referenceOnly),owner]);
  assert.deepEqual(await rows(db,'zzws_user_memory'),memoryBefore,'reference workspace copies cannot overwrite current data');assert.deepEqual(await rows(db,'zzws_state'),stateBefore,'reference singleton copies cannot overwrite current configuration');assert.deepEqual(await rows(db,'zzws_order_gate'),gateBefore);
  const historyOnly={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['orders'],sections:{user_memory:['history']},tables:{user_memory:[{user_id:client,data:{history:[{id:'old-export'}]},versions:{history:2},cleared:{history:0}}]}};
  const historyCurrent=(await rows(db,'zzws_user_memory'))[0];
  await db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2,$3::jsonb)',[JSON.stringify(historyOnly),owner,JSON.stringify({tables:{user_memory:[{user_id:client,versions:{history:6},cleared:{history:6}}]}})]);
  const historyRestored=(await rows(db,'zzws_user_memory'))[0];assert.deepEqual(historyRestored.data.cart,historyCurrent.data.cart);assert.equal(historyRestored.versions.cart,historyCurrent.versions.cart);assert.equal(historyRestored.cleared.cart,historyCurrent.cleared.cart);assert.deepEqual(historyRestored.data.history,[{id:'old-export'}]);assert.ok(historyRestored.versions.history>6);assert.equal(historyRestored.cleared.history,historyRestored.versions.history);
  const before=await rows(db,'zzws_users');for(const bad of [{...payload,tables:{users:[before.find(x=>x.id===owner)]}},{...payload,tables:{maintenance_archives:[]}},{...payload,tables:{orders:[{id:randomUUID(),number:99,user_id:randomUUID(),status:'new'}]}}])await assert.rejects(db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2)',[JSON.stringify(bad),owner]),e=>['PT400','PT403','PT409'].includes(e.code));
  assert.deepEqual(await rows(db,'zzws_users'),before);assert.deepEqual(await rows(db,'zzws_orders'),[]);assert.deepEqual(await rows(db,'phantom_deliveries'),[]);
  assert.deepEqual((await db.query("select tgname,tgenabled from pg_trigger where not tgisinternal order by tgname")).rows,[{tgname:'historical_event_notice',tgenabled:'A'},{tgname:'historical_order_notice',tgenabled:'O'}]);
 }finally{await db.close();}
});

test('mixed recovery replaces selected customer workspace and only the retained owner history section',{timeout:120000},async()=>{
 const f=await fixture(),{db,owner,client}=f;try{
  await db.query("insert into zzws_user_memory values($1,'{}','{\"cart\":1}','{}'),($2,'{\"cart\":{\"owner-live\":99},\"favorites\":[\"keep\"]}','{\"cart\":9,\"history\":7}','{\"history\":7}')",[client,owner]);
  const before=(await db.query('select * from zzws_user_memory where user_id=$1',[owner])).rows[0];
  const payload={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['customers'],sections:{user_memoryByUser:{[owner]:['history']}},tables:{user_memory:[{user_id:client,data:{cart:{'restored-client':1}},versions:{cart:2},cleared:{}},{user_id:owner,data:{history:[{id:'retained-owner-export'}]},versions:{history:2},cleared:{history:0}}]}};
  const previous={tables:{user_memory:[{user_id:client,versions:{cart:5},cleared:{}},{user_id:owner,versions:{cart:9,history:6},cleared:{history:6}}]}};
  await db.query('select zzws_maintenance_private.restore_payload($1::jsonb,$2,$3::jsonb)',[JSON.stringify(payload),owner,JSON.stringify(previous)]);
  const after=(await db.query('select * from zzws_user_memory where user_id=$1',[owner])).rows[0];assert.deepEqual(after.data.cart,before.data.cart);assert.deepEqual(after.data.favorites,before.data.favorites);assert.equal(after.versions.cart,before.versions.cart);assert.deepEqual(after.data.history,[{id:'retained-owner-export'}]);assert.equal(after.versions.history,8);assert.equal(after.cleared.history,8);
  assert.deepEqual((await db.query('select data from zzws_user_memory where user_id=$1',[client])).rows[0].data,{cart:{'restored-client':1}});
 }finally{await db.close();}
});
