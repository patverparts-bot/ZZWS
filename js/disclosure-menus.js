/* Only popover menus close outside; content disclosures and working dialogs stay open. */
(() => {
 'use strict';
 const menus='details[data-disclosure-menu],#storefrontAccount,#storefrontTools,#adminMoreMenu,.catalog-columns,.dealer-advanced-tools';
 const pickers=[['brandDropdown','brandInput','clearBrandBtn'],['categoryDropdown','categoryInput','clearCategoryBtn']];
 const within=(event,node)=>node&&(event.composedPath?.().includes(node)||node.contains(event.target));
 const openedAt=new WeakMap(),position=()=>({x:window.scrollX,y:window.scrollY});
 const modalOrder=new WeakMap();let modalSequence=0,visibleModals=new Set(),lockedPosition=null,activeModal=null,touch=null;
 const lockStyle=document.createElement('style');lockStyle.textContent='html.zzws-modal-scroll-lock,html.zzws-modal-scroll-lock body{overflow:hidden!important;overscroll-behavior:none}';document.head.append(lockStyle);
 function close(exceptWithin=null){for(const menu of document.querySelectorAll(menus))if(menu.open&&!exceptWithin?.contains(menu))menu.open=false;for(const ids of pickers){const panel=document.getElementById(ids[0]);if(panel&&!panel.classList.contains('hidden')&&!exceptWithin?.contains(panel))panel.classList.add('hidden');}}
 function syncModal(){
  const visible=[...document.querySelectorAll('dialog[open],[aria-modal="true"]')].filter(node=>!node.hidden&&!node.classList.contains('hidden')&&node.getClientRects().length&&(node.tagName!=='DIALOG'||node.open));
  for(const node of visible)if(!visibleModals.has(node)&&!modalOrder.has(node))modalOrder.set(node,++modalSequence);
  visibleModals=new Set(visible);
  // Browser top-layer dialogs outrank every ordinary z-index. Custom overlays
  // retain their CSS hierarchy (bulk above checkout), including equal-layer DOM order.
  const topLayer=visible.filter(node=>{if(node.tagName!=='DIALOG')return false;try{return node.matches(':modal');}catch{return node.open;}});
  const layer=node=>{let z=0;for(let current=node;current;current=current.parentElement){const value=Number.parseInt(getComputedStyle(current).zIndex,10);if(Number.isFinite(value))z=value;}return z;};
  const painted=visible.map((node,index)=>({node,index,z:layer(node)})).sort((a,b)=>b.z-a.z||b.index-a.index);
  activeModal=topLayer.sort((a,b)=>modalOrder.get(b)-modalOrder.get(a))[0]||painted[0]?.node||null;
  if(activeModal){if(!lockedPosition)lockedPosition=position();if(!document.documentElement.classList.contains('zzws-modal-scroll-lock'))document.documentElement.classList.add('zzws-modal-scroll-lock');close(activeModal);}
  else if(lockedPosition){const previous=lockedPosition;lockedPosition=null;document.documentElement.classList.remove('zzws-modal-scroll-lock');if(window.scrollX!==previous.x||window.scrollY!==previous.y)window.scrollTo(previous.x,previous.y);}
  return activeModal;
 }
 // Startup restoration owns the saved background position. Its modal may have
 // opened before that position was applied, so retain the final clamped result.
 function restorePosition(point){syncModal();window.scrollTo({left:Math.max(0,Math.min(1000000,Number(point?.x)||0)),top:Math.max(0,Math.min(1000000,Number(point?.y)||0)),behavior:'instant'});if(activeModal)lockedPosition=position();}
 // Keep a wheel/touch gesture inside the top working dialog, including when
 // its own scroller reaches an edge. Never pass that gesture to a parent dialog.
 function scrollable(event,dx,dy,active){
  if(!within(event,active))return false;const horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy;if(!delta)return true;
  for(let node=event.target.nodeType===1?event.target:event.target.parentElement;node;node=node.parentElement){
   const style=getComputedStyle(node),overflow=horizontal?style.overflowX:style.overflowY,offset=horizontal?node.scrollLeft:node.scrollTop,range=horizontal?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight;
   if(/auto|scroll/.test(overflow)&&range>1&&(delta<0?offset>0:offset<range-1))return true;
   if(node===active)break;
  }
  return false;
 }
 document.addEventListener('wheel',event=>{const active=syncModal();if(active&&!event.ctrlKey&&!scrollable(event,event.deltaX,event.deltaY,active))event.preventDefault();},{capture:true,passive:false});
 document.addEventListener('touchstart',event=>{touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{capture:true,passive:true});
 document.addEventListener('touchmove',event=>{if(!touch||event.touches.length!==1)return;const point=event.touches[0],dx=touch.x-point.clientX,dy=touch.y-point.clientY;touch={x:point.clientX,y:point.clientY};const active=syncModal();if(active&&!scrollable(event,dx,dy,active))event.preventDefault();},{capture:true,passive:false});
 document.addEventListener('touchend',()=>{touch=null;},{capture:true,passive:true});
 new MutationObserver(records=>{
  for(const record of records)if(record.type==='attributes'&&record.attributeName==='open'&&record.target.open){if(record.target.matches(menus))openedAt.set(record.target,position());if(record.target.matches('dialog'))modalOrder.set(record.target,++modalSequence);}
  syncModal();
 }).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','hidden','aria-hidden','aria-modal','style']});
 syncModal();
 document.addEventListener('scroll',event=>{
  const current=position(),page=event.target===document||event.target===document.documentElement||event.target===document.body;
  for(const menu of document.querySelectorAll(menus)){if(!menu.open||within(event,menu))continue;const origin=openedAt.get(menu);if(page&&origin&&origin.x===current.x&&origin.y===current.y)continue;menu.open=false;}
  for(const ids of pickers)if(!ids.some(id=>within(event,document.getElementById(id))))document.getElementById(ids[0])?.classList.add('hidden');
 },{capture:true,passive:true});
 window.ZZWS_DISCLOSURE_MENUS=Object.freeze({close,restorePosition});
 const outside=event=>{
  for(const menu of document.querySelectorAll(menus))if(menu.open&&!within(event,menu))menu.open=false;
  for(const ids of pickers)if(!ids.some(id=>within(event,document.getElementById(id))))document.getElementById(ids[0])?.classList.add('hidden');
 };
 document.addEventListener('pointerdown',outside,true);
 document.addEventListener('click',outside,true);
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  for(const ids of pickers){const input=document.getElementById(ids[1]),panel=document.getElementById(ids[0]);if(panel&&!panel.classList.contains('hidden')&&ids.some(id=>within(event,document.getElementById(id)))){panel.classList.add('hidden');input?.focus({preventScroll:true});event.preventDefault();event.stopPropagation();return;}}
  const active=event.target.closest?.(menus);if(active?.open){active.open=false;active.querySelector(':scope > summary')?.focus({preventScroll:true});event.preventDefault();event.stopPropagation();}
 },true);
})();
