import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {priceCategoryId,validPriceCategory,checkedPriceCategory,projectedCategoryPrice} from '../supabase/functions/zzws-api/price-categories.mjs';
import {defaultRules} from '../supabase/functions/zzws-api/rules.mjs';
import {proposalLines} from '../supabase/functions/zzws-api/proposals.mjs';
import {validateStockReplacementInput} from '../supabase/functions/zzws-api/stock-replacements.mjs';
import {validateMemory} from '../supabase/functions/zzws-api/memory.mjs';
import {createRuntime} from './support/runtime.mjs';

test('stable category IDs accept renamed/custom categories and authoritative maps fail closed',()=>{
 const rules=defaultRules();rules.cat_trade={...structuredClone(rules.KP),name:'Trade category renamed'};
 assert.equal(priceCategoryId('WS'),'Dealers');assert.equal(checkedPriceCategory('cat_trade',rules),'cat_trade');
 for(const id of ['cat_','KP-other','__proto__',1,null])assert.equal(validPriceCategory(id),false);
 assert.throws(()=>checkedPriceCategory('cat_removed',rules));
 const p={wholesale:100,kpPrice:90,stockPickerPrices:{Dealers:95,KP:null,cat_trade:80}};
 assert.equal(projectedCategoryPrice(p,'WS'),95);assert.equal(projectedCategoryPrice(p,'cat_trade'),80);
 assert.equal(projectedCategoryPrice(p,'KP'),0);assert.equal(projectedCategoryPrice(p,'cat_removed'),0);
 assert.equal(projectedCategoryPrice({wholesale:100,kpPrice:90},'KP'),90);
 assert.equal(projectedCategoryPrice({wholesale:100,kpPrice:0},'KP'),0);
 assert.equal(projectedCategoryPrice({wholesale:100},'cat_trade'),0);
});

test('proposal, replacement and preference contracts preserve a new category ID',()=>{
 const p={articul:'001234',name:'Synthetic',stockPickerPrices:{cat_trade:80,KP:null,Dealers:100}};
 assert.equal(proposalLines([{articul:p.articul,quantity:2,price:80,special:false}],[p],'cat_trade',true)[0].price,80);
 assert.throws(()=>proposalLines([{articul:p.articul,quantity:2,price:100,special:false}],[p],'cat_trade',true));
 const input=validateStockReplacementInput({sourceArticul:'001234',qty:2,rows:[],priceMode:'cat_trade'});
 assert.equal(input.priceMode,'cat_trade');
 assert.equal(validateMemory('preferences',{priceMode:'cat_trade'}).priceMode,'cat_trade');
 assert.equal(validateMemory('cart',{'001234':{articul:'001234',qty:1,addedPrice:80,addedPriceMode:'cat_trade'}})['001234'].addedPriceMode,'cat_trade');
});

test('custom category order, public offer label and offer editing stay consistent after rename',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const res=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:res.status,data:await res.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
 try{
  await r.db.exec('reset role');
  // The migration is local test input only; this test never uses a live database.
  const installed=(await r.db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='zzws_proposals'::regclass and conname='zzws_proposals_price_mode_check'")).rows[0]?.definition||'';
  if(!installed.includes('cat_'))await r.db.exec(await fs.readFile(new URL('../supabase/migrations/20261104085417_dynamic_price_categories.sql',import.meta.url),'utf8'));
  const rules=defaultRules();rules.cat_trade={...structuredClone(rules.KP),name:'Trade category',pricing:{...rules.KP.pricing,sources:['ws'],adjustmentPercent:-20}};
  await r.db.query('update zzws_state set rules=$1,rules_revision=gen_random_uuid() where id=true',[JSON.stringify(rules)]);await r.db.exec('set role service_role');
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  const me=await ok('me',owner),catalog=await ok('catalog',owner),p=catalog.products[0],unitPrice=p.stockPickerPrices.cat_trade;
  assert.ok(unitPrice>0);assert.notEqual(unitPrice,p.wholesale);
  const order=await ok('orders',owner,{requestId:crypto.randomUUID(),priceMode:'cat_trade',profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Synthetic local test'},lines:[{articul:p.articul,qty:2,unitPrice}]});
  assert.equal(order.total,unitPrice*2);
  const context=(await r.db.query('select context from zzws_order_calculation_contexts where order_id=$1',[order.id])).rows[0].context;
  assert.equal(context.priceMode,'cat_trade');assert.equal(context.lines[0].calculation.priceCategory,'cat_trade');assert.equal(context.lines[0].priceSource,'ws');
  const offer=await ok('catalog/proposals',owner,{priceMode:'cat_trade',lines:[{articul:p.articul,quantity:2,price:unitPrice,special:false}]});
  assert.equal(offer.priceMode,'cat_trade');assert.equal((await ok('proposal/view?token='+offer.token)).priceCategoryName,'Trade category');
  const row=(await ok('catalog/proposals/mine',owner)).offers.find(item=>item.price_mode==='cat_trade');
  await ok('catalog/proposals/update',owner,{id:row.id,revision:row.revision,validDays:14,priceMode:'cat_trade',lines:row.lines});
  rules.cat_trade.name='Trade category renamed';await r.db.exec('reset role');await r.db.query('update zzws_state set rules=$1,rules_revision=gen_random_uuid() where id=true',[JSON.stringify(rules)]);await r.db.exec('set role service_role');
  assert.equal((await ok('proposal/view?token='+offer.token)).priceCategoryName,'Trade category renamed');
  assert.equal((await call('catalog/proposals',owner,{priceMode:'cat_unknown',lines:[{articul:p.articul,quantity:1,price:unitPrice,special:false}]})).status,400);
  assert.equal(r.telegramMessages.length,0);assert.equal(r.pushMessages.length,0);
 }finally{await r.close();}
});
