import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import {storefrontSettings} from '../supabase/functions/zzws-api/storefront.mjs';

test('storefront writes require fresh owner confirmation and restricted catalogues never expose hidden pinned or ranked SKUs',async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,value)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result));return result.data;};
 const login=async role=>(await ok('login',null,{login:'zzws-test-'+role,password:'24681012'})).sessionToken;
 try{
  const owner=await login('owner');let client=await login('dealer');
  const before=await ok('admin/catalog-controls',owner),value=storefrontSettings();value.pinned=['test-004','test-008','test-015'];
  const unconfirmed=await call('admin/catalog-controls',owner,{kind:'storefront',revision:before.revision,value});assert.equal(unconfirmed.status,428);assert.equal(unconfirmed.data.reauthRequired,true);
  assert.deepEqual(await ok('admin/catalog-controls',owner),before,'a valid owner session alone cannot persist storefront settings');
  await ok('account/reauth',owner,{password:'24681012'});await ok('admin/catalog-controls',owner,{kind:'storefront',revision:before.revision,value});
  // A real completed purchase ranks a SKU that will subsequently be hidden.
  const me=await ok('me',client),catalog=await ok('catalog',client),hidden=catalog.products.find(row=>row.articul==='test-008');assert.ok(hidden);
  const order=await ok('orders',client,{requestId:crypto.randomUUID(),lines:[{articul:hidden.articul,qty:1,unitPrice:hidden.wholesale}],delivery:{...me.rowsList[0],method:'Առաքում'},profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id});
  await runtime.db.query("update zzws_orders set status='completed' where id=$1",[order.id]);
  const dealer=runtime.seededUsers.find(row=>row.name==='dealer');
  await runtime.db.query("update zzws_users set profile=jsonb_set(profile,'{catalogAccess}',$2::jsonb) where id=$1",[dealer.id,JSON.stringify({mode:'selected',include:[{brand:'Samsung',category:'',categoryMatch:'exact'}],exclude:[]})]);
  client=await login('dealer');const restricted=await ok('catalog',client),dto=restricted.storefront;
  assert.ok(restricted.products.length);assert.ok(restricted.products.every(product=>product.brand==='Samsung'));
  assert.deepEqual(dto.banners,['test-004']);assert.deepEqual(dto.manualBanners,['test-004']);
  assert.ok(dto.banners.every(sku=>restricted.products.some(product=>product.articul===sku)));
  assert.deepEqual(Object.keys(dto).sort(),['bannerSeconds','banners','manualBanners','newDays','sections']);
  const serialized=JSON.stringify(dto);for(const hiddenValue of ['test-008','test-015',order.id,...runtime.seededUsers.map(user=>user.id)])assert.equal(serialized.includes(hiddenValue),false,'public storefront excludes hidden SKU, order and actor identities');
  assert.equal(runtime.reportEmails.length,0);
 }finally{await runtime.close();}
});
