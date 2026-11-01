// Bundle slots use positive appliance evidence; names and legacy "oven" facts
// never turn an air fryer, microwave, accessory or freestanding stove into one.
(() => {
 'use strict';
 const recipes={kitchen:['oven','hob','hood'],laundry:['washer','dryer'],entertainment:['tv','soundbar']};
 const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim();
 const exact=values=>new Set(values.map(norm));
 const categories={
  oven:exact(['Ներկառուցվող վառարաններ','Built-in ovens','Built in ovens','Встраиваемые духовые шкафы','Встраиваемые духовки']),
  hob:exact(['Ներկառուցվող (Գազօջախներ)','Ներկառուցվող եփման վահանակներ','Built-in hobs','Built in hobs','Built-in cooktops','Встраиваемые варочные панели']),
  hood:exact(['Ներկառուցվող օդաքարշ պահարաններ','Ծխնելուզային օդաքարշ պահարաններ','Կղզյակային օդաքարշ պահարաններ','Cooker hoods','Kitchen hoods','Built-in cooker hoods','Вытяжки','Кухонные вытяжки'])
 };
 const generic={oven:exact(['Ovens','Oven','Духовые шкафы','Духовки','Ջեռոցներ','Վառարաններ']),hob:exact(['Hobs','Hob','Cooktops','Cooking hobs','Варочные панели','Եփման վահանակներ','Եփման մակերեսներ'])};
 const builtIn=exact(['built-in','built in','builtin','ներկառուցվող','встраиваемый','встраиваемая','встраиваемое']);
 const freeStanding=/free[ -]?standing|counter[ -]?top|table[ -]?top|portable|отдельностоя|настольн|առանձին կանգնած|անկախ տեղադրմամբ/i;
 const excluded=/air[ -]?fry|airfryer|аэрофрит|аэрогрил|օդային|microwave|микроволн|միկրոալիք|mini[ -]?oven|мини[ -]?печ|մինի վառարան|pizza oven|պիցցայի վառարան|accessor|аксессуар|պարագա|աքսեսուար|cleaner|detergent|մաքրող|adapter|ադապտեր|oven gloves|ջեռոցի տարաներ/i;
 function kitchenType(product,facts){
  if(!product||typeof product!=='object')return 'other';
  const category=norm(product.category),name=norm(product.name);
  if(!category||excluded.test(category+' '+name)||freeStanding.test(category+' '+name))return 'other';
  const type=['oven','hob','hood'].find(type=>categories[type].has(category));
  const verified=facts?.verified===true;
  if(verified&&freeStanding.test(String(facts.installation||'')))return 'other';
  if(type){
   if(verified&&facts.type&&facts.type!=='other'&&facts.type!==type)return 'other';
   return type;
  }
  // Generic categories need an independently verified built-in installation.
  for(const candidate of ['oven','hob'])if(generic[candidate].has(category)&&verified&&facts.type===candidate&&builtIn.has(norm(facts.installation)))return candidate;
  return 'other';
 }
 function type(product,facts){
  if(!product||typeof product!=='object')return 'other';
  const kitchen=kitchenType(product,facts);if(kitchen!=='other')return kitchen;
  return ['washer','dryer','tv','soundbar'].includes(facts?.type)?facts.type:'other';
 }
 function slots(recipe,entries,lookup,factLookup){
  const expected=Object.hasOwn(recipes,recipe)?recipes[recipe]:null;if(!expected||!Array.isArray(entries)||entries.length!==expected.length)return null;
  const result={},seen=new Set();
  for(const entry of entries){
   const id=typeof entry==='string'?entry:entry?.articul;if(typeof id!=='string'||!id||seen.has(id))return null;
   const product=lookup(id);if(!product||product.articul!==id)return null;
   const actual=type(product,factLookup(id));if(!expected.includes(actual)||Object.hasOwn(result,actual))return null;
   if(entry&&typeof entry==='object'&&entry.type!=null&&entry.type!==actual)return null;
   seen.add(id);result[actual]=id;
  }
  return expected.every(type=>Object.hasOwn(result,type))?result:null;
 }
 function infer(entries,lookup,factLookup){for(const recipe of Object.keys(recipes)){const value=slots(recipe,entries,lookup,factLookup);if(value)return {recipe,slots:value};}return null;}
 function offer(offer,lookup,factLookup){
  const id=typeof offer?.id==='string'?offer.id:'';
  if(id.startsWith('bundle:')){const recipe=id.split(':')[1],value=slots(recipe,offer.items,lookup,factLookup);return {marked:true,valid:!!value,recipe,slots:value};}
  if(offer?.bundleSale!=null){const inferred=infer(offer.items,lookup,factLookup);return {marked:true,valid:!!inferred,...inferred};}
  return {marked:false,valid:true};
 }
 function search(products,query){
  const term=norm(query),compact=term.replace(/[^\p{L}\p{N}]/gu,'');
  return products.filter(p=>!term||norm(p.articul+' '+p.name).includes(term)||compact.length>1&&norm(p.articul+' '+p.name).replace(/[^\p{L}\p{N}]/gu,'').includes(compact));
 }
 window.ZZWS_BUNDLE_POLICY=Object.freeze({kitchenType,type,slots,infer,offer,search,recipes});
})();
