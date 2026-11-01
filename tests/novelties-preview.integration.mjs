import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRuntime} from './support/runtime.mjs';

// Isolated, ordinary synthetic sessions against the downloaded production handler.
// SQL below supplies fixture data only; no production access or schema changes.
async function fixture(){
 const sourceRoot=process.env.ZZWS_API_SOURCE_ROOT||path.resolve('work/novelties/api-candidate/supabase/functions/zzws-api');
 const runtime=await createRuntime({memory:true,sourceRoot});
 const call=async(route,token,value)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+route,{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result));return result.data;};
 const introduced=days=>new Date(Date.now()-days*86400000).toISOString();
 const product=(articul,brand,age,extra={})=>({articul,brand,name:'Synthetic newness '+articul,category:'Հեռուստացույց',retail:200,base:250,ws:100,kp:90,kpPromo:80,stocks:{'003':5},introducedAt:introduced(age),...extra});
 const products=[product('910001','Samsung',10),product('910002','Bosch',10,{ws:150,kp:140,kpPromo:130}),product('910003','Samsung',20),product('910004','Bosch',2),product('910005','Samsung',10,{stocks:{'003':0,'050':8}}),product('910006','Samsung',10,{ws:0,kp:0,kpPromo:0}),product('910007','LG',10)];
 await runtime.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id)',[JSON.stringify(products)]);
 for(const [name,brand]of [['dealer','Samsung'],['kp','Bosch']])await runtime.db.query('update zzws_users set profile=profile||$1::jsonb where id=$2',[JSON.stringify({allBrands:false,brands:[brand],catalogAccess:{mode:'selected',include:[{brand,category:'',categoryMatch:'exact'}],exclude:[]}}),runtime.seededUsers.find(user=>user.name===name).id]);
 const tokens={};for(const name of ['owner','manager','viewer','price','dealer','kp'])tokens[name]=(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 await ok('account/reauth',tokens.owner,{password:'24681012'});
 const companyA=await ok('me',tokens.dealer),companyB=await ok('me',tokens.kp);
 const invite=await ok('team/invite',tokens.dealer,{label:'Newness fixture employee'}),opened=await ok('invitation/open',null,{code:invite.invitation.code});
 tokens.employee=(await ok('account/password',opened.sessionToken,{login:'newness-preview-employee',password:'Synthetic-fixture-2468',firstName:'Fixture',lastName:'Employee',phone:'+37499123456',email:'fixture.employee@example.am'})).sessionToken;
 const employee=await ok('me',tokens.employee);
 const preview=async(customer,token=tokens.owner)=>ok('admin/orders/customer-catalog?customerId='+customer.id,token);
 const days=async newDays=>{const settings=await ok('admin/catalog-controls',tokens.owner),value=settings.config.storefront||{newDays:7,bannerSeconds:8,pinned:[],excluded:[],sections:Object.fromEntries(['terms','delivery','contacts','help'].map(key=>[key,{enabled:true,hy:'',ru:''}]))};return ok('admin/catalog-controls',tokens.owner,{kind:'storefront',revision:settings.revision,value:{...value,newDays}});};
 return {runtime,call,ok,tokens,companyA,companyB,employee,preview,days,products};
}

test('configured 14-day newness matches normal catalogues and administrator previews globally across Dealer/KP/employee scopes',async()=>{
 const f=await fixture();try{
  await f.days(14);
  const a=await f.ok('catalog',f.tokens.dealer),b=await f.ok('catalog',f.tokens.kp),staff=await f.ok('catalog',f.tokens.employee);
  assert.equal(a.storefront.newDays,14);assert.equal(b.storefront.newDays,14);assert.equal(staff.storefront.newDays,14);
  assert.deepEqual(staff.products,a.products,'ordinary employee inherits company catalogue and newness, not administrator scope');
  assert.deepEqual((await f.preview(f.companyA)).products,a.products,'preview must use configured14, not silent default7');
  assert.deepEqual((await f.preview(f.companyB)).products,b.products);
  assert.deepEqual((await f.preview(f.companyA,f.tokens.manager)).products,a.products,'every authorized order manager uses same policy');
  const first=a.products.find(p=>p.articul==='910001');assert.equal(first.isNew,true);assert.equal(first.newUntil,new Date(Date.parse(f.products[0].introducedAt)+14*86400000).toISOString());
  assert.equal(a.products.find(p=>p.articul==='910003').isNew,undefined,'older than configured window stays old');
  assert.ok(a.products.every(p=>p.brand==='Samsung'));assert.ok(b.products.every(p=>p.brand==='Bosch'));assert.equal(a.products.some(p=>p.articul==='910007'),false);assert.equal(b.products.some(p=>p.articul==='910007'),false);
  assert.equal(first.wholesale,100,'Dealer keeps WS');assert.equal(b.products.find(p=>p.articul==='910002').wholesale,130,'KP keeps effective promo price');
  assert.equal(a.products.find(p=>p.articul==='910005').stockAvailable,false,'other-stock visibility does not become main-stock availability');assert.equal(a.products.some(p=>p.articul==='910006'),false,'unpriced customer product is still excluded');
  for(const p of [...a.products,...b.products,...staff.products]){assert.equal('kpPrice'in p,false);assert.equal('kpIsPromo'in p,false,'purchase flags never enter client scope');}
  await f.days(7);
  for(const [token,customer]of [[f.tokens.dealer,f.companyA],[f.tokens.kp,f.companyB]]){const normal=await f.ok('catalog',token),preview=await f.preview(customer);assert.deepEqual(preview.products,normal.products);assert.equal(normal.products.find(p=>p.articul===((customer.id===f.companyA.id)?'910001':'910002')).isNew,undefined,'ten-day product expires under default7');}
  assert.equal((await f.ok('catalog',f.tokens.kp)).products.find(p=>p.articul==='910004').isNew,true,'two-day product remains new');
 }finally{await f.runtime.close();}
});

test('preview newness consistency preserves authorization, personal state, selected prices and customer isolation',async()=>{
 const f=await fixture();try{
  await f.days(14);const before={};for(const name of ['dealer','kp','employee'])before[name]={profile:await f.ok('me',f.tokens[name]),state:await f.ok('me/state',f.tokens[name]),carts:await f.ok('me/carts',f.tokens[name])};
  for(const name of ['viewer','price','dealer','kp','employee'])assert.equal((await f.call('admin/orders/customer-catalog?customerId='+f.companyA.id,f.tokens[name])).status,403,name+' cannot gain assisted catalogue access');
  assert.equal((await f.call('admin/orders/customer-catalog?customerId='+f.companyA.id)).status,401);
  assert.equal((await f.call('admin/orders/customer-catalog?customerId='+f.employee.id,f.tokens.owner)).status,403,'employee account cannot be substituted as company primary');
  const a=await f.preview(f.companyA),b=await f.preview(f.companyB);assert.notDeepEqual(a.products.map(p=>p.articul),b.products.map(p=>p.articul));assert.equal(a.customer.id,f.companyA.id);assert.equal(b.customer.id,f.companyB.id);
  for(const [token,preview]of [[f.tokens.dealer,a],[f.tokens.kp,b]]){const quote=await f.ok('orders/quote',token,{articuls:preview.products.map(p=>p.articul)});for(const product of preview.products){const priced=quote.products.find(p=>p.articul===product.articul);assert.ok(priced);assert.equal(priced.wholesale,product.wholesale);assert.equal(priced.stockAvailable,product.stockAvailable);}}
  for(const name of ['dealer','kp','employee']){assert.deepEqual(await f.ok('me',f.tokens[name]),before[name].profile);assert.deepEqual(await f.ok('me/state',f.tokens[name]),before[name].state);assert.deepEqual(await f.ok('me/carts',f.tokens[name]),before[name].carts);}
  assert.equal((await f.runtime.db.query('select count(*)::int as n from zzws_orders')).rows[0].n,0);assert.equal(f.runtime.reportEmails.length,0);
 }finally{await f.runtime.close();}
});
