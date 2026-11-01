import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import {storefrontSettings,validateStorefront,newProductFlags,storefrontDTO} from '../supabase/functions/zzws-api/storefront.mjs';
test('storefront settings, expiry, ranking and privacy',()=>{
 const value=storefrontSettings();assert.equal(value.newDays,7);assert.deepEqual(validateStorefront(value),value);
 for(const newDays of [0,366,1.5,'7'])assert.throws(()=>validateStorefront({...value,newDays}));
 assert.throws(()=>validateStorefront({...value,pinned:['a'],excluded:['a']}));
 assert.throws(()=>validateStorefront({...value,sections:{...value.sections,evil:{enabled:true,hy:'x',ru:''}}}));
 const now=Date.parse('2026-11-01T00:00:00Z'),p={introducedAt:'2026-10-25T00:00:00Z'};
 assert.equal(newProductFlags(p,7,now-1).isNew,true);assert.deepEqual(newProductFlags(p,7,now),{});assert.deepEqual(newProductFlags({},7,now),{});assert.deepEqual(newProductFlags({introducedAt:'2026-11-02'},7,now),{});assert.equal(newProductFlags(p,8,now).isNew,true);
 const config={storefront:{...value,pinned:['a','hidden','nostock'],excluded:['c'],sections:{...value.sections,contacts:{enabled:true,hy:'',ru:'Public contacts'},terms:{enabled:false,hy:'Hidden',ru:''}}}};
 const dto=storefrontDTO([{articul:'a',stockAvailable:true},{articul:'b',stockAvailable:true},{articul:'c',stockAvailable:true},{articul:'nostock',stockAvailable:false}], [{articul:'b',orders:10,customers:3,personal_orders:2},{articul:'hidden',orders:200},{articul:'c',orders:100}],config);
 assert.deepEqual(dto.banners,['a','b']);assert.deepEqual(Object.keys(dto.sections),['contacts']);assert.equal(JSON.stringify(dto).includes('customers'),false);assert.equal(JSON.stringify(dto).includes('personal_orders'),false);
});
test('arrival timestamps survive imports; actual API settings obey role/revision and client access',async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const r=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,data:await r.json()};};
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 try{
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken,client=(await ok('login',null,{login:'zzws-test-kp',password:'24681012'})).sessionToken;
  await ok('account/reauth',owner,{password:'24681012'});let settings=await ok('admin/catalog-controls',owner);const next=storefrontSettings();next.newDays=12;next.pinned=['test-003'];next.sections.contacts={enabled:true,hy:'',ru:'Public contacts'};
  assert.equal((await call('admin/catalog-controls',client,{kind:'storefront',value:next,revision:settings.revision})).status,403);
  let saved=await ok('admin/catalog-controls',owner,{kind:'storefront',value:next,revision:settings.revision});assert.equal(saved.config.storefront.newDays,12);
  assert.equal((await call('admin/catalog-controls',owner,{kind:'storefront',value:next,revision:settings.revision})).status,409);
  let dto=await ok('catalog',client);assert.equal(dto.storefront.newDays,12);assert.equal(dto.storefront.sections.contacts.ru,'Public contacts');assert.ok(dto.storefront.banners.every(a=>dto.products.some(p=>p.articul===a)));
  const dealer=(await ok('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken;
  const purchase=async(token,articul,complete=true)=>{const me=await ok('me',token),catalog=await ok('catalog',token),product=catalog.products.find(p=>p.articul===articul);assert.ok(product);const order=await ok('orders',token,{requestId:crypto.randomUUID(),lines:[{articul,qty:1,unitPrice:product.wholesale}],delivery:{...me.rowsList[0],method:'Առաքում'},profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id});if(complete)await runtime.db.query("update zzws_orders set status='completed' where id=$1",[order.id]);};
  await purchase(dealer,'test-004');await purchase(dealer,'test-004');await purchase(dealer,'test-004');await purchase(client,'test-008');await purchase(client,'test-012',false);
  dto=await ok('catalog',client);assert.deepEqual(dto.storefront.banners.slice(0,2),['test-004','test-008'],'recommendations use completed purchases of all clients, not just the viewer');assert.equal(dto.storefront.banners.includes('test-012'),false,'unfinished orders do not drive banners');assert.equal(JSON.stringify(dto.storefront).includes('orders'),false,'purchase totals never enter client DTO');
  const actor=runtime.seededUsers.find(u=>u.name==='owner').id;
  const publish=async products=>{const version=(await runtime.db.query('select version from zzws_state where id')).rows[0].version,draft=crypto.randomUUID();await runtime.db.query("insert into zzws_drafts(id,actor,kind,payload) values($1,$2,'price',$3)",[draft,actor,JSON.stringify({products,baseVersion:version})]);const id=(await runtime.db.query('select zzws_publish_reviewed($1,$2) as id',[draft,actor])).rows[0].id;return (await runtime.db.query('select products from zzws_versions where id=$1',[id])).rows[0].products;};
  let raw=(await runtime.db.query('select products from zzws_versions where id=(select version from zzws_state where id)')).rows[0].products;
  const added={...raw[2],articul:'new-sku',introducedAt:'2000-01-01T00:00:00Z'};raw=await publish([...raw,added]);let record=raw.find(p=>p.articul==='new-sku');assert.ok(Date.parse(record.introducedAt)>Date.now()-10000,'arrival time set by server, never by import');assert.equal(raw.find(p=>p.articul==='test-003').introducedAt,undefined,'legacy baseline is not made new');
  const appeared=record.introducedAt;raw=await publish(raw.map(p=>({...p,ws:p.ws+1,introducedAt:'2099-01-01'})));assert.equal(raw.find(p=>p.articul==='new-sku').introducedAt,appeared,'reimport preserves original arrival');
  dto=await ok('catalog',client);assert.equal(dto.products.find(p=>p.articul==='new-sku').isNew,true);
  raw=await publish(raw.filter(p=>p.articul!=='new-sku'));raw=await publish([...raw,added]);assert.ok(Date.parse(raw.find(p=>p.articul==='new-sku').introducedAt)>Date.now()-10000,'reappearing product gets an arrival date');
  const acl=(await runtime.db.query("select has_function_privilege('anon','public.zzws_publish_reviewed(uuid,uuid)','execute') as anon,has_function_privilege('authenticated','public.zzws_storefront_popularity(uuid,integer,text[])','execute') as ranking")).rows[0];assert.equal(acl.anon,false);assert.equal(acl.ranking,false);
  const snapshot=(await runtime.db.query('select zzws_application_snapshot() as snapshot')).rows[0].snapshot;assert.ok(snapshot.tables.state[0].catalog_controls.storefront,'settings included in existing backup');
 }finally{await runtime.close();}
});
