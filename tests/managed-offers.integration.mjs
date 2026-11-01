import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import {offerLive,yerevanDate} from '../supabase/functions/zzws-api/special-offers.mjs';
test('managed published offers: wholesale-only membership, edits, expiry, disable, deletion, history, versions and authorization',{timeout:120000},async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const r=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,data:await r.json()};};
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 try{
  const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
  const owner=await login('owner'),kp=await login('kp'),dealer=await login('dealer'),viewer=await login('viewer');
  assert.equal((await ok('catalog',kp)).specialOffer,null,'price promotions alone never create the published collection');
  const initial=(await ok('catalog/version',kp)).version;
  const payload={title:'Managed campaign',articles:['test-003','test-002'],active:true,expiresOn:'2099-12-31',requestId:crypto.randomUUID()};
  let saved=await ok('admin/offers',owner,payload);
  assert.equal(saved.revision,1);assert.equal((await ok('admin/offers',owner,payload)).id,saved.id,'lost-response retry never creates a duplicate');
  let catalog=await ok('catalog',kp);assert.deepEqual(catalog.specialOffer.articles,['test-003'],'unlisted wholesale campaigns and listed retail-only campaigns stay out');
  assert.equal(catalog.specialOffer.title,payload.title);assert.notEqual(catalog.version,initial);
  assert.equal((await ok('catalog',dealer)).specialOffer,null,'no wholesale campaign for the dealer price context');
  let bulletins=(await ok('me/bulletins',kp)).bulletins.filter(x=>x.kind==='offers');assert.equal(bulletins.length,1);assert.deepEqual(bulletins[0].products.map(p=>p.articul),['test-003']);assert.equal(bulletins[0].products[0].price,catalog.products.find(p=>p.articul==='test-003').wholesale);
  await ok('me/bulletins/read',kp,{id:saved.id});const cursor=(await ok('me/bulletins',kp)).cursor;
  const edit={...payload,id:saved.id,revision:saved.revision,title:'Changed campaign',articles:['test-005'],requestId:crypto.randomUUID()};
  const old=saved;saved=await ok('admin/offers',owner,edit);assert.equal(saved.id,old.id);assert.equal(saved.revision,2);assert.equal((await ok('admin/offers',owner,edit)).revision,2);
  assert.equal((await call('admin/offers',owner,{...edit,requestId:crypto.randomUUID()})).status,409,'stale editor cannot overwrite a newer list');
  const changed=await ok('me/bulletins?cursor='+cursor,kp);assert.notEqual(changed.unchanged,true);assert.equal(changed.bulletins.find(b=>b.kind==='offers').seen,false);
  assert.deepEqual((await ok('catalog',kp)).specialOffer.articles,['test-005']);
  assert.equal((await call('admin/offers',viewer,{...payload,requestId:crypto.randomUUID()})).status,403);
  assert.equal((await call('admin/offers/delete',kp,{id:saved.id,revision:saved.revision,requestId:crypto.randomUUID()})).status,403);
  for(const expiresOn of ['2026-02-31','yesterday','2000-01-01'])assert.equal((await call('admin/offers',owner,{...edit,revision:saved.revision,expiresOn,requestId:crypto.randomUUID()})).status,400);
  // Expiry is enforced on server reads without an administrator/device doing any work.
  await runtime.db.query('update zzws_catalog_bulletins set expires_on=$1 where id=$2',['2000-01-01',saved.id]);
  assert.equal((await ok('catalog',kp)).specialOffer,null);assert.equal((await ok('me/bulletins',kp)).bulletins.some(b=>b.kind==='offers'),false);assert.equal((await ok('admin/offers',owner)).offers[0].status,'expired');
  saved=await ok('admin/offers',owner,{...edit,revision:saved.revision,expiresOn:null,active:false,requestId:crypto.randomUUID()});assert.equal((await ok('catalog',kp)).specialOffer,null);
  saved=await ok('admin/offers',owner,{...edit,revision:saved.revision,expiresOn:null,active:true,requestId:crypto.randomUUID()});assert.ok((await ok('catalog',kp)).specialOffer);
  const beforeDelete=(await ok('catalog/version',kp)).version,del={id:saved.id,revision:saved.revision,requestId:crypto.randomUUID()};
  const deleted=await ok('admin/offers/delete',owner,del);assert.ok(deleted.deleted_at);assert.ok((await ok('admin/offers/delete',owner,del)).deleted_at);assert.equal((await ok('catalog',kp)).specialOffer,null);assert.notEqual((await ok('catalog/version',kp)).version,beforeDelete);
  assert.equal((await ok('admin/offers',owner)).offers.find(o=>o.id===saved.id).status,'deleted');assert.equal((await call('admin/offers',owner,{...edit,revision:deleted.revision,requestId:crypto.randomUUID()})).status,409);
  assert.ok((await ok('catalog',kp)).products.length>0,'deleting an offer never deletes catalogue goods');
  const snapshot=(await runtime.db.query('select zzws_application_snapshot() as snapshot')).rows[0].snapshot;assert.ok(snapshot.tables.catalog_bulletins.some(o=>o.id===saved.id&&o.deleted_at&&o.revision===deleted.revision));
  const acl=(await runtime.db.query("select has_function_privilege('anon','public.zzws_manage_offer(uuid,uuid,uuid,integer,text,text[],boolean,date,boolean)','execute') as anon,has_function_privilege('authenticated','public.zzws_manage_offer(uuid,uuid,uuid,integer,text,text[],boolean,date,boolean)','execute') as auth")).rows[0];assert.deepEqual(acl,{anon:false,auth:false});
  assert.equal(yerevanDate(Date.parse('2026-11-01T20:00:00Z')),'2026-11-02');
  assert.equal(offerLive({kind:'offers',active:true,expires_on:'2026-11-01'},Date.parse('2026-11-01T19:59:59Z')),true);assert.equal(offerLive({kind:'offers',active:true,expires_on:'2026-11-01'},Date.parse('2026-11-01T20:00:00Z')),false);
 }finally{await runtime.close();}
});
