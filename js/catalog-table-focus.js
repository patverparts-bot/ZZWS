/* Expand only while the user scrolls the table, never the whole browser. */
(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement,wrap=document.getElementById('tableScrollWrapper');if(!wrap)return;let active=false,savedY=0,spacer=null;
  const back=document.createElement('button');back.id='catalogTableFocusBack';back.type='button';back.textContent='↑';back.hidden=true;document.body.append(back);
  const eligible=()=>root.dataset.dealerView==='table'&&root.dataset.storefrontPage!=='home';
  function label(){const text=window.ZZWS_I18N?.language==='ru'?'К началу каталога':'Դեպի կատալոգի սկիզբ';back.title=text;back.setAttribute('aria-label',text);}
  function enter(){if(active||!eligible()||wrap.scrollTop<24)return;active=true;savedY=window.scrollY;spacer=document.createElement('div');spacer.style.height=wrap.getBoundingClientRect().height+'px';spacer.setAttribute('aria-hidden','true');wrap.before(spacer);root.setAttribute('data-table-focus','');back.hidden=false;window.ZZWS_TABLE_WIDTH?.sync();}
  function leave(reset=false){if(!active)return;active=false;root.removeAttribute('data-table-focus');back.hidden=true;spacer?.remove();spacer=null;if(reset)wrap.scrollTop=0;window.scrollTo(0,savedY);window.ZZWS_TABLE_WIDTH?.sync();}
  wrap.addEventListener('scroll',()=>{if(!active)enter();else if(wrap.scrollTop<=0)leave();},{passive:true});back.onclick=()=>{leave(true);document.getElementById('dealerTableView')?.focus({preventScroll:true});};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.querySelector('dialog[open]')){leave(true);}});
  new MutationObserver(()=>{if(!eligible())leave(true);}).observe(root,{attributes:true,attributeFilter:['data-dealer-view','data-storefront-page']});
  new MutationObserver(()=>{if(document.getElementById('mainApp')?.classList.contains('hidden'))leave(true);}).observe(document.getElementById('mainApp'),{attributes:true,attributeFilter:['class']});
  window.addEventListener('zzws:languagechange',label);label();
 });
})();
