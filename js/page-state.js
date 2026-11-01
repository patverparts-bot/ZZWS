/* Tab-local navigation only. Products, prices and permissions always come from the server. */
(() => {
 'use strict';
 const key='zzws_page_v1',routes=['home','catalog','promo','new'],el=id=>document.getElementById(id);
 let owner=null,pending=null,ready=false,restoring=false,timer=0,epoch=0;
 const strings=v=>Array.isArray(v)?v.filter(s=>typeof s==='string').slice(0,100):[];
 function filters(value={}){value=value&&typeof value==='object'?value:{};const result={brands:strings(value.brands),categories:strings(value.categories)};for(const name of ['search','sortBy','sortPrice','sortColumn'])if(typeof value[name]==='string')result[name]=value[name].slice(0,500);for(const name of ['favOnly','promoOnly','stockOnly','wholesaleOnly'])result[name]=value[name]===true;return result;}
 function save(){
  if(!ready||!owner||serverIdentity?.id!==owner||!catalogLoaded||window.ZZWS_CATALOG_VIEW?.active())return;
  const value={version:1,owner,path:location.pathname,route:document.documentElement.dataset.storefrontPage,filters:{brands:selectedBrands,categories:selectedCategories},dealer:ZZWS_DEALER.state(),filtersOpen:!el('filtersContainer').classList.contains('hidden'),techOpen:el('dealerTechFilters').open,count:displayedCount,scrollY:window.scrollY,ui:window.ZZWS_VIEW_STATE?.capture(),storefront:window.ZZWS_STOREFRONT?.viewState?.()};
  for(const name of ['search','sortBy','sortPrice','sortColumn'])value.filters[name]=el(name==='search'?'searchInput':name).value;
  for(const [id,name]of [['favOnlyFilter','favOnly'],['promoOnlyFilter','promoOnly'],['stockOnlyFilter','stockOnly'],['wholesaleOnlyFilter','wholesaleOnly']])value.filters[name]=el(id).checked;
  value.overlay=!el('cabinetModal').classList.contains('hidden')?'orders':!el('orderModal').classList.contains('hidden')?'cart':null;
  if(value.overlay==='orders')value.orders=window.ZZWS_ORDERS?.viewState?.();if(value.overlay==='cart')value.checkout=window.ZZWS_CHECKOUT?.viewState?.();
  value.dealerPanel=window.ZZWS_DEALER?.viewState?.();value.guide=window.ZZWS_USER_GUIDE?.viewState?.();value.assistant=window.ZZWS_ASSISTANT?.viewState?.();value.contextHelp=window.ZZWS_CONTEXT_HELP?.viewState?.();
  const bulletin=window.ZZWS_BULLETINS?.state();if(bulletin){value.overlay='bulletins';value.bulletin=bulletin;}
  const technical=window.ZZWS_PRODUCT_TECHNICAL?.state();if(technical){value.overlay='technical';value.technical=technical;}
  try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(save,80);}
 function start(user){++epoch;owner=user.id;ready=false;pending=null;restoring=false;try{const value=JSON.parse(sessionStorage.getItem(key)||'null');if(value?.version===1&&value.owner===owner&&value.path===location.pathname&&routes.includes(value.route))pending=value;else sessionStorage.removeItem(key);}catch{}const hash=location.hash.slice(1);if(pending&&routes.includes(hash)&&hash!==pending.route)pending=null;}
 function restoreFilters(){if(pending){catalogFiltersForOpening=filters(pending.filters);ZZWS_DEALER.restoreState(pending.dealer);}if(document.documentElement.dataset.storefrontPage==='promo'){el('promoOnlyFilter').checked=true;if(catalogFiltersForOpening)catalogFiltersForOpening.promoOnly=true;}}
 async function loaded(){
  if(!owner||ready||restoring||!catalogLoaded)return;restoring=true;const ticket=epoch,state=pending;pending=null;
  try{if(state){
   toggleMobileFilters(state.filtersOpen===true);el('dealerTechFilters').open=state.techOpen===true;
   const target=Math.min(5000,Number(state.count)||0,filteredProducts.length);for(let i=0;i<150&&ticket===epoch&&displayedCount<target;i++){loadMoreProducts();await new Promise(r=>setTimeout(r,35));}if(ticket!==epoch)return;
   if(state.overlay==='orders'){openPersonalCabinet();await window.ZZWS_ORDERS?.restoreView?.(state.orders);}
   else if(state.overlay==='cart'){openOrderModal();window.ZZWS_CHECKOUT?.restoreView?.(state.checkout);}
   else if(state.overlay==='bulletins')await window.ZZWS_BULLETINS?.restore(state.bulletin);
   else if(state.overlay==='technical'){if(state.bulletin)await window.ZZWS_BULLETINS?.restore(state.bulletin);await window.ZZWS_PRODUCT_TECHNICAL?.restore(state.technical);}
   if(state.dealerPanel)await window.ZZWS_DEALER?.restoreView?.(state.dealerPanel);
   window.ZZWS_STOREFRONT?.restoreView?.(state.storefront);await window.ZZWS_USER_GUIDE?.restoreView?.(state.guide);window.ZZWS_ASSISTANT?.restoreView?.(state.assistant);await window.ZZWS_CONTEXT_HELP?.restoreView?.(state.contextHelp);
   await window.ZZWS_VIEW_STATE?.restore(state.ui);if(ticket!==epoch)return;window.scrollTo({top:Math.max(0,Math.min(1000000,Number(state.scrollY)||0)),behavior:'instant'});
  }}finally{if(ticket===epoch){restoring=false;ready=true;save();}}
 }
 function stop(){++epoch;clearTimeout(timer);if(owner)history.replaceState(history.state,'','#home');owner=null;pending=null;ready=false;restoring=false;try{sessionStorage.removeItem(key);}catch{}}
 window.ZZWS_PAGE_STATE={get ready(){return ready;},start,restoreFilters,loaded,save,stop,route:()=>pending?.route||(routes.includes(location.hash.slice(1))?location.hash.slice(1):'home')};
 history.scrollRestoration='manual';for(const event of ['input','change','click','toggle'])document.addEventListener(event,schedule,true);document.addEventListener('scroll',schedule,{capture:true,passive:true});window.addEventListener('pagehide',()=>{if(catalogLoaded&&!restoring)ready=true;save();});document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
})();
