import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import XLSX from '../supabase/functions/zzws-api/vendor/xlsx.mjs';

test('client managers and inherited employees complete private buyer offers with their own catalogue, price floor and public retail promotion',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true});
 const call=async(path,token,data={})=>{
  const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:'POST',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));
  return response.headers.get('content-type')?.includes('spreadsheet')?{status:response.status,bytes:new Uint8Array(await response.arrayBuffer())}:{status:response.status,data:await response.json()};
 };
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result.data));return result.data??result;};
 const route=action=>'dealer/buyer-offers/'+action,completed=[];
 const confidential=/unitCost|wholesale|kpPrice|kpPromo|stockPickerPrices|markup|minimum|expectedProfit|floor/;
 try{
  await r.db.exec('reset role');
  const dealerId=r.seededUsers.find(user=>user.name==='dealer').id,employeeId=crypto.randomUUID();
  await r.db.query("update zzws_users set profile=jsonb_set(profile,'{catalogAccess}',$2::jsonb) where id=$1",[dealerId,JSON.stringify({mode:'selected',include:[{brand:'Samsung',category:'',categoryMatch:'exact'}],exclude:[]})]);
  await r.db.query("insert into auth.users(id,email,password_hash,password_salt) select $1,'zzws-test-buyer-employee@users.zzws.invalid',password_hash,password_salt from auth.users where id=$2",[employeeId,dealerId]);
  await r.db.query("insert into zzws_users(id,login,profile,active,needs_password_setup,needs_profile_setup,customer_id) select $1,'zzws-test-buyer-employee',profile,true,false,false,id from zzws_users where id=$2",[employeeId,dealerId]);
  const inherited=(await r.db.query('select profile from zzws_users where id=$1',[employeeId])).rows[0].profile;assert.equal(inherited.sheet,'Dealers');assert.equal(inherited.catalogAccess.include[0].brand,'Samsung');
  const source=(await r.db.query('select products from zzws_versions where id=(select version from zzws_state where id=true)')).rows[0].products;
  // This item has a procurement promotion but no retail reduction. A buyer must not see a fabricated retail sale.
  source[3].base=source[3].retail;source[3].kpPromo=70000;
  await r.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id=true)',[JSON.stringify(source)]);
  await r.db.exec('set role service_role');
  for(const [login,category,cost]of [['dealer','Dealers',100000],['kp','KP',80000],['buyer-employee','Dealers',100000]]){
   const token=(await ok('login',null,{login:'zzws-test-'+login,password:'24681012'})).sessionToken;
   const options=await ok(route('options'),token);assert.deepEqual(options.priceCategories.map(row=>row.id),[category]);
   const setup={buyerName:'Synthetic client buyer',buyerPhone:'091123456',markupPercent:15,priceCategory:category};
   assert.equal((await call(route('start'),token,{...setup,priceCategory:category==='KP'?'Dealers':'KP'})).status,400,'Clients cannot select another procurement category');
   const started=await ok(route('start'),token,setup),catalog=await ok(route('catalog'),token,{id:started.id});
   assert.ok(catalog.products.length>0);assert.doesNotMatch(JSON.stringify(catalog),confidential);
   const publicSale=catalog.products.find(row=>row.articul==='900001'),procurementOnly=catalog.products.find(row=>row.articul==='900004');
   assert.equal(publicSale.retail,120000);assert.deepEqual(publicSale.retailPromotion,{previousRetail:140000});assert.equal(procurementOnly.retailPromotion,null);
   if(category==='Dealers'){
    assert.ok(catalog.products.every(row=>row.brand==='Samsung'),'A client and its employee inherit the saved catalogue restrictions');
    assert.equal((await call(route('quote'),token,{id:started.id,lines:[{articul:'900002',qty:1,salePrice:150000}]})).status,409,'Buyer mode cannot quote a hidden SKU');
    assert.equal((await call(route('details'),token,{id:started.id,articuls:['900002']})).status,404);
   }
   if(completed.length)assert.equal((await call(route('export'),token,{id:completed[0].offer.id})).status,404,'A different client or employee cannot export another actor offer');
   const salePrice=cost*115/100,lines=[{articul:'900001',qty:2,salePrice}];
   const below=await call(route('quote'),token,{id:started.id,lines:[{...lines[0],salePrice:salePrice-1}]});assert.equal(below.status,409);assert.ok(!JSON.stringify(below).includes(String(cost)));
   const quote=await ok(route('quote'),token,{id:started.id,lines});assert.equal(quote.total,salePrice*2);assert.deepEqual(quote.lines[0].retailPromotion,{previousRetail:140000});assert.doesNotMatch(JSON.stringify(quote),confidential);
   const requestId=crypto.randomUUID(),offer=await ok(route('finalize'),token,{id:started.id,requestId,lines});assert.match(offer.number,/^ZZWS-\d{6}$/);assert.equal(offer.lines[0].retail,120000);assert.deepEqual(offer.lines[0].retailPromotion,{previousRetail:140000});assert.doesNotMatch(JSON.stringify(offer),confidential);
   const exported=await ok(route('export'),token,{id:started.id}),book=XLSX.read(exported.bytes,{type:'array'});assert.equal(book.Sheets['Առաջարկ'].B4.v,offer.number);
   const handed=await ok(route('handoff'),token,{id:started.id,requestId:crypto.randomUUID()});assert.equal(handed.cart['900001'].qty,2);assert.equal(handed.expectedProfit,(salePrice-cost)*2);assert.equal(handed.cart['900001'].addedPrice,cost);assert.equal(handed.priceCategory,category);
   const replay=await ok(route('handoff'),token,{id:started.id,requestId:crypto.randomUUID()});assert.equal(replay.cart['900001'].qty,2);assert.equal(replay.version,handed.version);
   completed.push({token,offer,requestId,lines});
  }
  await r.db.exec('reset role');source[0].retail=125000;source[0].base=145000;await r.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id=true)',[JSON.stringify(source)]);await r.db.exec('set role service_role');
  const previous=completed[0];assert.deepEqual(await ok(route('finalize'),previous.token,{id:previous.offer.id,requestId:previous.requestId,lines:previous.lines}),previous.offer,'Saved public retail and promotion metadata are immutable when catalogue prices change');
  await r.db.exec('reset role');await r.db.query('update zzws_users set active=false where id=$1',[dealerId]);await r.db.exec('set role service_role');
  assert.equal((await call(route('options'),completed[2].token)).status,401,'Disabling the parent customer revokes inherited employee access');
  assert.equal((await r.db.query('select count(*)::int n from zzws_orders')).rows[0].n,0);assert.equal(r.telegramMessages.length,0);assert.equal(r.pushMessages.length,0);assert.equal(r.reportEmails.length,0);
 }finally{await r.close();}
});
