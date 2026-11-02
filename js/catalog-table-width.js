/* Column widths follow the currently authorized, visible header set. */
(() => {
 'use strict';
 const table=document.getElementById('catalogTable'),head=document.getElementById('tableHeaderRow'),wrap=document.getElementById('tableScrollWrapper');if(!table||!head||!wrap)return;
 const widths={articul:132,brand:142,name:380,stockStatus:154,retail:134,resaleWholesale:184,kpPrice:154,kpMarginVal:172,wholesale:144,marginVal:158};
 const group=document.createElement('colgroup');group.id='catalogColumnWidths';table.prepend(group);
 let scheduled=false;
 function sync(){
  scheduled=false;const headers=[...head.cells];let total=0;const columns=[];
  for(const [i,th] of headers.entries()){
   const key=th.querySelector('[data-sort-column]')?.dataset.sortColumn;
   const width=getComputedStyle(th).display==='none'?0:widths[key]||(i===0?46:176);
   if(!width)continue;
   const col=document.createElement('col');col.style.width=width+'px';columns.push(col);total+=width;
  }
  group.replaceChildren(...columns);table.style.minWidth=total+'px';
  const wide=document.documentElement.dataset.dealerView==='table'&&total>wrap.clientWidth+1;
  wrap.dataset.wide=String(wide);wrap.style.overflowX=wide?'auto':'clip';wrap.tabIndex=wide?0:-1;
  wrap.setAttribute('aria-label',window.ZZWS_I18N?.language==='ru'?'Каталог товаров. Таблицу можно прокручивать.':'Ապրանքների կատալոգ։ Աղյուսակը կարող եք ոլորել։');
  requestAnimationFrame(()=>{if(typeof fitCatalogHeadings==='function')fitCatalogHeadings();});
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(sync);}}
 new MutationObserver(schedule).observe(head,{childList:true});
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-dealer-view','data-storefront-page']});
 new ResizeObserver(schedule).observe(wrap);window.addEventListener('zzws:languagechange',schedule);
 wrap.addEventListener('scroll',()=>{if(wrap.dataset.wide==='true'&&wrap.scrollHeight-wrap.scrollTop-wrap.clientHeight<400&&typeof loadMoreProducts==='function')loadMoreProducts();},{passive:true});
 window.ZZWS_TABLE_WIDTH={sync:schedule};schedule();
})();
