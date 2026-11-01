import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import {storefrontSettings} from '../supabase/functions/zzws-api/storefront.mjs';

test('owner storefront writes reject invalid inputs and other scopes without changing persisted state',async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,value)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result));return result.data;};
 try{
  const sessions={};for(const role of ['owner','manager','viewer','price','dealer'])sessions[role]=(await ok('login',null,{login:'zzws-test-'+role,password:'24681012'})).sessionToken;
  await ok('account/reauth',sessions.owner,{password:'24681012'});
  const before=await ok('admin/catalog-controls',sessions.owner),value=storefrontSettings();value.pinned=['test-003'];value.excluded=['test-007'];value.sections.delivery={enabled:true,hy:'  Առաքում  ',ru:'  Delivery conditions  '};
  for(const role of ['manager','viewer','price','dealer']){
   assert.equal((await call('admin/catalog-controls',sessions[role])).status,403,role+' cannot read owner settings');
   assert.equal((await call('admin/catalog-controls',sessions[role],{kind:'storefront',revision:before.revision,value})).status,403,role+' cannot change settings');
  }
  const invalid=[{...value,newDays:0},{...value,newDays:'7'},{...value,bannerSeconds:4},{...value,pinned:['missing-sku']},{...value,excluded:['missing-sku']},{...value,pinned:['test-003','test-003']},{...value,excluded:['test-003']},{...value,pinned:Array.from({length:9},(_,i)=>'test-'+String(i+1).padStart(3,'0'))},{...value,sections:{...value.sections,private:{enabled:true,hy:'',ru:''}}},{...value,sections:{...value.sections,terms:{enabled:true,hy:'',ru:'x'.repeat(10001)}}},{...value,unreviewedSetting:true}];
  for(const item of invalid){assert.equal((await call('admin/catalog-controls',sessions.owner,{kind:'storefront',revision:before.revision,value:item})).status,400);assert.deepEqual(await ok('admin/catalog-controls',sessions.owner),before,'validation cannot partially save');}
  const saved=await ok('admin/catalog-controls',sessions.owner,{kind:'storefront',revision:before.revision,value});assert.notEqual(saved.revision,before.revision);assert.equal(saved.config.storefront.sections.delivery.ru,'Delivery conditions');
  for(const [key,entry] of Object.entries(before.config||{}))assert.deepEqual(saved.config[key],entry,'unrelated config retained: '+key);
  assert.deepEqual(await ok('admin/catalog-controls',sessions.owner),saved,'new request reloads persisted values');
  assert.equal((await call('admin/catalog-controls',sessions.owner,{kind:'storefront',revision:before.revision,value})).status,409);
  const catalog=await ok('catalog',sessions.dealer);assert.equal(catalog.storefront.sections.delivery.ru,'Delivery conditions');assert.ok(catalog.storefront.banners.every(sku=>catalog.products.some(p=>p.articul===sku)));assert.ok(!Object.keys(catalog.storefront).some(k=>/orders|customers|actor|email/i.test(k)));
 }finally{await runtime.close();}
});
