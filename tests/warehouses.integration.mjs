import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
test('actual API saves global classification, protects writes, refreshes catalogue and quote and retains settings across price replacement',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true});
 try{
  // Current catalogue validation requires article numbers to start with a digit.
  for(const v of (await r.db.query('select id,products from zzws_versions')).rows){const products=v.products.map(p=>({...p,articul:String(p.articul).replace(/^test-/, '900')}));await r.db.query('update zzws_versions set products=$1 where id=$2',[JSON.stringify(products),v.id]);}
  const request=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
  const ok=async(...args)=>{const v=await request(...args);assert.equal(v.status,200,JSON.stringify(v));return v.data;};
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken,dealer=(await ok('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken;
  const initial=await ok('admin/warehouses',owner);assert.deepEqual(initial.mainWarehouses,['003','023','026','031']);assert.equal(initial.warehouses.find(w=>w.code==='050').type,'shop');
  for(const role of ['manager','price','viewer']){const token=(await ok('login',null,{login:'zzws-test-'+role,password:'24681012'})).sessionToken;assert.equal((await request('admin/warehouses',token)).status,403);assert.equal((await request('admin/warehouses',token,{revision:initial.revision,mainWarehouses:[]})).status,403);}
  assert.equal((await request('admin/warehouses',dealer)).status,403);
  await r.db.exec('update zzws_sessions set confirmed_until=null');
  assert.equal((await request('admin/warehouses',owner,{revision:initial.revision,mainWarehouses:['050']})).status,428);
  await r.db.exec("update zzws_sessions set confirmed_until=now()+interval '5 minutes'");
  assert.equal((await request('admin/warehouses',owner,{revision:initial.revision,mainWarehouses:['50']})).status,400);
  await r.db.exec("update zzws_state set catalog_controls=jsonb_build_object('global',jsonb_build_object('brand',false))");
  const who=await ok('me',dealer),managerBefore=await ok('admin/orders/customer-catalog/version?customerId='+who.id,owner);
  const before=await ok('catalog',dealer),saved=await ok('admin/warehouses',owner,{revision:initial.revision,mainWarehouses:['050','099']});
  assert.notEqual(saved.revision,initial.revision);assert.equal(saved.warehouses.find(w=>w.code==='099').present,false);
  const after=await ok('catalog',dealer);assert.notEqual(after.version,before.version);assert.equal(after.controls.brand,false);
  const changed=after.products.find(p=>p.articul==='900002');assert.ok(changed);assert.notEqual((await ok('admin/orders/customer-catalog/version?customerId='+who.id,owner)).version,managerBefore.version);assert.equal(changed.stockAvailable,true);assert.equal(before.products.find(p=>p.articul==='900002').stockAvailable,false);
  const quote=await ok('orders/quote',dealer,{articuls:['900002']});assert.equal(quote.products.find(p=>p.articul==='900002').stockAvailable,true);
  assert.equal((await request('admin/warehouses',owner,{revision:initial.revision,mainWarehouses:[]})).status,409);
  assert.deepEqual((await ok('admin/warehouses',owner)).mainWarehouses,['050','099']);
  const state=(await r.db.query('select version from zzws_state')).rows[0];const version=(await r.db.query('select * from zzws_versions where id=$1',[state.version])).rows[0];const id=crypto.randomUUID();
  await r.db.query('insert into zzws_versions(id,products,actor) values($1,$2,$3)',[id,JSON.stringify(version.products.map(p=>({...p,stocks:{...p.stocks,'088':0}}))),version.actor]);await r.db.query('update zzws_state set version=$1',[id]);
  const next=await ok('admin/warehouses',owner);assert.deepEqual(next.mainWarehouses,['050','099']);assert.equal(next.warehouses.find(w=>w.code==='088').type,'shop');
  const empty=await ok('admin/warehouses',owner,{revision:next.revision,mainWarehouses:[]});assert.deepEqual(empty.mainWarehouses,[]);
  assert.equal((await r.db.query("select count(*)::int as n from zzws_audit where action='warehouse_settings'")).rows[0].n,2);
  const concurrent=await Promise.all([request('admin/warehouses',owner,{revision:empty.revision,mainWarehouses:['003']}),request('admin/warehouses',owner,{revision:empty.revision,mainWarehouses:['050']})]);assert.deepEqual(concurrent.map(v=>v.status).sort(),[200,409]);
  const configured=await ok('admin/warehouses',owner);configured.mainWarehouses=['050','099'];const reversed=['099','050'];
  assert.equal((await request('admin/warehouses',owner,{revision:configured.revision,mainWarehouses:configured.mainWarehouses,warehousePriority:['999']})).status,400);
  const prioritySaved=await ok('admin/warehouses',owner,{revision:configured.revision,mainWarehouses:configured.mainWarehouses,warehousePriority:reversed});assert.deepEqual(prioritySaved.warehousePriority,reversed);
  const adminCatalog=await ok('catalog',owner);assert.deepEqual(adminCatalog.warehousePolicy.priority,reversed);assert.deepEqual(adminCatalog.warehousePolicy.mainWarehouses,configured.mainWarehouses);
  assert.equal(Object.hasOwn(await ok('catalog',dealer),'warehousePolicy'),false);
  await r.db.exec('update zzws_state set version=null');assert.ok((await ok('admin/warehouses',owner)).revision);
 }finally{await r.close();}
});
