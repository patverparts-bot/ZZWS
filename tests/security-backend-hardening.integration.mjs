import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
const {createRuntime}=await import(process.env.ZZWS_TEST_RUNTIME_URL||new URL('./support/runtime.mjs',import.meta.url));
const password='24681012',base='http://127.0.0.1:8080/functions/v1/zzws-api/';
async function fixture(){
 const r=await createRuntime({memory:true,sourceRoot:process.env.ZZWS_API_SOURCE_ROOT,schemaRoot:process.env.ZZWS_SCHEMA_ROOT});
 const response=(path,token,value,extra={})=>r.handle(new Request(base+path,{method:value===undefined?'GET':'POST',headers:{origin:'http://127.0.0.1:8080',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'}),...extra},...(value===undefined?{}:{body:JSON.stringify(value)})}));
 const ok=async(...args)=>{const res=await response(...args),data=await res.json();assert.equal(res.status,200,args[0]+': '+JSON.stringify(data));return data;};
 const tokens={},users={};for(const role of ['owner','manager','price','viewer','dealer','kp']){tokens[role]=(await ok('login',null,{login:'zzws-test-'+role,password})).sessionToken;users[role]=await ok('me',tokens[role]);}
 async function preview(categories,archiveId){const u=await ok('admin/system-data/unlock',tokens.owner,{password}),p=await ok('admin/system-data/'+(archiveId?'restore-preview':'preview'),tokens.owner,{unlockToken:u.unlockToken,...(archiveId?{archiveId}:{categories})});assert.equal(p.blocked,false);return {preview:p,unlock:u.unlockToken};}
 async function prepare(categories,archiveId){const b=await preview(categories,archiveId);let {job}=await ok('admin/system-data/'+(archiveId?'restore-start':'start'),tokens.owner,{unlockToken:b.unlock,password,previewId:b.preview.previewId,fingerprint:b.preview.fingerprint,requestId:randomUUID(),acknowledge:true});for(let n=0;n<5&&job.state!=='awaiting_confirmation';n++){({job}=await ok('admin/system-data/jobs/'+job.id+'/step',tokens.owner,{}));assert.notEqual(job.state,'failed',JSON.stringify(job.error));}assert.equal(job.state,'awaiting_confirmation');return {...b,job};}
 async function download(b){const res=await response('admin/system-data/archives/'+b.job.archiveId+'/download',tokens.owner,undefined,{'X-ZZWS-Maintenance-Unlock':b.unlock});assert.equal(res.status,200);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),b.job.archiveSha);return JSON.parse(bytes);}
 async function finish(b){await download(b);await ok('admin/system-data/jobs/'+b.job.id+'/confirm-delete',tokens.owner,{password,fingerprint:b.job.fingerprint,archiveSha:b.job.archiveSha,acknowledge:true,fileSaved:true});const {job}=await ok('admin/system-data/jobs/'+b.job.id+'/step',tokens.owner,{});assert.equal(job.state,'completed',JSON.stringify(job.error));return job;}
 const table=async name=>(await r.db.query('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\') as rows from public.zzws_'+name+' t')).rows[0].rows;
 return {r,ok,response,tokens,users,preview,prepare,download,finish,table};
}
function oversized(path,token,{length,field='file'}={}){
 let chunks=0,step=0,cancelled=false;const boundary='security-limit-test';const body=new ReadableStream({pull(c){if(step++===0){c.enqueue(new TextEncoder().encode('--'+boundary+'\r\nContent-Disposition: form-data; name="'+field+'"; filename="test.xlsx"\r\n\r\n'));return;}if(chunks<30){chunks++;c.enqueue(new Uint8Array(1024*1024));return;}c.enqueue(new TextEncoder().encode('\r\n--'+boundary+'--\r\n'));c.close();},cancel(){cancelled=true;}});
 return {request:new Request(base+path,{method:'POST',headers:{origin:'http://127.0.0.1:8080',...(token?{authorization:'Bearer '+token}:{}),'content-type':'multipart/form-data; boundary='+boundary,...(length===undefined?{}:{'content-length':String(length)})},body,duplex:'half'}),state:()=>({chunks,cancelled})};
}
test('all multipart API paths stop oversized streams before parsing while preserving authentication and scope gates',{timeout:120000},async()=>{
 const f=await fixture();try{
  for(const [route,role,field]of [['admin/orders/preview','manager','file'],['admin/price/preview','price','file'],['admin/users/preview','owner','file'],['admin/orders/report-inspect','manager','files']])for(const length of [undefined,1]){
   const stream=oversized(route,f.tokens[role],{length,field}),res=await f.r.handle(stream.request);assert.equal(res.status,413,route+': '+await res.text());assert.equal(stream.state().cancelled,true,route);assert.ok(stream.state().chunks<=12,route+' bounded actual read');
  }
  for(const [token,status]of [[null,401],[f.tokens.viewer,403],[f.tokens.dealer,403]]){const stream=oversized('admin/orders/preview',token),res=await f.r.handle(stream.request);assert.equal(res.status,status);assert.ok(stream.state().chunks<3,'unauthorized body is not parsed');}
  assert.equal((await f.table('orders')).length,0);assert.equal((await f.table('drafts')).length,0);assert.equal(f.r.reportEmails.length,0);
 }finally{await f.r.close();}
});
async function offers(f){
 const employee=randomUUID();await f.r.db.query('insert into auth.users(id,email,password_hash,password_salt) select $1,$2,password_hash,password_salt from auth.users where id=$3',[employee,'security-employee@users.zzws.invalid',f.users.dealer.id]);
 await f.r.db.query("insert into zzws_users(id,login,profile,active,needs_password_setup,customer_id) select $1,'security-employee',profile,true,false,id from zzws_users where id=$2",[employee,f.users.dealer.id]);
 const ids=['1','2','3','4'].map(x=>x.repeat(64));
 for(const [n,owner,customer]of [[0,f.users.owner.id,null],[1,f.users.owner.id,f.users.dealer.id],[2,f.users.manager.id,f.users.kp.id],[3,f.users.manager.id,null]])await f.r.db.query("insert into zzws_proposals(token_hash,owner_id,customer_id,lines,price_mode,expires_at) values($1,$2,$3,$4,'Dealers',now()+interval '7 days')",[ids[n],owner,customer,JSON.stringify([{articul:'900001',name:'Security fixture',quantity:2,price:12345}])]);
 for(const [user,id]of [[f.users.dealer.id,ids[1]],[employee,ids[1]],[f.users.kp.id,ids[2]]]){await f.r.db.query("insert into zzws_proposal_cart(user_id,articul,token_hash) values($1,'900001',$2)",[user,id]);await f.r.db.query('insert into zzws_proposal_reads(user_id,token_hash) values($1,$2)',[user,id]);}
 return {employee,ids};
}
async function aclChecks(f){
 await f.r.db.exec('reset role');
 try{
 for(const signature of ['zzws_maintenance_private.allowed_tables()','zzws_maintenance_private.table_plan(text[],uuid)','zzws_maintenance_private.restore_payload(jsonb,uuid,jsonb)','zzws_maintenance_private.restore_preview(jsonb,uuid,jsonb)','public.zzws_application_snapshot()']){
  for(const role of ['anon','authenticated'])assert.equal((await f.r.db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',[role,signature])).rows[0].allowed,false,role+' cannot execute '+signature);
  const fn=(await f.r.db.query('select proconfig from pg_proc where oid=$1::regprocedure',[signature])).rows[0];assert.ok(fn.proconfig.includes('search_path=""'),signature+' fixed search_path');
 }
 for(const name of ['proposals','proposal_cart','proposal_reads']){
  for(const role of ['anon','authenticated'])assert.equal((await f.r.db.query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') as allowed',[role,'public.zzws_'+name])).rows[0].allowed,false);
  const triggers=(await f.r.db.query("select t.tgenabled from pg_trigger t where t.tgrelid=$1::regclass and t.tgname='zzws_maintenance_write_guard' and t.tgfoid='public.zzws_maintenance_write_guard()'::regprocedure",['public.zzws_'+name])).rows;assert.deepEqual(triggers,[{tgenabled:'O'}]);
 }
 }finally{await f.r.db.exec('set role service_role');}
}
test('workspace/catalogue preview names and archives offers; workspace clear/restore preserves ownership, grants, parents and private ACLs',{timeout:120000},async()=>{
 const f=await fixture();try{
  const {employee}=await offers(f);await aclChecks(f);const before={};for(const name of ['proposals','proposal_cart','proposal_reads'])before[name]=await f.table(name);
  const ownerBefore=(await f.table('users')).find(u=>u.id===f.users.owner.id);
  for(const scope of ['orders','settings']){const p=await f.preview([scope]);for(const name of Object.keys(before))assert.equal(p.preview.counts.tables.some(row=>row.id===name),false,scope+' preserves '+name);}
  for(const scope of ['workspace','catalog']){const p=await f.preview([scope]);for(const name of Object.keys(before))assert.equal(p.preview.counts.tables.find(row=>row.id===name)?.count,before[name].length,scope+' explicit count '+name);}
  const snapshot=(await f.r.db.query('select public.zzws_application_snapshot() as value')).rows[0].value;for(const name of Object.keys(before))assert.deepEqual([...snapshot.tables[name]].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),[...before[name]].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),'flat system backup covers '+name);
  const canonical=rows=>[...rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const b=await f.prepare(['workspace']),archive=await f.download(b);assert.equal(archive.protectedOwner,f.users.owner.id);for(const name of Object.keys(before))assert.deepEqual(canonical(archive.tables[name]),canonical(before[name]));assert.ok(archive.references.tables.users.some(u=>u.id===employee&&u.customer_id===f.users.dealer.id));
  await f.finish(b);for(const name of Object.keys(before))assert.deepEqual(await f.table(name),[]);
  await f.r.db.query("update zzws_users set profile=jsonb_set(profile,'{client}','\"Edited current manager\"') where id=$1",[f.users.manager.id]);
  await f.finish(await f.prepare(null,b.job.archiveId));for(const name of Object.keys(before))assert.deepEqual(await f.table(name),before[name]);
  const catalogue=await f.prepare(['catalog']),catalogueArchive=await f.download(catalogue);for(const name of Object.keys(before))assert.deepEqual(canonical(catalogueArchive.tables[name]),canonical(before[name]));
  await f.finish(catalogue);for(const name of Object.keys(before))assert.deepEqual(await f.table(name),[]);await f.finish(await f.prepare(null,catalogue.job.archiveId));for(const name of Object.keys(before))assert.deepEqual(await f.table(name),before[name]);
  assert.equal((await f.table('users')).find(u=>u.id===f.users.manager.id).profile.client,'Edited current manager');assert.deepEqual((await f.table('users')).find(u=>u.id===f.users.owner.id),ownerBefore);assert.equal(f.r.reportEmails.length,0);assert.equal(f.r.telegramMessages.length,0);
 }finally{await f.r.close();}
});
test('customer archive follows company/employee proposal dependencies; restore orders parents first and unknown dependencies still fail closed',{timeout:120000},async()=>{
 const f=await fixture();try{
  const {employee,ids}=await offers(f),all=await f.table('proposals');const b=await f.prepare(['customers']),archive=await f.download(b);
  assert.deepEqual(archive.tables.proposals.map(p=>p.token_hash).sort(),[ids[1],ids[2]]);assert.equal(archive.tables.proposal_cart.length,3);assert.equal(archive.tables.proposal_reads.length,3);assert.ok(archive.tables.users.some(u=>u.id===employee&&u.customer_id===f.users.dealer.id));
  assert.ok(archive.references.tables.users.some(u=>u.id===f.users.owner.id));assert.ok(archive.references.tables.users.some(u=>u.id===f.users.manager.id));
  await f.finish(b);assert.deepEqual((await f.table('proposals')).map(p=>p.token_hash).sort(),[ids[0],ids[3]]);assert.equal((await f.table('users')).some(u=>u.id===employee),false);
  await f.finish(await f.prepare(null,b.job.archiveId));assert.deepEqual(await f.table('proposals'),all);assert.equal((await f.table('users')).find(u=>u.id===employee).customer_id,f.users.dealer.id);assert.equal((await f.table('proposal_cart')).filter(g=>g.user_id===employee).length,1);assert.equal((await f.table('proposal_reads')).filter(g=>g.user_id===employee).length,1);
  const full=await f.prepare(['full-reset']),fullArchive=await f.download(full);assert.equal(fullArchive.tables.proposals.length,4);assert.equal(fullArchive.tables.proposal_cart.length,3);assert.equal(fullArchive.tables.proposal_reads.length,3);assert.equal(fullArchive.tables.users.some(u=>u.id===f.users.owner.id),false);await f.finish(full);assert.deepEqual(await f.table('proposals'),[]);assert.deepEqual((await f.table('users')).map(u=>u.id),[f.users.owner.id]);await f.finish(await f.prepare(null,full.job.archiveId));assert.deepEqual(await f.table('proposals'),all);assert.equal((await f.table('users')).find(u=>u.id===employee).customer_id,f.users.dealer.id);assert.equal((await f.table('proposal_cart')).filter(g=>g.user_id===employee).length,1);
  await f.r.db.exec('reset role');await f.r.db.exec('create table public.zzws_unreviewed_offer_child(id uuid primary key,token_hash text references public.zzws_proposals(token_hash) on delete cascade)');await f.r.db.exec('set role service_role');
  const u=await f.ok('admin/system-data/unlock',f.tokens.owner,{password}),res=await f.response('admin/system-data/preview',f.tokens.owner,{unlockToken:u.unlockToken,categories:['workspace']});assert.equal(res.status,409);assert.deepEqual(await f.table('proposals'),all);
  await f.r.db.exec('reset role');const payload={format:'zzws-maintenance-archive-v1',schemaVersion:1,scope:['workspace'],tables:{unreviewed_offer_child:[]},references:{tables:{}}};await assert.rejects(f.r.db.query('select zzws_maintenance_private.restore_preview($1::jsonb,$2)',[JSON.stringify(payload),f.users.owner.id]),e=>e.code==='PT400');await f.r.db.exec('set role service_role');
  assert.equal(f.r.reportEmails.length,0);assert.equal(f.r.telegramMessages.length,0);
 }finally{await f.r.close();}
});
