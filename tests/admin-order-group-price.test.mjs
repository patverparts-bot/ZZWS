import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';

const apiRoot=path.resolve(process.env.ZZWS_API_SOURCE_ROOT||'supabase/functions/zzws-api');
const {project}=await import(pathToFileURL(path.join(apiRoot,'catalog.mjs')));
const {defaultRules}=await import(pathToFileURL(path.join(apiRoot,'rules.mjs')));
const {normalizeLines,totalOf}=await import(pathToFileURL(path.join(apiRoot,'orders.mjs')));
const {buildOrderContext}=await import(pathToFileURL(path.join(apiRoot,'order-context.mjs')));
const frontend=fs.readFileSync(path.join(process.env.ZZWS_STATIC_OVERLAY||'.','js/order-state.js'),'utf8');
const admin={role:'admin',sheet:'Dealers',client:'Synthetic company',profileRevision:1};
const raw=(overrides={})=>({articul:'10001',name:'Synthetic model',brand:'Example',category:'Accessories',retail:1000,base:1000,stocks:{'003':10},ws:80,kp:90,kpPromo:110,...overrides});

function basket(products,{mode='KP',isAdmin=true,proposal=null,assisted=null,rules=defaultRules()}={}){
 const registry={
  choices:()=>Object.entries(rules).map(([id,r])=>({id,label:r.name||({KP:'Խոշոր գործընկերներ',Dealers:'Մեծածախ'}[id]||id)})),
  normalize:value=>value==='WS'?'Dealers':Object.hasOwn(rules,value)?value:'Dealers',
  label:value=>registry.choices().find(c=>c.id===registry.normalize(value)).label
 };
 const context={window:{ZZWS_PROPOSAL_CART:{price:()=>proposal},ZZWS_ASSISTED:{active:()=>assisted!==null},ZZWS_PRICE_CATEGORIES:registry},ZZWS_PRICE_CATEGORIES:registry,ZZWS_ASSISTED:{price:()=>assisted},document:{getElementById:()=>({addEventListener(){}})},productIndex:new Map(products.map(p=>[p.articul,p])),adminOrderPriceMode:mode,isAdminUser:()=>isAdmin};
 vm.createContext(context);vm.runInContext(frontend,context);
 const price=item=>context.getItemWholesalePrice(item);price.label=()=>context.getOrderPriceLabel();price.normalizeCart=value=>context.normalizeCart(value);return price;
}

function catalog(products,rules=defaultRules()){
 return {id:'fixture-catalog',rulesRevision:'fixture-rules',warehouseRevision:'fixture-warehouses',products,rules,mainWarehouses:['003']};
}

function agree(products,rules,expected,{mode='KP',quantities=products.map(()=>1)}={}){
 const source=catalog(products,rules),projected=project(products,admin,rules,{forOrder:true}),before=JSON.stringify(projected),price=basket(projected,{mode,rules});
 assert.deepEqual(projected.map(p=>price({articul:p.articul})),expected);
 if(expected.some(p=>p<=0)){
  assert.throws(()=>normalizeLines(products.map(p=>({articul:p.articul,qty:1,unitPrice:1})),projected,[],false,mode),/Հասանելի գին չկա/);
  const context=buildOrderContext({catalog:source,user:admin,lines:products.map(p=>({articul:p.articul,qty:1,unitPrice:1})),priceMode:mode,source:'manual'});
  assert.deepEqual(context.lines.map(l=>l.catalogUnitPrice),expected.map(p=>p>0?p:null),'Evidence must not claim a configured unavailable price as an eligible catalogue price');
  return {projected};
 }
 const lines=normalizeLines(products.map((p,i)=>({articul:p.articul,qty:quantities[i],unitPrice:1})),projected,[],false,mode);
 assert.deepEqual(lines.map(l=>l.unitPrice),expected,'Server recomputes the same group price rather than accepting the submitted price');
 const context=buildOrderContext({catalog:source,user:admin,lines,priceMode:mode});
 assert.deepEqual(context.lines.map(l=>l.catalogUnitPrice),expected);
 const category=mode==='WS'?'Dealers':mode;
 for(const line of context.lines){assert.equal(line.calculation.priceCategory,category);assert.deepEqual(line.calculation.policy,rules[category].pricing,'Evidence records the full group policy, including adjustment and rounding');}
 assert.equal(context.orderTotal,totalOf(lines));
 assert.equal(JSON.stringify(projected),before,'Reading basket prices must not overwrite the independent raw catalogue prices');
 return {projected,lines,context};
}

test('Admin basket, normalized order and calculation evidence agree on WS fallback for the reported products',()=>{
 const products=[['686626',15400,19900],['686629',5100,6700],['6866301',2700,3900]].map(([articul,ws,retail])=>raw({articul,ws,retail,kp:0,kpPromo:0}));
 const {projected,lines,context}=agree(products,defaultRules(),[15400,5100,2700],{quantities:[1,3,1]});
 assert.deepEqual(projected.map(p=>p.kpPrice),[0,0,0],'Raw KP display continues to indicate the missing source column');
 assert.deepEqual(context.lines.map(l=>l.priceSource),['ws','ws','ws']);
 assert.deepEqual(context.lines.map(l=>l.calculation.sourceValue),[15400,5100,2700]);
 assert.equal(totalOf(lines),33400);
});

test('Admin KP follows the configured priority, minimum/maximum, adjustment and rounding',()=>{
 for(const [pricing,expected,source]of [
  [{sources:['ws','kp'],mode:'first'},80,'ws'],
  [{sources:['kpPromo','kp','ws'],mode:'min'},80,'ws'],
  [{sources:['kp','ws'],mode:'max',adjustmentPercent:10,roundTo:10},100,'kp'],
  [{sources:['kpPromo','kp','ws'],mode:'first'},110,'kpPromo']
 ]){
  const rules=defaultRules();Object.assign(rules.KP.pricing,pricing);
  const {context}=agree([raw()],rules,[expected]);
  assert.equal(context.lines[0].priceSource,source);
  assert.deepEqual(context.rulesSnapshot.KP.pricing,rules.KP.pricing);
 }
});

test('Explicit unavailable group price does not fall back outside its sources or bypass the retail ceiling',()=>{
 const onlyKP=defaultRules();onlyKP.KP.pricing.sources=['kp'];
 agree([raw({kp:0,kpPromo:0})],onlyKP,[0]);
 agree([raw({kp:1500})],onlyKP,[0]);
 agree([raw({ws:0,kp:0,kpPromo:0})],defaultRules(),[0]);
});

test('Old catalogue DTOs retain their raw KP price while an explicit null resolved price remains unavailable',()=>{
 const legacy={articul:'10001',name:'Legacy model',wholesale:100,kpPrice:70};
 assert.equal(basket([legacy])({articul:'10001'}),70);
 assert.equal(normalizeLines([{articul:'10001',qty:1}],[legacy],[],false,'KP')[0].unitPrice,70);
 const denied={...legacy,stockPickerPrices:{KP:null}};
 assert.equal(basket([denied])({articul:'10001'}),0);
 assert.throws(()=>normalizeLines([{articul:'10001',qty:1}],[denied],[],false,'KP'),/Հասանելի գին չկա/);
});

test('WS alias follows Dealers group; legacy DTO, client, assisted buyer and proposal prices keep their own precedence',()=>{
 const rules=defaultRules();Object.assign(rules.Dealers.pricing,{adjustmentPercent:-10});
 const products=[raw({ws:100,kp:0,kpPromo:0})];
 const {projected}=agree(products,rules,[90],{mode:'WS'});
 assert.equal(projected[0].stockPickerPrices.Dealers,90);
 assert.equal(projected[0].wholesale,100,'Group selection does not overwrite the independent raw wholesale display');
 const legacy={articul:'10001',name:'Legacy model',wholesale:100,kpPrice:70};
 assert.equal(basket([legacy],{mode:'WS'})({articul:'10001'}),100);
 const client=project(products,{role:'client',sheet:'KP',client:'Synthetic buyer',allBrands:true},rules,{forOrder:true});
 assert.equal(client[0].stockPickerPrices,undefined);
 assert.equal(basket(client,{isAdmin:false})({articul:'10001'}),100);
 assert.equal(basket(projected,{proposal:31,assisted:41})({articul:'10001'}),31);
 assert.equal(basket(projected,{assisted:41})({articul:'10001'}),41);
});

test('A custom category controls administrator basket and server prices while its renamed label remains literal data',()=>{
 const rules=defaultRules(),category='cat_partner',name='<img src=x onerror=alert(1)> գործընկերներ';
 rules[category]={...structuredClone(rules.KP),name,pricing:{...rules.KP.pricing,sources:['ws','kp'],mode:'min',adjustmentPercent:-20,roundTo:1}};
 const products=[raw()],{projected,context}=agree(products,rules,[64],{mode:category});
 assert.equal(context.lines[0].priceSource,'ws');
 assert.equal(context.lines[0].calculation.sourceValue,80);
 const price=basket(projected,{mode:category,rules});
 assert.ok(price.label().includes(name),'Visible category name is supplied as data instead of reducing all non-KP choices to wholesale');
 const saved=price.normalizeCart({'10001':{articul:'10001',qty:2,addedPrice:64,addedPriceMode:category}});
 assert.equal(saved['10001'].addedPriceMode,category,'Saved cart retains the stable category ID');
 rules[category].name='Նոր անուն · Renamed partners';
 assert.ok(price.label().includes(rules[category].name));
 assert.equal(price({articul:'10001'}),64,'Rename does not change category identity or price');
});

test('Submission calculation evidence rejects the former raw KP amount when the group chooses a different price',()=>{
 const rules=defaultRules();rules.KP.pricing.sources=['ws','kp'];
 const source=catalog([raw()],rules),line={articul:'10001',name:'Synthetic model',brand:'Example',category:'Accessories',qty:1,unitPrice:90};
 assert.throws(()=>buildOrderContext({catalog:source,user:admin,lines:[line],priceMode:'KP'}),/Հաշվարկված գինը չի համընկնում պատվերի գնին/);
});
