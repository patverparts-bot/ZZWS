import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRuntime,DEMO_PASSWORD} from './support/runtime.mjs';
import {totp} from './support/supabase-client.mjs';

const password=DEMO_PASSWORD;
async function boundary(promise,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),5000);})]);}finally{clearTimeout(timer);}}
async function fixture(){
 const r=await createRuntime({memory:true,sourceRoot:process.env.ZZWS_API_SOURCE_ROOT});
 const call=async(path,token,value,extra={})=>{
  const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:value===undefined?'GET':'POST',headers:{origin:'http://127.0.0.1:8080',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'}),...extra},...(value===undefined?{}:{body:JSON.stringify(value)})}));
  const content=response.headers.get('content-type')||'';
  return {status:response.status,data:content.includes('application/json')?await response.json():await response.text()};
 };
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result.data));return result.data;};
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password})).sessionToken;
 const owner=await login('owner'),dealer=await login('dealer'),manager=await login('manager'),viewer=await login('viewer');
 const unlock=async token=>ok('admin/system-data/unlock',token,{password});
 const preview=async(token,categories,source=null)=>{const u=await unlock(token);return {...await ok('admin/system-data/'+(source?'restore-preview':'preview'),token,{unlockToken:u.unlockToken,...(source?{archiveId:source}:{categories})}),unlockToken:u.unlockToken};};
 const start=async(p,token=owner)=>(await ok('admin/system-data/'+(p.kind==='restore'?'restore-start':'start'),token,{password,unlockToken:p.unlockToken,previewId:p.previewId,fingerprint:p.fingerprint,requestId:randomUUID(),acknowledge:true})).job;
 const awaitBackup=async(p,token=owner)=>{let job=await start(p,token);for(let i=0;i<3;i++)job=(await ok('admin/system-data/jobs/'+job.id+'/step',token,{})).job;assert.equal(job.state,'awaiting_confirmation',JSON.stringify(job.error));return job;};
 return {r,call,ok,login,owner,dealer,manager,viewer,unlock,preview,start,awaitBackup};
}

test('every maintenance phase is owner-only and retained credential archives require a session-bound fresh unlock',{timeout:120000},async()=>{
 const f=await fixture();try{
  const p=await f.preview(f.owner,['orders']),job=await f.awaitBackup(p),archivePath='admin/system-data/archives/'+job.archiveId+'/download';
  for(const token of [f.dealer,f.manager,f.viewer]){
   for(const [path,body]of [
    ['admin/system-data/current',undefined],['admin/system-data/archives',undefined],[archivePath,undefined],
    ['admin/system-data/jobs/'+job.id,undefined],['admin/system-data/jobs/'+job.id+'/step',{}],['admin/system-data/jobs/'+job.id+'/cancel',{}],
    ['admin/system-data/jobs/'+job.id+'/confirm-delete',{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true}],
    ['admin/system-data/restore-preview',{archiveId:job.archiveId,unlockToken:p.unlockToken}],
    ['admin/system-data/start',{password,unlockToken:p.unlockToken,previewId:p.previewId,fingerprint:p.fingerprint,requestId:randomUUID(),acknowledge:true}]
   ])assert.equal((await f.call(path,token,body)).status,403,path);
  }
  const anotherSession=await f.login('owner');
  assert.equal((await f.call(archivePath,anotherSession)).status,403,'PW2 exception is confined to the original active-job session');
  assert.equal((await f.call(archivePath,anotherSession,undefined,{'X-ZZWS-Maintenance-Unlock':p.unlockToken})).status,403,'another session cannot borrow PW1 capability');
  assert.equal((await f.call(archivePath,f.owner)).status,200,'original active PW2 job can finish downloading after PW1 expiry');
  const fresh=await f.unlock(anotherSession);
  assert.equal((await f.call(archivePath,anotherSession,undefined,{'X-ZZWS-Maintenance-Unlock':fresh.unlockToken})).status,200);
  await f.ok('admin/system-data/jobs/'+job.id+'/cancel',anotherSession,{});
  assert.equal((await f.call(archivePath,f.owner)).status,403,'completed/cancelled jobs never retain the PW2 download exception');
  const state=(await f.r.db.query('select freeze_job from zzws_maintenance_state')).rows[0];assert.equal(state.freeze_job,null);
 }finally{await f.r.close();}
});

test('leased non-order customer notifications block backup and selected credential drift prevents all deletion',{timeout:120000},async()=>{
 const f=await fixture();try{
  const user=(await f.ok('me',f.dealer)).id,event=randomUUID(),recipient=randomUUID(),outbox=randomUUID();
  await f.r.db.query("insert into zzws_mobile_events(id,kind,source_key) values($1,'system',$2)",[event,'maintenance-guard:'+event]);
  await f.r.db.query("insert into zzws_notification_recipients(id,channel,destination,user_id,active) values($1,'telegram',$2,$3,false)",[recipient,'synthetic-'+recipient,user]);
  await f.r.db.query("insert into zzws_notification_outbox(id,event_id,recipient_id,state,lease_token,lease_until) values($1,$2,$3,'leased',$4,clock_timestamp()-interval '1 second')",[outbox,event,recipient,randomUUID()]);
  const blocked=await f.preview(f.owner,['customers']);assert.equal(blocked.blocked,true);assert.ok(blocked.blockingReasons.some(b=>b.table==='notification_outbox'));
  assert.equal((await f.call('admin/system-data/start',f.owner,{password,unlockToken:blocked.unlockToken,previewId:blocked.previewId,fingerprint:blocked.fingerprint,requestId:randomUUID(),acknowledge:true})).status,409,'even expired external leases remain quarantined');
  await f.r.db.query("update zzws_notification_outbox set state='uncertain',lease_token=null,lease_until=null where id=$1",[outbox]);
  const p=await f.preview(f.owner,['customers']);assert.equal(p.blocked,false);const job=await f.awaitBackup(p);
  assert.equal((await f.call('admin/system-data/archives/'+job.archiveId+'/download',f.owner)).status,200);
  const before=(await f.r.db.query('select id,person,profile from zzws_users order by id')).rows;
  await f.r.db.query("update auth.users set password_hash='synthetic-new-credential-verifier' where id=$1",[user]);
  await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});
  const failed=(await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job;
  assert.equal(failed.state,'failed');assert.equal(failed.error.code,'PT409');
  assert.deepEqual((await f.r.db.query('select id,person,profile from zzws_users order by id')).rows,before);
  assert.equal((await f.r.db.query('select password_hash from auth.users where id=$1',[user])).rows[0].password_hash,'synthetic-new-credential-verifier');
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_notification_outbox where id=$1',[outbox])).rows[0].n,1);
  assert.equal((await f.r.db.query('select freeze_job from zzws_maintenance_state')).rows[0].freeze_job,null);
 }finally{await f.r.close();}
});

test('customers cleanup invalidates affected orders and preserves the retained owner personal workspace',{timeout:120000},async()=>{
 const f=await fixture();try{
  const retained=(await f.r.db.query("select u.id,u.profile,u.person from zzws_users u join zzws_admin_scopes s on s.user_id=u.id where s.scope='owner'")).rows;
  const id=retained[0].id,data={cart:{synthetic:{qty:3}},draft:{orderCommentInput:'Retained owner personal draft'},favorites:['synthetic'],preferences:{theme:'dark'}},versions={cart:9,draft:8,favorites:7,preferences:6},cleared={cart:2,draft:3};
  await f.r.db.query('insert into zzws_user_memory(user_id,data,versions,cleared) values($1,$2,$3,$4)',[id,JSON.stringify(data),JSON.stringify(versions),JSON.stringify(cleared)]);
  const p=await f.preview(f.owner,['customers']);assert.ok(p.closure.some(c=>c.id==='workspace'&&c.reason==='dependency'));
  const job=await f.awaitBackup(p);await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner);
  await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});
  const done=(await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job;assert.equal(done.state,'completed',JSON.stringify(done.error));
  assert.equal(done.result.ordersGeneration,2);assert.equal(done.result.workspaceGeneration,1,'the customer-only dependency is scoped to removed clients, not retained-admin personal workspace');
  const memory=(await f.r.db.query('select data,versions,cleared from zzws_user_memory where user_id=$1',[id])).rows[0];for(const section of Object.keys(data)){assert.deepEqual(memory.data[section],data[section],section);assert.equal(memory.versions[section],versions[section]);assert.equal(memory.cleared[section],cleared[section]);}
  assert.deepEqual((await f.r.db.query("select u.id,u.profile,u.person from zzws_users u join zzws_admin_scopes s on s.user_id=u.id where s.scope='owner'")).rows,retained);
 }finally{await f.r.close();}
});

test('the protected owner can log in again and resume after PW3 committed a freeze but before the purge step',{timeout:120000},async()=>{
 const f=await fixture();try{
  const p=await f.preview(f.owner,['orders']),job=await f.awaitBackup(p);
  await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner);
  await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});
  assert.equal((await f.r.db.query('select freeze_job from zzws_maintenance_state')).rows[0].freeze_job,job.id);
  // Simulate losing the browser/token after the durable confirmation commit.
  // A fresh normal login must recover control without a database intervention.
  const result=await f.call('login',null,{login:'zzws-test-owner',password});
  assert.equal(result.status,200,'a durable maintenance freeze cannot lock its protected owner out of authentication');
  assert.ok(result.data.sessionToken);const current=await f.ok('admin/system-data/current',result.data.sessionToken);assert.equal(current.job.id,job.id);
  const owner=(await f.ok('me',result.data.sessionToken)).id,secret='JBSWY3DPEHPK3PXP';
  await f.r.db.query('update auth.users set factors=$2 where id=$1',[owner,JSON.stringify([{id:randomUUID(),factor_type:'totp',status:'verified',secret}])]);
  const challenge=await f.ok('login',null,{login:'zzws-test-owner',password});assert.equal(challenge.mfaRequired,true);assert.equal(challenge.sessionToken,undefined);
  const verified=await f.ok('login/mfa',null,{challengeToken:challenge.challengeToken,code:totp(secret)});assert.ok(verified.sessionToken);assert.equal((await f.ok('me',verified.sessionToken)).mfaVerified,true);
  const done=(await f.ok('admin/system-data/jobs/'+job.id+'/step',verified.sessionToken,{})).job;assert.equal(done.state,'completed',JSON.stringify(done.error));
 }finally{await f.r.close();}
});

test('an unreviewed future cascading order dependency fails closed before archiving or deleting anything',{timeout:120000},async()=>{
 const f=await fixture();try{
  const who=await f.ok('me',f.dealer),product=(await f.ok('catalog',f.dealer)).products.find(p=>p.wholesale>0&&p.stockAvailable);assert.ok(product);
  const order=await f.ok('orders',f.dealer,{requestId:randomUUID(),profileRevision:who.profileRevision,deliveryVariantId:who.rowsList[0].id,delivery:{...who.rowsList[0],method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  await f.r.db.exec('reset role;create table public.zzws_future_order_documents(id uuid primary key,order_id uuid not null references public.zzws_orders(id) on delete cascade,body text);grant all on public.zzws_future_order_documents to service_role;set role service_role');
  const child=randomUUID();await f.r.db.query('insert into zzws_future_order_documents values($1,$2,$3)',[child,order.id,'synthetic future related evidence']);
  const unlock=await f.unlock(f.owner),preview=await f.call('admin/system-data/preview',f.owner,{unlockToken:unlock.unlockToken,categories:['orders']});assert.equal(preview.status,409,'unreviewed CASCADE descendants must not disappear outside the archive boundary');
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_future_order_documents where id=$1',[child])).rows[0].n,1);
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_orders where id=$1',[order.id])).rows[0].n,1);
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_maintenance_archives')).rows[0].n,0);
 }finally{await f.r.close();}
});

test('an Auth-only account survives customers cleanup and is backed up, cleared and restored by full reset',{timeout:120000},async()=>{
 const f=await fixture();try{
  const orphan=randomUUID();await f.r.db.query('insert into auth.users(id,email,password_hash,password_salt) values($1,$2,$3,$4)',[orphan,'synthetic-auth-only@example.invalid','synthetic-orphan-verifier','synthetic-orphan-salt']);
  const original=(await f.r.db.query('select * from auth.users where id=$1',[orphan])).rows[0];
  const finish=async job=>{const archive=JSON.parse(await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner));await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});const done=(await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job;assert.equal(done.state,'completed',JSON.stringify(done.error));return archive;};
  await finish(await f.awaitBackup(await f.preview(f.owner,['customers'])));
  assert.deepEqual((await f.r.db.query('select * from auth.users where id=$1',[orphan])).rows,[original],'customers must not clear an unrelated Auth-only account');
  const full=await f.awaitBackup(await f.preview(f.owner,['full-reset'])),archive=await finish(full);assert.ok(archive.selectedAuth.userIds.includes(orphan));assert.ok(archive.auth.userIds.includes(orphan));assert.equal((await f.r.db.query('select count(*)::int n from auth.users where id=$1',[orphan])).rows[0].n,0);
  await finish(await f.awaitBackup(await f.preview(f.owner,null,full.archiveId)));
  assert.deepEqual((await f.r.db.query('select * from auth.users where id=$1',[orphan])).rows,[original]);assert.equal((await f.r.db.query('select count(*)::int n from zzws_users where id=$1',[orphan])).rows[0].n,0,'restore must not invent a public profile for an Auth-only account');
 }finally{await f.r.close();}
});

test('a pre-reset submission paused before its SQL mutation cannot recreate orders after the reset commit',{timeout:120000},async()=>{
 const f=await fixture(),realQuery=f.r.db.query.bind(f.r.db);let release,arrived,pending;
 const held=new Promise(resolve=>{release=resolve;}),reached=new Promise(resolve=>{arrived=resolve;});let intercept=true;
 try{
  const who=await f.ok('me',f.dealer),product=(await f.ok('catalog',f.dealer)).products.find(p=>p.wholesale>0&&p.stockAvailable);assert.ok(product);
  f.r.db.query=async(sql,...args)=>{if(intercept&&sql.includes('public."zzws_submit_order_v3"(')){intercept=false;arrived();await held;}return realQuery(sql,...args);};
  pending=f.call('orders',f.dealer,{requestId:randomUUID(),profileRevision:who.profileRevision,deliveryVariantId:who.rowsList[0].id,delivery:{...who.rowsList[0],method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  await boundary(reached,'Expected ordinary submit RPC was not reached');
  const job=await f.awaitBackup(await f.preview(f.owner,['orders']));await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner);
  await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});
  const done=(await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job;assert.equal(done.state,'completed',JSON.stringify(done.error));
  release();const late=await pending;assert.equal(late.status,409,'the request captured the old order generation before the backup/reset');
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_orders')).rows[0].n,0);
 }finally{release();if(pending)await pending.catch(()=>{});f.r.db.query=realQuery;await f.r.close();}
});

test('purge remains bound to the exact archive bytes acknowledged at PW3 even if a stored checksum is recomputed',{timeout:120000},async()=>{
 const f=await fixture();try{
  const who=await f.ok('me',f.dealer),product=(await f.ok('catalog',f.dealer)).products.find(p=>p.wholesale>0&&p.stockAvailable);assert.ok(product);
  const order=await f.ok('orders',f.dealer,{requestId:randomUUID(),profileRevision:who.profileRevision,deliveryVariantId:who.rowsList[0].id,delivery:{...who.rowsList[0],method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  const job=await f.awaitBackup(await f.preview(f.owner,['orders']));await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner);
  await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});
  // Privileged fixture corruption tests the protocol binding independently of
  // the checksum check. Ordinary users have no archive-table privileges.
  await f.r.db.query("with changed as(select id,payload||'{\"syntheticChangedAfterDownload\":true}'::jsonb as p from zzws_maintenance_archives where id=$1) update zzws_maintenance_archives a set payload=c.p,sha256=encode(sha256(convert_to(c.p::text,'UTF8')),'hex'),download_bytes=octet_length(convert_to(c.p::text,'UTF8')) from changed c where a.id=c.id",[job.archiveId]);
  const result=(await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job;assert.equal(result.state,'failed','the owner confirmed the original job.archiveSha, not a replacement stored digest');assert.equal(result.error.code,'PT409');
  assert.equal((await f.r.db.query('select count(*)::int n from zzws_orders where id=$1',[order.id])).rows[0].n,1);assert.equal((await f.r.db.query('select freeze_job from zzws_maintenance_state')).rows[0].freeze_job,null);
 }finally{await f.r.close();}
});

test('interleaved fresh requests cannot lend their epoch to an old delayed direct-table deletion',{timeout:120000},async()=>{
 const f=await fixture();let release,arrived,pending;const held=new Promise(resolve=>{release=resolve;}),reached=new Promise(resolve=>{arrived=resolve;});
 try{
  const cart={synthetic:{qty:1}},saved=await f.ok('me/carts',f.dealer,{title:'Retained before orders reset',cart,requestId:randomUUID()});assert.ok(saved.id);
  const oldRequest=new Request('http://127.0.0.1:8080/functions/v1/zzws-api/me/carts/delete',{method:'POST',headers:{origin:'http://127.0.0.1:8080',authorization:'Bearer '+f.dealer,'content-type':'application/json','x-zzws-expected-orders-generation':'999'},body:JSON.stringify({id:saved.id})});
  const read=oldRequest.json.bind(oldRequest);oldRequest.json=async()=>{const body=await read();arrived();await held;return body;};
  // Pause AFTER old metadata/identity but BEFORE table()/service resolves its
  // SDK client. This distinguishes real async-context isolation from global
  // mutable headers or an already-created Query object's cached headers.
  pending=f.r.handle(oldRequest);await boundary(reached,'Expected delayed body boundary was not reached');
  const job=await f.awaitBackup(await f.preview(f.owner,['orders']));await f.ok('admin/system-data/archives/'+job.archiveId+'/download',f.owner);await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',f.owner,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});assert.equal((await f.ok('admin/system-data/jobs/'+job.id+'/step',f.owner,{})).job.state,'completed');
  const fresh=await f.ok('me/carts',f.dealer,{title:'Fresh generation save',cart,requestId:randomUUID()});assert.ok(fresh.id);
  release();const oldResponse=await pending;assert.equal(oldResponse.status,503,'the old body continuation must keep its own captured epoch and return a retryable fence instead of a genuine data-CAS conflict');
  assert.deepEqual((await f.ok('me/carts',f.dealer)).carts.map(c=>c.id).sort(),[saved.id,fresh.id].sort());
  await f.ok('me/carts/delete',f.dealer,{id:saved.id});assert.deepEqual((await f.ok('me/carts',f.dealer)).carts.map(c=>c.id),[fresh.id],'a genuinely fresh explicit deletion is still allowed');
 }finally{release();if(pending)await pending.catch(()=>{});await f.r.close();}
});

test('epoch metadata failure blocks ordinary login/create/save writes until metadata can be read again',{timeout:120000},async()=>{
 const f=await fixture(),realQuery=f.r.db.query.bind(f.r.db);try{
  const who=await f.ok('me',f.dealer),product=(await f.ok('catalog',f.dealer)).products.find(p=>p.wholesale>0&&p.stockAvailable);assert.ok(product);
  const payload={requestId:randomUUID(),profileRevision:who.profileRevision,deliveryVariantId:who.rowsList[0].id,delivery:{...who.rowsList[0],method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]},memory={section:'cart',version:0,value:{synthetic:{qty:1}}};
  const before=(await realQuery('select id,profile,person from zzws_users order by id')).rows,states=(await realQuery('select * from zzws_user_memory order by user_id')).rows;
  f.r.db.query=async(sql,...args)=>{if(sql.includes('public."zzws_maintenance_generation"('))throw Object.assign(Error('Synthetic metadata failure'),{code:'57014'});return realQuery(sql,...args);};
  for(const [path,token,body]of [['login',null,{login:'zzws-test-owner',password}],['orders',f.dealer,payload],['me/state',f.dealer,memory]])assert.equal((await f.call(path,token,body)).status,503,path);
  assert.equal((await realQuery('select count(*)::int n from zzws_orders')).rows[0].n,0);assert.deepEqual((await realQuery('select id,profile,person from zzws_users order by id')).rows,before);assert.deepEqual((await realQuery('select * from zzws_user_memory order by user_id')).rows,states);
  f.r.db.query=realQuery;assert.ok((await f.ok('login',null,{login:'zzws-test-owner',password})).sessionToken);await f.ok('me/state',f.dealer,memory);await f.ok('orders',f.dealer,payload);assert.equal((await realQuery('select count(*)::int n from zzws_orders')).rows[0].n,1);
 }finally{f.r.db.query=realQuery;await f.r.close();}
});

test('a delayed protected-owner credential update blocks reset until Auth and the retained public login agree',{timeout:120000},async()=>{
 const f=await fixture(),realQuery=f.r.db.query.bind(f.r.db);let release,arrived,pending;const held=new Promise(resolve=>{release=resolve;}),reached=new Promise(resolve=>{arrived=resolve;});let intercept=true;
 try{
  const owner=(await f.ok('admin/users',f.owner)).users.find(u=>u.login==='zzws-test-owner');assert.ok(owner);await f.ok('account/reauth',f.owner,{password});
  const renamed='zzws-test-owner-renamed',expectedEmail=renamed+'@users.zzws.invalid';
  f.r.db.query=async(sql,...args)=>{if(intercept&&sql.startsWith('update auth.users set email=')){intercept=false;arrived();await held;}return realQuery(sql,...args);};
  pending=f.call('admin/users',f.owner,{...owner,intent:'update',login:renamed,expectedProfileRevision:owner.profileRevision});
  await boundary(reached,'Expected existing-account Auth update boundary was not reached');
  // Credential edits revoke existing application sessions before touching Auth.
  // The original credentials must still recover an owner session at this point.
  const recovered=await f.login('owner'),p=await f.preview(recovered,['full-reset']);assert.equal(p.blocked,true);assert.ok(p.blockingReasons.some(r=>r.code==='auth_mutation_in_flight'));
  assert.equal((await f.call('admin/system-data/start',recovered,{password,unlockToken:p.unlockToken,previewId:p.previewId,fingerprint:p.fingerprint,requestId:randomUUID(),acknowledge:true})).status,409);
  assert.equal((await f.r.db.query('select freeze_job from zzws_maintenance_state')).rows[0].freeze_job,null,'a blocked reset cannot freeze the credential operation it is waiting for');
  assert.ok((await f.r.db.query('select count(*)::int n from zzws_users')).rows[0].n>1);
  release();const late=await pending;assert.equal(late.status,200,'the original ordinary credential edit must finish without reset interleaving');
  const profile=(await f.r.db.query('select login from zzws_users where id=$1',[owner.id])).rows[0],auth=(await f.r.db.query('select email from auth.users where id=$1',[owner.id])).rows[0];assert.equal(profile.login,renamed);assert.equal(auth.email,expectedEmail,'Auth identity and public login must commit to the same ordinary edit');
  const fresh=(await f.ok('login',null,{login:renamed,password})).sessionToken;assert.ok(fresh);
  const reviewed=await f.preview(fresh,['full-reset']);assert.equal(reviewed.blocked,false);const job=await f.awaitBackup(reviewed,fresh);
  await f.ok('admin/system-data/archives/'+job.archiveId+'/download',fresh);await f.ok('admin/system-data/jobs/'+job.id+'/confirm-delete',fresh,{password,fingerprint:job.fingerprint,archiveSha:job.archiveSha,acknowledge:true,fileSaved:true});assert.equal((await f.ok('admin/system-data/jobs/'+job.id+'/step',fresh,{})).job.state,'completed');
  assert.equal((await f.r.db.query('select login from zzws_users where id=$1',[owner.id])).rows[0].login,renamed);assert.equal((await f.r.db.query('select email from auth.users where id=$1',[owner.id])).rows[0].email,expectedEmail);
  assert.ok((await f.ok('login',null,{login:renamed,password})).sessionToken,'the preserved main-owner login remains usable after the actual full reset');
 }finally{release();if(pending)await pending.catch(()=>{});f.r.db.query=realQuery;await f.r.close();}
});
