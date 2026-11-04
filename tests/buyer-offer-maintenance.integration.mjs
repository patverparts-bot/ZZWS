import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createRuntime} from './support/runtime.mjs';

const source=name=>readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const routines=["zzws_maintenance_private.allowed_tables()","zzws_maintenance_private.table_plan(text[],uuid)","public.zzws_application_snapshot()"];

test('buyer offers survive owner backups and recovery without replaying a handoff; maintenance scopes and OIDs stay correct',{timeout:120000},async()=>{
 let beforeOids;
 const r=await createRuntime({memory:true,beforeSchemaFile:async(file,db)=>{
  if(file.endsWith('20261104100750_buyer_offer_lifecycle_coverage.sql'))beforeOids=(await db.query('select $1::regprocedure::oid as a,$2::regprocedure::oid as b,$3::regprocedure::oid as c',routines)).rows[0];
 }}),db=r.db;
 try{
  await db.exec('reset role');
  if(!(await db.query("select to_regclass('public.zzws_buyer_offers') as value")).rows[0].value)await db.exec(await source('20261104100634_buyer_presentation_offers.sql'));
  if(!(await db.query("select to_regprocedure('zzws_maintenance_private.allowed_tables_before_buyer_offers()') as value")).rows[0].value){
   beforeOids=(await db.query('select $1::regprocedure::oid as a,$2::regprocedure::oid as b,$3::regprocedure::oid as c',routines)).rows[0];
   await db.exec(await source('20261104100750_buyer_offer_lifecycle_coverage.sql'));
  }
  assert.deepEqual((await db.query('select $1::regprocedure::oid as a,$2::regprocedure::oid as b,$3::regprocedure::oid as c',routines)).rows[0],beforeOids,'Existing cached callers retain original routine identities');
  const owner=(await db.query("select user_id from zzws_admin_scopes where scope='owner' limit 1")).rows[0].user_id;
  const client=(await db.query("select id from zzws_users where profile->>'role'='client' and customer_id is null limit 1")).rows[0].id;
  const version=(await db.query('select version,rules_revision from zzws_state where id=true')).rows[0];
  await db.query('update zzws_maintenance_state set protected_owner=$1 where id=true',[owner]);
  const ownerOffer=randomUUID(),clientOffer=randomUUID();
  const publicLines=[{articul:'001234',name:'Synthetic product',brand:'Fixture',category:'Fixture',qty:1,salePrice:115000,amount:115000}];
  const internalLines=[{articul:'001234',qty:1,unitCost:100000}],requestLines=[{articul:'001234',qty:1,salePrice:115000}];
  for(const [id,actor]of [[ownerOffer,owner],[clientOffer,client]])await db.query(`insert into zzws_buyer_offers(id,offer_number,actor_id,buyer_name,buyer_phone,markup_percent,price_category,state,request_lines,public_lines,internal_lines,catalog_version,rules_revision,profile_revision,total,expected_profit,finalize_request,finalized_at,handed_off_at)
   values($1,nextval('public.zzws_buyer_offer_number_seq'),$2,'Synthetic buyer','+37499123456',15,'Dealers','handed_off',$3,$4,$5,$6,$7,1,115000,15000,$8,clock_timestamp(),clock_timestamp())`,[id,actor,JSON.stringify(requestLines),JSON.stringify(publicLines),JSON.stringify(internalLines),version.version,version.rules_revision,randomUUID()]);
  await db.query('update zzws_buyer_offers set source=$1,base_cart=$2 where id=$3',['cart',JSON.stringify({'001234':{qty:1}}),ownerOffer]);
  const allowed=(await db.query('select zzws_maintenance_private.allowed_tables() as value')).rows[0].value;
  assert.equal(allowed.filter(name=>name==='buyer_offers').length,1);assert(allowed.includes('users')&&allowed.includes('versions'));
  for(const category of ['workspace','catalog','full-reset']){
   const plan=(await db.query('select * from zzws_maintenance_private.table_plan($1,$2)',[[category],owner])).rows;
   assert.equal(plan.filter(row=>row.name==='buyer_offers').length,1);
  }
  for(const category of ['orders','settings']){
   const plan=(await db.query('select * from zzws_maintenance_private.table_plan($1,$2)',[[category],owner])).rows;
   assert.equal(plan.filter(row=>row.name==='buyer_offers').length,0);
  }
  const clientRows=(await db.query('select to_jsonb(u) as value from zzws_users u where id=$1',[client])).rows.map(row=>row.value);
  const descendants=(await db.query('select zzws_maintenance_private.descendants($1,$2) as value',[JSON.stringify({users:clientRows}),owner])).rows[0].value;
  assert(descendants.buyer_offers.some(row=>row.id===clientOffer));
  assert(!descendants.buyer_offers.some(row=>row.id===ownerOffer),'Customers-only scope cannot erase unrelated employee offers');
  if(allowed.includes('proposals')){
   const customers=(await db.query('select zzws_maintenance_private.collect($1,$2) as value',[['customers'],owner])).rows[0].value;
   assert(customers.tables.buyer_offers.some(row=>row.id===clientOffer));
   assert(!customers.tables.buyer_offers.some(row=>row.id===ownerOffer));
  }else{
   // API81-era maintenance already fails closed on the separately deferred
   // proposal-table dependency. This feature must not silently weaken it.
   await assert.rejects(db.query('select zzws_maintenance_private.collect($1,$2) as value',[['customers'],owner]),e=>e.code==='PT409'&&e.message.includes('Unreviewed schema dependency'));
  }
  const snapshot=(await db.query('select zzws_application_snapshot() as value')).rows[0].value;
  assert.equal(snapshot.tables.buyer_offers.length,2);
  const originals=snapshot.tables.buyer_offers;
  assert.deepEqual(originals.map(row=>Number(row.offer_number)).sort(),[1,2]);
  const payload={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['workspace'],tables:{buyer_offers:originals},references:{tables:{users:snapshot.tables.users,versions:snapshot.tables.versions}}};
  await db.query('delete from zzws_buyer_offers');
  await db.query("select setval('public.zzws_buyer_offer_number_seq',1,false)");
  const preview=(await db.query('select zzws_maintenance_private.restore_preview($1,$2) as value',[JSON.stringify(payload),owner])).rows[0].value;
  assert.equal(preview.selectedCounts.find(row=>row.id==='buyer_offers').count,2);
  const restored=(await db.query('select zzws_maintenance_private.restore_payload($1,$2) as value',[JSON.stringify(payload),owner])).rows[0].value;
  assert.equal(restored.restored.buyer_offers,2);assert.equal(restored.outboundReplayed,false);
  const rows=(await db.query('select id,offer_number,state,handed_off_at,expected_profit,source,base_cart from zzws_buyer_offers order by id')).rows;
  assert.deepEqual(rows.map(row=>Number(row.offer_number)).sort(),[1,2]);
  assert.equal(Number((await db.query("select nextval('public.zzws_buyer_offer_number_seq') as value")).rows[0].value),3,'Restored numbers must not be assigned a second time');
  await db.query("select setval('public.zzws_buyer_offer_number_seq',100,true)");
  await db.query('delete from zzws_buyer_offers');
  await db.query('select zzws_maintenance_private.restore_payload($1,$2)',[JSON.stringify(payload),owner]);
  assert.equal(Number((await db.query("select nextval('public.zzws_buyer_offer_number_seq') as value")).rows[0].value),101,'Recovery must not lower an existing sequence high watermark');
  assert(rows.every(row=>row.state==='handed_off'&&row.handed_off_at&&Number(row.expected_profit)===15000));
  assert.equal(rows.find(row=>row.id===ownerOffer).source,'cart');
  assert.deepEqual(rows.find(row=>row.id===ownerOffer).base_cart,{'001234':{qty:1}});
  const beforeCart=(await db.query('select data from zzws_user_memory where user_id=$1',[owner])).rows[0]?.data?.cart||{};
  const repeated=(await db.query('select zzws_handoff_buyer_offer($1,$2,$3) as value',[owner,ownerOffer,randomUUID()])).rows[0].value;
  assert.equal(repeated.alreadyTransferred,true);assert.deepEqual(repeated.cart,beforeCart,'Restored handoff receipt must never add quantities again');
  const freeze=randomUUID();await db.query('update zzws_maintenance_state set freeze_job=$1 where id=true',[freeze]);
  await assert.rejects(db.query("insert into zzws_buyer_offers(actor_id,buyer_name,buyer_phone,markup_percent,price_category) values($1,'Frozen buyer','+37499123456',15,'Dealers')",[owner]),e=>e.code==='PT409');
  await db.query('update zzws_maintenance_state set freeze_job=null where id=true');
  const protectedFunctions=(await db.query("select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('zzws_finalize_buyer_offer','zzws_handoff_buyer_offer')")).rows;
  assert.equal(protectedFunctions.length,2);
  assert(protectedFunctions.every(p=>!p.prosecdef&&!p.anon&&!p.authenticated&&p.service&&p.proconfig.some(value=>value.startsWith('search_path='))), 'Only service role may call invoker functions with fixed search paths');
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.zzws_buyer_offers'::regclass")).rows[0].relrowsecurity,true);
  assert.equal((await db.query("select has_sequence_privilege('service_role','public.zzws_buyer_offer_number_seq','UPDATE') as value")).rows[0].value,false,'API service can allocate, but cannot reset offer numbers');
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from zzws_buyer_offers'),e=>e.code==='42501');
   await assert.rejects(db.query("select nextval('public.zzws_buyer_offer_number_seq')"),e=>e.code==='42501');
   await assert.rejects(db.query("select setval('public.zzws_buyer_offer_number_seq',1,false)"),e=>e.code==='42501');
   await db.exec('reset role');
  }
  assert.equal(r.telegramMessages.length,0);assert.equal(r.pushMessages.length,0);assert.equal(r.reportEmails.length,0);
 }finally{await r.close();}
});
