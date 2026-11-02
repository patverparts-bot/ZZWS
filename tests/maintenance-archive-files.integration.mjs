import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {createRuntime,DEMO_PASSWORD} from './support/runtime.mjs';
async function fixture(){
 const r=await createRuntime({memory:true});
 const call=async(path,token,data,extra={})=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result.data));return result.data;};
 const owner=(await ok('login',null,{login:'zzws-test-owner',password:DEMO_PASSWORD})).sessionToken;
 const dealer=(await ok('login',null,{login:'zzws-test-dealer',password:DEMO_PASSWORD})).sessionToken;
 const me=await ok('me',dealer);await r.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id)',[JSON.stringify([{articul:'990001',name:'Archive recovery fixture',brand:'LG',category:'TV',retail:150000,base:170000,ws:100000,kp:90000,stocks:{'003':8}}])]);
 const product=(await ok('catalog',dealer)).products[0];const originalOrder=await ok('orders',dealer,{requestId:randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Ինքնաառաքում',comment:'Original archive state'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
 const unlock=(await ok('admin/system-data/unlock',owner,{password:DEMO_PASSWORD})).unlockToken;
 const preview=await ok('admin/system-data/preview',owner,{unlockToken:unlock,categories:['orders']});
 let job=(await ok('admin/system-data/start',owner,{password:DEMO_PASSWORD,unlockToken:unlock,previewId:preview.previewId,fingerprint:preview.fingerprint,requestId:randomUUID(),acknowledge:true})).job;
 for(let i=0;i<3;i++)job=(await ok('admin/system-data/jobs/'+job.id+'/step',owner,{})).job;
 assert.equal(job.state,'awaiting_confirmation');
 const archive=(await ok('admin/system-data/archives',owner)).archives.find(a=>a.id===job.archiveId);assert.ok(archive);
 const downloaded=await call('admin/system-data/archives/'+archive.id+'/download',owner);assert.equal(downloaded.status,200);
 await ok('admin/system-data/jobs/'+job.id+'/cancel',owner,{});
 const remove=(step,confirmationToken,password=DEMO_PASSWORD,token=owner)=>call('admin/system-data/archives/'+archive.id+'/delete',token,{password,unlockToken:unlock,confirmationToken,step});
 return {r,owner,unlock,archive,file:downloaded.data,call,ok,remove,originalOrder};
}
test('Three fresh passwords are required; skipping, wrong password and expired confirmation never remove an archive; verified file imports after deletion',{timeout:120000},async()=>{
 const f=await fixture();try{
  const first=randomBytes(32).toString('hex');assert.equal((await f.remove(3,first)).status,409);
  assert.equal((await f.remove(1,first)).status,200);assert.equal((await f.remove(1,first)).status,200,'lost response can retry stage one');
  assert.ok([400,403].includes((await f.remove(2,first,'88888888')).status));
  assert.equal((await f.remove(3,first)).status,409);assert.equal((await f.remove(2,first)).status,200);
  assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);
  await f.r.db.exec('reset role');await f.r.db.exec("update zzws_maintenance_private.archive_delete_confirmations set expires=clock_timestamp()-interval '1 second'");await f.r.db.exec('set role service_role');
  assert.equal((await f.remove(3,first)).status,403);assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);
  const next=randomBytes(32).toString('hex');for(const step of [1,2,3]){const result=await f.remove(step,next);assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.deleted,step===3);}
  assert.equal((await f.remove(3,next)).data.deleted,true,'committed response retry is idempotent');assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,0);
  const imported=(await f.ok('admin/system-data/archive-import',f.owner,{unlockToken:f.unlock,fileText:f.file})).archive;assert.equal(imported.sha256,f.archive.sha256);assert.notEqual(imported.id,f.archive.id);assert.equal(imported.verified,true);assert.ok((await f.call('admin/system-data/archives/'+imported.id+'/download',f.owner,undefined,{'X-ZZWS-Maintenance-Unlock':f.unlock})).data===f.file,'Canonical file bytes survive delete/import');
  const reuse=(await f.ok('admin/system-data/archive-import',f.owner,{unlockToken:f.unlock,fileText:f.file})).archive;assert.equal(reuse.id,imported.id);
  const review=await f.ok('admin/system-data/restore-preview',f.owner,{unlockToken:f.unlock,archiveId:imported.id});assert.equal(review.kind,'restore');assert.deepEqual(review.selected,['orders']);
  let restoreJob=(await f.ok('admin/system-data/restore-start',f.owner,{password:DEMO_PASSWORD,unlockToken:f.unlock,previewId:review.previewId,fingerprint:review.fingerprint,requestId:randomUUID(),acknowledge:true})).job;
  for(let i=0;i<3;i++)restoreJob=(await f.ok('admin/system-data/jobs/'+restoreJob.id+'/step',f.owner,{})).job;assert.equal(restoreJob.state,'awaiting_confirmation');
  const recoveryCopy=(await f.ok('admin/system-data/archives',f.owner)).archives.find(a=>a.id===restoreJob.archiveId);
  assert.equal((await f.call('admin/system-data/archives/'+recoveryCopy.id+'/download',f.owner)).status,200);
  await f.ok('admin/system-data/jobs/'+restoreJob.id+'/confirm-delete',f.owner,{password:DEMO_PASSWORD,fingerprint:review.fingerprint,archiveSha:recoveryCopy.sha256,fileSaved:true,acknowledge:true});
  for(let i=0;i<8&&restoreJob.state!=='completed';i++)restoreJob=(await f.ok('admin/system-data/jobs/'+restoreJob.id+'/step',f.owner,{})).job;
  assert.equal(restoreJob.state,'completed',JSON.stringify(restoreJob.error));assert.equal((await f.r.db.query('select count(*)::int as n from zzws_orders where id=$1',[f.originalOrder.id])).rows[0].n,1);

  assert.equal((await f.call('admin/system-data/archive-import',f.owner,{unlockToken:f.unlock,fileText:f.file.replace('zzws-maintenance-archive-v1','invalid')})).status,400);
  assert.equal((await f.call('admin/system-data/archive-import',f.owner,{unlockToken:f.unlock,fileText:'{broken'})).status,400);
  const modified=JSON.parse(f.file);modified.restorePolicy.untrustedModification=true;assert.equal((await f.call('admin/system-data/archive-import',f.owner,{unlockToken:f.unlock,fileText:JSON.stringify(modified)})).status,400);
 }finally{await f.r.close();}
});
test('Only current owner and bound session can import/delete; active restore source cannot be deleted',{timeout:120000},async()=>{
 const f=await fixture();try{
  const client=(await f.ok('login',null,{login:'zzws-test-dealer',password:DEMO_PASSWORD})).sessionToken;
  assert.equal((await f.call('admin/system-data/archive-import',client,{unlockToken:f.unlock,fileText:f.file})).status,403);assert.equal((await f.remove(1,randomBytes(32).toString('hex'),DEMO_PASSWORD,client)).status,403);
  await f.ok('admin/system-data/restore-preview',f.owner,{unlockToken:f.unlock,archiveId:f.archive.id});
  assert.equal((await f.remove(1,randomBytes(32).toString('hex'))).status,409);assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);
 }finally{await f.r.close();}
});

test('Deletion confirmations cannot move to another owner session and public roles have no access to archive management RPCs',{timeout:120000},async()=>{const f=await fixture();try{
 const confirmationToken=randomBytes(32).toString('hex');assert.equal((await f.remove(1,confirmationToken)).status,200);
 const another=(await f.ok('login',null,{login:'zzws-test-owner',password:DEMO_PASSWORD})).sessionToken;
 const newUnlock=(await f.ok('admin/system-data/unlock',another,{password:DEMO_PASSWORD})).unlockToken;
 assert.equal((await f.call('admin/system-data/archives/'+f.archive.id+'/delete',another,{password:DEMO_PASSWORD,unlockToken:newUnlock,confirmationToken,step:2})).status,403);
 assert.equal((await f.ok('admin/system-data/archives',another)).archives.length,1);
 const access=(await f.r.db.query("select has_function_privilege('anon','public.zzws_maintenance_archive_delete(uuid,text,text,uuid,text,integer)','execute') as delete_anon,has_function_privilege('authenticated','public.zzws_maintenance_archive_import(uuid,text,text,text)','execute') as import_authenticated")).rows[0];assert.equal(access.delete_anon,false);assert.equal(access.import_authenticated,false);
 }finally{await f.r.close();}});

test('Selection computes category byte sizes and one combined dependency-aware total without reference-copy overhead',{timeout:120000},async()=>{const f=await fixture();try{
 const one=await f.ok('admin/system-data/preview',f.owner,{unlockToken:f.unlock,categories:['orders']});assert.equal(one.counts.sizeBasis,'json-utf8-selected-records');assert.ok(one.counts.dataBytes>0);assert.equal(one.categorySizes.orders,one.counts.dataBytes);
 const combined=await f.ok('admin/system-data/preview',f.owner,{unlockToken:f.unlock,categories:['orders','workspace']});assert.ok(combined.categorySizes.workspace>0);assert.ok(combined.counts.dataBytes<=combined.categorySizes.orders+combined.categorySizes.workspace);
 await f.r.db.exec('reset role');const sample={tables:{orders:[{text:'Հայերեն'}]},references:{tables:{users:[{text:'x'.repeat(5000)}]}}};const measured=(await f.r.db.query("select zzws_maintenance_private.data_bytes($1::jsonb)::int as bytes,octet_length(convert_to(($1::jsonb->'tables'->'orders'->0)::text,'UTF8')) as expected",[JSON.stringify(sample)])).rows[0];assert.equal(measured.bytes,measured.expected);
 assert.equal((await f.r.db.query("select zzws_maintenance_private.data_bytes('{\"tables\":{\"orders\":[]}}'::jsonb)::int as bytes")).rows[0].bytes,0);
 }finally{await f.r.close();}});
