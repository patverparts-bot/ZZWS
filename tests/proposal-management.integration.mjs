import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
const r=await createRuntime({memory:true,debug:true}),base='http://127.0.0.1:8080/functions/v1/zzws-api/';
async function call(path,token,body){const out=await r.handle(new Request(base+path,{method:body?'POST':'GET',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}));return{status:out.status,data:await out.json()};}
async function ok(...a){const v=await call(...a);assert.equal(v.status,200,JSON.stringify(v.data));return v.data;}
try{
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 const owner=await login('owner'),manager=await login('manager'),client=await login('dealer'),me=await ok('me',client),p=(await ok('catalog',owner)).products[0];
 const offer=await ok('catalog/proposals',manager,{priceMode:'Dealers',lines:[{articul:p.articul,quantity:2,price:12345,special:true}]});
 const mine=await ok('catalog/proposals/mine',manager);assert.equal(mine.offers.length,1);assert.equal(mine.offers[0].recipient,null);assert(mine.offers[0].canEdit);assert.equal((await ok('catalog/proposals/mine',owner)).offers.length,0);
 assert.equal((await call('admin/proposals',manager)).status,403);assert.equal((await call('catalog/proposals/mine',client)).status,403);const all=await ok('admin/proposals',owner);assert.equal(all.offers.length,1);assert.equal(all.offers[0].canEdit,false);assert(all.offers[0].author.login);
 const item=mine.offers[0],update={id:item.id,revision:item.revision,validDays:10,priceMode:'Dealers',lines:[{...item.lines[0],price:13579,special:true}]};
 assert.equal((await call('catalog/proposals/update',owner,update)).status,404);await ok('catalog/proposals/update',manager,update);assert.equal((await ok('proposal/view?token='+offer.token)).lines[0].price,13579);assert.equal((await call('catalog/proposals/update',manager,update)).status,409);
 const targeted=await ok('catalog/proposals',owner,{customerId:me.id,priceMode:'Dealers',lines:[{articul:p.articul,quantity:1,price:23456,special:true}]});const accepted=await ok('catalog/proposals/accept',client,{token:targeted.token});const row=(await ok('catalog/proposals/mine',owner)).offers[0];
 await ok('catalog/proposals/update',owner,{id:row.id,revision:row.revision,validDays:7,priceMode:'Dealers',lines:[{...row.lines[0],price:34567,priceProvided:true,special:true}]});
 assert.equal((await ok('catalog/proposals/open',client,{token:targeted.token})).products[0].wholesale,34567);assert.equal((await ok('catalog/proposal-cart',client)).products[0].wholesale,34567);
 const quote=await ok('orders/quote',client,{articuls:[p.articul],proposalRefs:[{articul:p.articul,proposalHash:accepted.proposalId}]});assert.equal(quote.products[0].wholesale,34567);
 const order=await ok('orders',client,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Ինքնաառաքում'},lines:[{articul:p.articul,qty:1,unitPrice:34567,proposalHash:accepted.proposalId}]});assert.equal(order.total,34567);
 assert.equal((await ok('admin/proposals',owner)).offers.find(x=>x.customer_id===me.id).recipient.customerCode,me.customerCode);
 const fresh=(await ok('catalog/proposals/mine',manager)).offers[0];assert.equal((await call('catalog/proposals/delete',manager,{id:fresh.id,revision:fresh.revision})).status,403);await ok('catalog/proposals/revoke',manager,{id:fresh.id,revision:fresh.revision});assert.equal((await call('proposal/view?token='+offer.token)).status,404);const revoked=(await ok('admin/proposals',owner)).offers.find(x=>x.id===fresh.id);await ok('catalog/proposals/delete',owner,{id:revoked.id,revision:revoked.revision});assert(!(await ok('admin/proposals',owner)).offers.some(x=>x.id===fresh.id));assert.equal(Number((await r.db.query('select total from zzws_orders where id=$1',[order.id])).rows[0].total),34567);
 await r.db.exec('reset role;set role anon');await assert.rejects(r.db.query('select * from zzws_proposals'));console.log('PASS: own/all access, identity, same-link edits, revision conflicts, live cart, submitted order, revoke, owner deletion and RLS');
}finally{await r.close();}
