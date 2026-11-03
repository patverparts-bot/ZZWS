import test from 'node:test';
import assert from 'node:assert/strict';
import {customerProposalLines,proposalRoutes} from '../supabase/functions/zzws-api/proposals.mjs';
import {project} from '../supabase/functions/zzws-api/catalog.mjs';

const product={articul:'001',name:'Exact product',brand:'Example',category:'Test',wholesale:200,stockPickerPrices:{Dealers:200,KP:170}},pricing={categoryId:'cat_vip',categoryName:'VIP'};
const row={articul:'001',quantity:2,price:200,special:false,priceProvided:false};
test('customer prices calculate only blank rows; explicit input remains explicit even when equal to a prior base',()=>{
 const q=customerProposalLines([row,{...row,priceProvided:true}], [product],[{...product,wholesale:170}],pricing,{quote:true});assert.deepEqual(q.map(p=>[p.price,p.priceProvided,p.special]),[[170,false,false],[200,true,true]]);
 assert.deepEqual(customerProposalLines([q[1]],[product],[{...product,wholesale:180}],pricing).map(p=>[p.price,p.priceProvided,p.special]),[[200,true,true]]);
 const equal=customerProposalLines([{...row,priceProvided:true}],[product],[{...product,wholesale:200}],pricing,{quote:true})[0];assert.equal(equal.special,false);assert.equal(equal.priceProvided,true);assert.equal(customerProposalLines([equal],[product],[{...product,wholesale:180}],pricing)[0].price,200);
 assert.throws(()=>customerProposalLines([q[0]],[product],[{...product,wholesale:180}],pricing),{code:409});
 assert.equal(customerProposalLines([{...row,special:true,price:123,priceProvided:undefined}],[product],[],pricing)[0].price,123,'legacy special=true remains an explicit custom grant');
 assert.equal(customerProposalLines([row],[product],[],pricing,{quote:true})[0].price,null,'missing client price never falls back to admin price');
 assert.throws(()=>customerProposalLines([{...row,priceProvided:'false'}],[product],[],pricing,{quote:true}),{code:400});assert.throws(()=>customerProposalLines([{...row,priceProvided:true,price:null}],[product],[],pricing,{quote:true}),{code:400});
});
test('client proposal quote uses effective default rules when stored rules are empty and never writes',async()=>{
 const id='123e4567-e89b-12d3-a456-426614174000',raw={articul:'001',name:'Exact product',brand:'Example',category:'Test',retail:300,base:300,ws:200,kp:170,kpPromo:0,stocks:{'003':10}};
 for(const sheet of ['Dealers','KP']){
  let selected=0;const table=name=>{assert.equal(name,'users');return {select(){return this},eq(){return this},is(){return this},maybeSingle(){selected++;return this}};};
  const result=await proposalRoutes({path:'catalog/proposals/quote',req:new Request('https://example.invalid',{method:'POST'}),user:{id:'admin',role:'admin',permissions:['orders:write']},body:async()=>({customerId:id,lines:[row],priceMode:'forged-mode'}),current:async()=>({products:[raw],rules:{},mainWarehouses:['003']}),project,table,query:async()=>({id,profile:{role:'client',sheet,allBrands:true,client:'Client'}}),json:value=>value,fail:(code,message)=>{throw Object.assign(Error(message),{code});},random:()=>{throw Error('Quote must not create a token')},digest:()=>{throw Error('Quote must not create an archive')}});
  assert.equal(selected,1);assert.equal(result.pricing.categoryId,sheet);assert.equal(result.priceMode,sheet);assert.equal(result.lines[0].price,sheet==='KP'?170:200);assert.equal(result.lines[0].priceProvided,false);
 }
});
test('quote rejects missing/employee/client identities and administrators without customer authority before input access',async()=>{
 for(const user of [null,{role:'client'},{role:'client',clientRole:'employee'},{role:'admin',permissions:['price:read']}]){
  const deny=()=>{throw Error('Unexpected input/storage access')};await assert.rejects(proposalRoutes({path:'catalog/proposals/quote',req:new Request('https://example.invalid',{method:'POST'}),user,body:deny,table:deny,query:deny,current:deny,fail:(code,message)=>{throw Object.assign(Error(message),{code});}}),error=>error.code===403);
 }
});
