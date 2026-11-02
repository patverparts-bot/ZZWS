import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('actual API enforces account projection, zero-stock source, list exclusion, client privacy and current validation without writes',{timeout:120000},async()=>{
 const runtime=await createRuntime({memory:true});
 const call=async(path,token,value,method=value===undefined?'GET':'POST')=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method,headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result));return result.data;};
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 try{
  const owner=await login('owner'),manager=await login('manager');let client=await login('dealer');const kp=await login('kp');
  const base={retail:300,base:300,ws:100,kp:80,kpPromo:0,category:'Washing machine',brand:'Bosch',stocks:{}};
  const products=[{...base,articul:'720188',name:'Bosch WGB2560XME'},
   {...base,articul:'720687',name:'LG F4X5VYPY8',brand:'LG',ws:110,kp:70,stocks:{'003':10}},
   {...base,articul:'720689',name:'LG F4V5VYL0W',brand:'LG',ws:120,kp:60,stocks:{'023':10}},
   {...base,articul:'720189',name:'Bosch exact missing snapshot',stocks:{'003':8}},
   {...base,articul:'990009',name:'Forbidden brand',brand:'Miele',stocks:{'003':20}},
   {...base,articul:'990010',name:'Only shop stock',stocks:{'050':5}},
   {...base,articul:'990011',name:'No wholesale price',ws:0,kp:0,stocks:{'003':20}}];
  const setProducts=async rows=>{const id=crypto.randomUUID(),actor=runtime.seededUsers.find(u=>u.name==='owner').id;await runtime.db.query('insert into zzws_versions(id,products,actor) values($1,$2,$3)',[id,JSON.stringify(rows),actor]);await runtime.db.query('update zzws_state set version=$1 where id',[id]);return id;};
  const version=await setProducts(products),input={sourceArticul:'720188',qty:2,rows:[],includeLast:false,priceMode:'WS'};
  const before=await runtime.db.query('select (select count(*) from zzws_orders)::int orders,(select products from zzws_versions where id=$1) products,(select count(*) from zzws_user_memory)::int memory',[version]);
  assert.equal((await call('catalog/stock-replacements',null,input)).status,401);
  assert.equal((await call('catalog/stock-replacements',owner,undefined)).status,405);
  const admin=await ok('catalog/stock-replacements',owner,input);assert.equal(admin.reason,'ok');assert(admin.candidates.some(p=>p.articul==='720687'));assert(admin.candidates.every(p=>p.availableQty>=2&&p.allocations.length));
  assert.equal((await ok('catalog/stock-replacements',manager,input)).reason,'ok','catalogue manager remains allowed without price:read');
  const customer=await ok('catalog/stock-replacements',client,{...input,priceMode:'KP',includeLast:true});assert.equal(customer.priceMode,'WS');assert(customer.candidates.length);assert(!customer.candidates.some(p=>['990010','990011'].includes(p.articul)));
  const huge=await ok('catalog/stock-replacements',client,{...input,qty:999999});assert.deepEqual(huge.candidates,customer.candidates);assert.equal(customer.quantityConfirmed,false);assert(customer.candidates.every(p=>p.quantityConfirmed===false));
  for(const row of customer.candidates)for(const field of ['availableQty','allocations','kpPrice','stockStatus','_stockStatus','targetWarehousesStock'])assert(!Object.hasOwn(row,field));
  assert.equal(customer.candidates.find(p=>p.articul==='720687').price,110);assert.equal((await ok('catalog/stock-replacements',kp,input)).candidates.find(p=>p.articul==='720687').price,70);
  assert.equal((await call('catalog/stock-replacements',owner,{...input,sourceArticul:'unknown'})).status,404);
  assert.equal((await call('catalog/stock-replacements',owner,{...input,qty:1000000})).status,400);
  assert.equal((await call('catalog/stock-replacements',owner,{...input,manualRequirements:{capacity:8},manualModes:{capacity:'minimum'}})).status,400);
  const minCapacity=await ok('catalog/stock-replacements',owner,{...input,manualRequirements:{capacity:8},manualModes:{capacity:'min'}});assert.deepEqual(minCapacity.manualModes,{capacity:'min'});assert(minCapacity.candidates.some(p=>p.articul==='720687'),'known 9kg meets user minimum8kg');assert(minCapacity.candidates.every(p=>p.manualModes.capacity==='min'));
  const maxCapacity=await ok('catalog/stock-replacements',owner,{...input,manualRequirements:{capacity:8},manualModes:{capacity:'max'}});assert(!maxCapacity.candidates.some(p=>p.articul==='720687'),'known 9kg does not meet user maximum8kg');
  const blacklisted=await ok('catalog/stock-replacements',owner,{...input,rows:[{articul:'720687',qty:1}],candidateArticul:'720687'});assert.deepEqual(blacklisted.candidates,[]);
  const strict=await ok('catalog/stock-replacements',owner,{...input,sameBrand:true,maxPrice:100});assert(strict.candidates.every(p=>p.brand==='Bosch'&&p.price<=100));
  const dealer=runtime.seededUsers.find(u=>u.name==='dealer');await runtime.db.query("update zzws_users set profile=jsonb_set(profile,'{catalogAccess}',$2::jsonb) where id=$1",[dealer.id,JSON.stringify({mode:'selected',include:[{brand:'Bosch',category:'',categoryMatch:'exact'}],exclude:[]})]);client=await login('dealer');
  assert.equal((await call('catalog/stock-replacements',client,{...input,sourceArticul:'720687'})).status,404,'forOrder projection never bypasses access to zero/hidden source');
  const limited=await ok('catalog/stock-replacements',client,input);assert(limited.candidates.length);assert(limited.candidates.every(p=>p.brand==='Bosch'));
  const after=await runtime.db.query('select (select count(*) from zzws_orders)::int orders,(select products from zzws_versions where id=$1) products,(select count(*) from zzws_user_memory)::int memory',[version]);assert.deepEqual(after.rows,before.rows,'all suggestions and validation are read-only');assert.equal(runtime.reportEmails.length,0);
  await setProducts(products.map(p=>p.articul==='720687'?{...p,stocks:{}}:p));assert.deepEqual((await ok('catalog/stock-replacements',owner,{...input,candidateArticul:'720687'})).candidates,[],'fresh candidate validation observes stock removed after search');
  await setProducts(products.map(p=>p.articul==='720188'?{...p,stocks:{'003':1}}:p));assert.equal((await ok('catalog/stock-replacements',owner,input)).reason,'source_available','partial stock is not a zero-stock replacement request');
 }finally{await runtime.close();}
});
