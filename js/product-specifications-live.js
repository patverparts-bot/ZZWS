/* Consume saved, authorized specifications. Provider refreshes run only from the administrator action. */
(() => {
 'use strict';
 const interval=60000,compact=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 let owner='',items=new Map(),revision='',signature='',epoch=0,lastAttempt=-Infinity,inflight=null,controller=null,timer=null;
 function context(){
  try{return typeof serverIdentity!=='undefined'&&serverIdentity?.id&&sessionStorage.getItem('zzws_session_v3')?JSON.stringify([serverIdentity.id,sessionStorage.getItem('zzws_session_v3'),window.ZZWS_CATALOG_VIEW?.key()||'']):'';}catch{return '';}
 }
 function clear(next=''){
  ++epoch;controller?.abort();controller=null;inflight=null;clearTimeout(timer);timer=null;
  owner=next;items=new Map();revision=signature='';lastAttempt=-Infinity;
 }
 function synchronize(){const next=context();if(next===owner)return false;clear(next);return true;}
 function active(){return !!owner&&typeof catalogLoaded!=='undefined'&&catalogLoaded&&!document.hidden&&!document.getElementById('mainApp')?.classList.contains('hidden');}
 function product(code){return typeof getProduct==='function'?getProduct(code):null;}
 function lookup(articul,name){
  synchronize();const code=String(articul??'').trim(),current=product(code);
  if(!owner||typeof catalogLoaded==='undefined'||!catalogLoaded||!current||!items.has(code))return {known:false,row:null};
  const row=items.get(code),expected=compact(name);
  return {known:true,row:expected&&expected===compact(current.name)&&expected===compact(row[0])?row:null};
 }
 function warranty(articul,name){
  const result=lookup(articul,name);if(!result.known)return {known:false,months:null};
  if(!result.row)return {known:true,months:null};
  const facts=result.row[3].filter(([label])=>/^(?:Երաշխիք|Warranty|Гарантия)$/iu.test(String(window.ZZWS_ARMENIAN_SPECS?.label(label)||label).trim()));
  const match=facts.length===1?/^\s*(\d+)\s*(?:ամիս|months?|мес\.?|месяц(?:а|ев)?)\s*$/iu.exec(String(facts[0][1])):null;
  const value=match?Number(match[1]):0;return {known:true,months:Number.isSafeInteger(value)&&value>0?value:null};
 }
 function technical(articul,name){
  const result=lookup(articul,name);if(!result.row)return result;
  const row=result.row;return {known:true,row:[row[0],row[1],row[2],row[3].map(([label,value])=>[window.ZZWS_ARMENIAN_SPECS?.label(label)||label,window.ZZWS_ARMENIAN_SPECS?.value(value)||String(value)])]};
 }
 function updateStamps(){
  const api=window.ZZWS_PRODUCT_WARRANTY;if(!api)return;
  for(const target of document.querySelectorAll('.sf-product-photo > .product-img-container[data-product-technical], .desktop-photo-preview[data-product-technical], .product-technical-photo[data-product-technical]')){
   const code=target.dataset.productTechnical,name=target.dataset.productName,previous=target.querySelector('.product-warranty-stamp'),value=api.months(code,name);
   if(value==null){previous?.remove();continue;}
   if(previous&&Number(previous.dataset.warrantyMonths)===value)continue;
   previous?.remove();target.insertAdjacentHTML('beforeend',api.html(code,name));
  }
 }
 function sanitize(payload){
  if(!payload||!payload.items||typeof payload.items!=='object'||Array.isArray(payload.items))throw Error('Invalid saved specification response');
  const next=new Map();
  for(const [code,row]of Object.entries(payload.items)){
   if(!product(code)||!Array.isArray(row)||typeof row[0]!=='string'||!row[0].trim()||typeof row[1]!=='string'||typeof row[2]!=='string'||!Array.isArray(row[3]))continue;
   if(!row[3].every(fact=>Array.isArray(fact)&&typeof fact[0]==='string'&&['string','number','boolean'].includes(typeof fact[1])))continue;
   next.set(code,[row[0],row[1],row[2],row[3].map(([label,value])=>[label,String(value)])]);
  }
  return next;
 }
 async function refresh(options={}){
  const changed=synchronize();if(changed)updateStamps();if(!active()||!window.ZZWS?.json)return false;
  if(inflight)return inflight;if(!options.force&&Date.now()-lastAttempt<interval)return false;
  lastAttempt=Date.now();const ticket=epoch,identity=owner,abort=new AbortController();controller=abort;
  const timeout=setTimeout(()=>abort.abort(),20000);
  const pending=(async()=>{
   try{
    const payload=await window.ZZWS.json('catalog/product-specifications'+(revision?'?revision='+encodeURIComponent(revision):''),{method:'GET',signal:abort.signal});
    if(ticket!==epoch||identity!==context())return false;
    if(payload?.unchanged===true&&revision&&String(payload.revision??'')===revision)return true;
    const next=sanitize(payload),stamp=JSON.stringify([...next]);
    revision=typeof payload.revision==='string'||typeof payload.revision==='number'?String(payload.revision):'';
    if(stamp===signature)return true;
    const articuls=[...new Set([...items.keys(),...next.keys()])].filter(code=>JSON.stringify(items.get(code))!==JSON.stringify(next.get(code)));
    items=next;signature=stamp;updateStamps();
    window.dispatchEvent(new CustomEvent('zzws:product-specificationschange',{detail:{revision,articuls}}));return true;
   }catch{return false;}
   finally{clearTimeout(timeout);if(ticket===epoch){inflight=null;controller=null;}}
  })();inflight=pending;return pending;
 }
 function schedule(){clearTimeout(timer);timer=null;if(active())timer=setTimeout(tick,Math.max(1000,interval-(Date.now()-lastAttempt)));}
 function tick(){const changed=synchronize();if(changed)updateStamps();if(!active()){clearTimeout(timer);timer=null;return;}refresh().finally(schedule);}
 window.ZZWS_PRODUCT_SPECIFICATIONS_LIVE=Object.freeze({lookup,warranty,technical,refresh,loaded(){revision=signature='';tick();},reset:()=>clear(),state:()=>{synchronize();return {revision,count:items.size};}});
 window.addEventListener('zzws:product-specificationschange',()=>{window.ZZWS_DEALER?.refresh();});
 document.addEventListener('visibilitychange',tick);
 const app=document.getElementById('mainApp');if(app)new MutationObserver(tick).observe(app,{attributes:true,attributeFilter:['class']});
 new MutationObserver(tick).observe(document.documentElement,{attributes:true,attributeFilter:['data-dealer-view','data-storefront-page']});
 setTimeout(tick,0);
})();
