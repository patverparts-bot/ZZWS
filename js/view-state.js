/* Tab-local UI positions only: never cache prices, orders, credentials or file contents. */
(() => {
 'use strict';
 const escape=value=>CSS.escape(String(value)),attrs=['data-order-id','data-manager-order','data-storefront-sku','data-history-id','data-offer-id'];
 function key(node){
  if(!node||node.nodeType!==1)return null;if(node.id)return '#'+escape(node.id);
  for(const attr of attrs)if(node.hasAttribute(attr))return '['+attr+'="'+escape(node.getAttribute(attr))+'"]';
  if(node.tagName==='DIALOG'&&node.classList.length)return 'dialog.'+escape(node.classList[0]);
  if(node===document.body)return 'body';const parent=key(node.parentElement);if(!parent)return null;
  const siblings=[...node.parentElement.children].filter(n=>n.tagName===node.tagName);return parent+' > '+node.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(node)+1)+')';
 }
 const find=selector=>{try{return typeof selector==='string'?document.querySelector(selector):null;}catch{return null;}};
 const neutral=node=>node.matches('[data-bundle-search],[data-bundle-type]')||node.id&&/(search|filter|^sort|datefrom|dateto|^templateCustomer$|catalogControlsTarget)/i.test(node.id);
 function capture(root=document){
  const controls=[...root.querySelectorAll('input,select')].filter(n=>neutral(n)&&!['password','file','hidden'].includes(n.type)).map(n=>({key:key(n),value:n.value.slice(0,500),checked:n.checked===true,search:n.matches('[data-bundle-search]'),bundle:n.matches('[data-bundle-search],[data-bundle-type]')}));
  const details=[...root.querySelectorAll('details')].map(n=>({key:key(n),open:n.open}));
  const scroll=[...root.querySelectorAll('[id],dialog,details,[class*="scroll"],[class*="body"],[class*="content"],[class*="queue"],.zigzag-messages')].filter(n=>n.scrollTop||n.scrollLeft).map(n=>({key:key(n),top:n.scrollTop,left:n.scrollLeft}));
  const active=document.activeElement;return {controls,details,scroll,focus:active&&neutral(active)?key(active):null};
 }
 function controls(state,events=false){for(const row of [...(state?.controls||[])].sort((a,b)=>Number(b.search)-Number(a.search))){const node=find(row.key);if(!node||!neutral(node)||['password','file','hidden'].includes(node.type))continue;if(node.tagName==='SELECT'&&![...node.options].some(o=>o.value===row.value))continue;node.value=String(row.value||'').slice(0,500);if(['checkbox','radio'].includes(node.type))node.checked=row.checked===true;if(events||row.bundle){node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}}}
 const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 async function restore(state,{withControls=true}={}){
  if(!state)return;if(withControls)controls(state);
  for(const row of state.details||[]){const node=find(row.key);if(node?.tagName==='DETAILS')node.open=row.open===true;}
  await frames();for(const row of state.scroll||[]){const node=find(row.key);if(node){node.scrollTop=Math.max(0,Number(row.top)||0);node.scrollLeft=Math.max(0,Number(row.left)||0);}}
  const focus=find(state.focus);if(focus&&!focus.disabled&&focus.getClientRects().length)focus.focus({preventScroll:true});
 }
 window.ZZWS_VIEW_STATE={capture,controls,restore,key,frames};
})();
