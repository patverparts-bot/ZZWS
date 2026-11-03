import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createRuntime} from './support/runtime.mjs';
const require=createRequire(import.meta.url),data=require('../js/proposal-data.js'),core=require('../js/warehouse-allocation.js');
assert.deepEqual(data.parse([['Մոդել','Քանակ','Գին'],['Bosch X12','2','1000'],['001234','3','']]).map(r=>[r.quantity,r.price]),[[2,1000],[3,null]]);
assert.equal(data.parse([['001234','2','1200']])[0].name,'001234');
for(const value of ['0','-1','foo'])assert.throws(()=>data.parse([['Model','2',value]]));
assert.throws(()=>data.parse([['Model','1.5','']]));
const sample={articul:'001',name:'Bosch X12',wholesale:100,stockPickerPrices:{KP:null,Dealers:200}};
assert.equal(data.resolve(data.parse([['001','2','']]),[sample],'KP',core)[0].price,null);
assert.equal(data.resolve(data.parse([['001','2','200']]),[sample],'Dealers',core)[0].special,false);
assert.equal(data.resolve(data.parse([['001','2','199']]),[sample],'Dealers',core)[0].special,true);
assert.deepEqual(data.total([{price:1700,quantity:3},{price:3200,quantity:4}]),{amount:17900,unpriced:0});
assert.deepEqual(data.total([{price:100,quantity:2},{price:null,quantity:3}]),{amount:200,unpriced:3});
const runtime=await createRuntime({memory:true});
const base='http://127.0.0.1:8080/functions/v1/zzws-api/';
const call=async(path,token,body)=>{const response=await runtime.handle(new Request(base+path,{method:body?'POST':'GET',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,data:await response.json()};};
try{
 const owner=(await call('login',null,{login:'zzws-test-owner',password:'24681012'})).data.sessionToken;
 const client=(await call('login',null,{login:'zzws-test-dealer',password:'24681012'})).data.sessionToken;
 const catalogue=(await call('catalog',owner)).data,product=catalogue.products[0];
 const payload={priceMode:'KP',lines:[{articul:product.articul,quantity:3,price:12345,special:true}]};
 assert.equal((await call('catalog/proposals',null,payload)).status,401);
 const created=await call('catalog/proposals',owner,payload);assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(Date.parse(created.data.expiresAt)-Date.parse(created.data.createdAt),604800000);
 const custom=await call('catalog/proposals',owner,{...payload,validDays:14});assert.equal(custom.status,200);assert.equal(Date.parse(custom.data.expiresAt)-Date.parse(custom.data.createdAt),14*86400000);for(const validDays of [0,-1,1.5,366])assert.equal((await call('catalog/proposals',owner,{...payload,validDays})).status,400);
 const read=await call('proposal/view?token='+created.data.token);assert.equal(read.status,200);assert.equal(read.data.lines[0].price,12345);assert.equal(read.data.lines[0].quantity,3);assert.equal(read.data.lines[0].special,true);
 assert(!JSON.stringify(read.data).includes('stockPickerPrices'));assert(!('owner_id'in read.data));assert(!('stockStatus'in read.data.lines[0]));
 assert.equal((await call('proposal/view?token='+'a'.repeat(64))).status,404);
 assert.equal((await call('catalog/proposals',owner,{...payload,lines:[{...payload.lines[0],articul:'not-visible'}]})).status,400);
 assert.equal((await call('catalog/proposals',owner,{...payload,lines:[{...payload.lines[0],special:false,price:1}]})).status,400);
 const cp=(await call('catalog',client)).data.products[0],beforeDenied=(await runtime.db.query('select count(*)::int count from zzws_proposals')).rows[0].count;assert.equal((await call('catalog/proposals',client,{priceMode:'Dealers',lines:[{articul:cp.articul,quantity:1,price:cp.wholesale,special:false}]})).status,403);assert.equal((await runtime.db.query('select count(*)::int count from zzws_proposals')).rows[0].count,beforeDenied,'a valid client cannot create or share proposals');
 for(const name of ['manager','viewer']){const admin=(await call('login',null,{login:'zzws-test-'+name,password:'24681012'})).data.sessionToken;assert.equal((await call('catalog/proposals',admin,payload)).status,200,'administrator role remains allowed independently of order-write scope');}
 await runtime.db.exec("reset role;update zzws_proposals set created_at=created_at-interval '8 days',expires_at=expires_at-interval '8 days';set role service_role");
 assert.equal((await call('proposal/view?token='+created.data.token)).status,404);
 await runtime.db.exec('reset role;set role anon');await assert.rejects(runtime.db.query('select * from zzws_proposals'));await runtime.db.exec('reset role;set role service_role');
 console.log('Proposal parsing, prices, projection, anonymous capability read, expiry and RLS passed');
}finally{await runtime.close();}
