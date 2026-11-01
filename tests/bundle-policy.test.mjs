import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(fs.readFileSync('js/bundle-policy.js','utf8'),context);const policy=context.window.ZZWS_BUNDLE_POLICY;
const p=(articul,category,name=articul)=>({articul,category,name});
const oven=p('5202639','Ներկառուցվող վառարաններ','Bosch HJA737BR0'),hob=p('5202997','Ներկառուցվող (Գազօջախներ)','Bosch PXX695HC1E'),hood=p('8400591','Ներկառուցվող օդաքարշ պահարաններ','Bosch DFT63CA50Q'),air=p('6104191','Ճարպաջեռոց օդային','Philips NA350/00 Dual Basket Airfryer 3000 Series');
test('actual catalogue kitchen categories distinguish built-in ovens, cooking hobs and all three hood categories',()=>{
 assert.equal(policy.type(oven,{type:'oven'}),'oven');assert.equal(policy.type(hob,{type:'other'}),'hob');assert.equal(policy.type(hood,{type:'other'}),'hood');
 for(const category of ['Ծխնելուզային օդաքարշ պահարաններ','Կղզյակային օդաքարշ պահարաններ'])assert.equal(policy.type(p('hood',category),{type:'other'}),'hood');
});
test('legacy oven facts cannot admit air fryers, microwaves, stoves, mini ovens, accessories or ambiguous products',()=>{
 for(const product of [air,p('mw','Ներկառուցվող միկրոալիքային վառարաններ','Bosch BFL524MB2'),p('stove','Համակցված գազօջախներ','Bosch HXC39AG51Q'),p('mini','Մինի վառարաններ','Tefal OF444834'),p('pizza','Պիցցայի վառարան','Kenwood KPO10.000GY Pizza Oven'),p('dish','Ջեռոցի տարաներ'),p('cleaner','Մաքրող միջոցներ','Bosch Hob detergent'),p('unknown','Other','Oven model'),p('generic','Ovens','Electric oven')])assert.equal(policy.type(product,{type:'oven',verified:true}),'other',product.articul);
 assert.equal(policy.type({...oven,name:'Air fryer'},{type:'oven',verified:true}),'other');assert.equal(policy.type(oven,{type:'microwave',verified:true}),'other');assert.equal(policy.type(hob,{type:'hob',verified:true,installation:'Freestanding'}),'other');
});
test('generic oven or hob categories require verified built-in installation; dimensions never substitute for it',()=>{
 for(const [category,type]of [['Ovens','oven'],['Hobs','hob']]){
  const product=p(type,category);
  assert.equal(policy.type(product,{type,verified:true,installation:'Built-in'}),type);
  for(const facts of [{type,verified:false,installation:'Built-in'},{type,verified:true,installation:null},{type,verified:true,dimensions:{width:60,height:60,depth:56}},{type,verified:true,installation:'Independent'}])assert.equal(policy.type(product,facts),'other');
 }
});
test('slot validation fails closed for wrong types, duplicates, unknown SKUs, extra rows and arbitrary recipe names',()=>{
 const lookup=id=>[oven,hob,hood,air].find(p=>p.articul===id),facts=()=>({type:'other'}),entries=[oven,hob,hood].map((p,i)=>({articul:p.articul,type:['oven','hob','hood'][i]}));
 assert.equal(JSON.stringify(policy.slots('kitchen',entries,lookup,facts)),JSON.stringify({oven:oven.articul,hob:hob.articul,hood:hood.articul}));
 for(const rows of [[air,hob,hood],[oven,oven,hood],[oven,hob],[oven,hob,hood,air],[{articul:'unknown'},hob,hood],[{articul:oven.articul,type:'hob'},hob,hood]])assert.equal(policy.slots('kitchen',rows,lookup,facts),null);
 for(const recipe of ['unknown','constructor','__proto__'])assert.equal(policy.slots(recipe,entries,lookup,facts),null);
});
test('typed and legacy saved bundles are reclassified from current products and their marker survives normal memory normalization',async()=>{
 const {validateMemory}=await import('../supabase/functions/zzws-api/memory.mjs');let products=[oven,hob,hood,air];const lookup=id=>products.find(p=>p.articul===id),facts=()=>({type:'other'}),items=[oven,hob,hood].map(p=>({articul:p.articul,qty:1,sale:100}));
 const offer={id:'bundle:kitchen:fixture',title:'Fixture',items,bundleSale:null};const normalized=validateMemory('preferences',{dealerOffers:[offer]}).dealerOffers[0];assert.equal(normalized.id,offer.id);assert.equal(policy.offer(normalized,lookup,facts).valid,true);
 assert.equal(policy.offer({...offer,id:'legacy',bundleSale:300},lookup,facts).valid,true);assert.equal(policy.offer({...offer,id:'bundle:constructor:bad'},lookup,facts).valid,false);
 products=[{...oven,category:air.category,name:air.name},hob,hood,air];assert.equal(policy.offer(normalized,lookup,facts).valid,false);assert.equal(policy.offer({...offer,id:'legacy',bundleSale:300},lookup,facts).valid,false);
 assert.equal(policy.offer({id:'ordinary',items:[air],bundleSale:null},lookup,facts).marked,false);
});
test('model/SKU searches are case-insensitive, tolerate model punctuation and never manufacture unmatched products',()=>{
 const products=[oven,hob,hood];assert.deepEqual([...policy.search(products,'5202997')].map(p=>p.articul),[hob.articul]);assert.deepEqual([...policy.search(products,'PXX 695-HC1E')].map(p=>p.articul),[hob.articul]);assert.deepEqual([...policy.search(products,'hja737br0')].map(p=>p.articul),[oven.articul]);assert.equal(policy.search(products,'NA350/00').length,0);assert.equal(policy.search(products,'<img src=x onerror=alert(1)>').length,0);
});
