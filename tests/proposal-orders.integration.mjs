import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
const r=await createRuntime({memory:true}),base='http://127.0.0.1:8080/functions/v1/zzws-api/';
const call=async(path,token,body)=>{const response=await r.handle(new Request(base+path,{method:body?'POST':'GET',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,data:await response.json()};};
const ok=async(...args)=>{const out=await call(...args);assert.equal(out.status,200,JSON.stringify(out.data));return out.data;};
try{
 const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken,client=(await ok('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken,wrong=(await ok('login',null,{login:'zzws-test-kp',password:'24681012'})).sessionToken;
 const me=await ok('me',client),wrongMe=await ok('me',wrong),adminProducts=(await ok('catalog',owner)).products,sku=adminProducts[0].articul,excluded=adminProducts[0];
 // An account-specific exclusion survives ordinary catalogue reads throughout.
 await r.db.query("update zzws_users set profile=jsonb_set(profile,'{catalogAccess}',$1::jsonb) where id=$2",[JSON.stringify({mode:'all',include:[],exclude:[{brand:excluded.brand,category:excluded.category,categoryMatch:'exact'}]}),me.id]);
 assert(!(await ok('catalog',client)).products.some(p=>p.articul===sku));
 const payload={customerId:me.id,priceMode:'Dealers',lines:[{articul:sku,quantity:3,price:12345,special:true}]},offer=await ok('catalog/proposals',owner,payload);
 const publicRead=await ok('proposal/view?token='+offer.token);assert.equal(publicRead.requiresLogin,true);assert(!('lines'in publicRead));
 assert.equal((await call('catalog/proposals/open',null,{token:offer.token})).status,401);
 assert.equal((await call('catalog/proposals/open',wrong,{token:offer.token})).status,403);
 assert.equal((await ok('catalog/proposal-cart',client)).products.length,0);
 const inbox=await ok('catalog/proposals/inbox',client);assert.equal(inbox.offers.length,1);assert.equal(inbox.offers[0].unread,true);assert.equal((await ok('catalog/proposals/inbox',wrong)).offers.length,0);
 const opened=await ok('catalog/proposals/open',client,{proposalId:inbox.offers[0].id});assert.equal(opened.products[0].wholesale,12345);assert.equal(opened.products[0].quantity,3);assert.equal((await ok('catalog/proposals/inbox',client)).offers[0].unread,false);
 assert(!(await ok('catalog',client)).products.some(p=>p.articul===sku),'Opening an offer never broadens the ordinary catalogue');
 assert.equal((await ok('catalog/proposal-cart',client)).products.length,0,'Viewing does not change cart price permissions');
 const granted=await ok('catalog/proposals/accept',client,{proposalId:inbox.offers[0].id}),hash=granted.proposalId;
 const quote=await ok('orders/quote',client,{articuls:[sku],proposalRefs:[{articul:sku,proposalHash:hash}]});assert.equal(quote.products[0].wholesale,12345);assert.equal((await ok('orders/quote',wrong,{articuls:[sku]})).products.some(p=>p.wholesale===12345),false);
 const freshMe=await ok('me',client),ordinary=(await ok('catalog',client)).products[0];assert(ordinary);const order={requestId:crypto.randomUUID(),profileRevision:freshMe.profileRevision,deliveryVariantId:freshMe.rowsList[0].id,delivery:{method:'Ինքնաառաքում'},lines:[{articul:sku,qty:5,unitPrice:12345,proposalHash:hash},{articul:ordinary.articul,qty:2,unitPrice:ordinary.wholesale}]};
 assert.equal((await call('orders',client,{...order,lines:[{articul:sku,qty:0,unitPrice:12345,proposalHash:hash}]})).status,400);
 assert.equal((await call('orders',client,{...order,lines:[{articul:sku,qty:3,unitPrice:1,proposalHash:hash}]})).status,409);
 const accepted=await ok('orders',client,order);assert.equal(accepted.total,5*12345+2*ordinary.wholesale);assert.equal(accepted.lines[0].unitPrice,12345);assert.equal(accepted.lines[0].qty,5);assert.equal((await ok('orders',client,order)).id,accepted.id,'Retries return the same order');
 const evidence=(await r.db.query('select context from zzws_order_calculation_contexts where order_id=$1',[accepted.id])).rows[0].context;assert.equal(evidence.lines[0].priceOrigin,'proposal');
 await r.db.exec("reset role;update zzws_proposals set created_at=created_at-interval '8 days',expires_at=expires_at-interval '8 days';set role service_role");
 assert.equal((await call('catalog/proposals/open',client,{token:offer.token})).status,404);assert.equal((await ok('orders/quote',client,{articuls:[sku]})).unavailable[0],sku);assert.equal((await ok('catalog/proposal-cart',client)).products.length,0);assert.equal((await call('orders/quote',client,{articuls:[sku],proposalRefs:[{articul:sku,proposalHash:hash}]})).status,409);
 assert.equal((await ok('orders',client,order)).id,accepted.id,'An accepted retry remains idempotent after offer expiry');
 const anonymous=await ok('catalog/proposals',owner,{priceMode:'Dealers',lines:payload.lines});assert((await ok('proposal/view?token='+anonymous.token)).lines.length);assert.equal((await call('catalog/proposals/open',client,{token:anonymous.token})).status,404,'Unbound links are view only');
 assert.equal((await call('catalog/proposals',client,{...payload,customerId:wrongMe.id})).status,403);
 console.log('Recipient login, wrong-account isolation, inbox, explicit offer view, restricted product order at frozen price/quantity, idempotency and expiry passed');
}finally{await r.close();}
