/* Catalogue composition reuses authorized products and the existing filter/actions. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id),make=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
 const main=document.querySelector('.catalog-main'),bar=el('stickySearchBar'),filters=el('filtersContainer');if(!main||!bar||!filters)return;
 const layout=make('div','sf-catalog-layout'),sidebar=make('aside','sf-catalog-sidebar'),results=make('section','sf-catalog-results');layout.id='catalogLayout';sidebar.id='catalogSidebar';results.id='catalogResults';sidebar.setAttribute('aria-label','Ֆիլտրեր');main.append(layout);layout.append(sidebar,results);sidebar.append(bar);
 for(const id of ['dealerWorkspace','dealerNotice','dataErrorBox','skeletonLoader','catalogContent']){const item=el(id);if(item)results.append(item);}
 const sort=make('select','sf-catalog-sort');sort.id='catalogSortSelect';sort.dataset.i18nSkip='true';document.querySelector('.dealer-workspace-actions')?.append(sort);
 // Numeric price filtering never modifies a price; only the already projected customer price is read.
 const form=make('form','sf-price-filter'),priceTitle=make('strong'),fields=make('div','sf-price-range'),min=make('input'),max=make('input'),apply=make('button','sf-button sf-primary'),status=make('p','sf-price-filter-status');form.id='catalogPriceFilter';min.id='catalogMinPrice';max.id='catalogMaxPrice';
 for(const field of [min,max]){field.type='number';field.min='0';field.step='any';field.inputMode='decimal';}
 apply.type='submit';status.setAttribute('role','status');form.append(priceTitle,fields,apply,status);fields.append(min,max);filters.prepend(form);
 const toolbar=el('dealerWorkspace');document.querySelector('.sf-catalog-heading')?.append(toolbar);
 let low=null,high=null,lastOwner=null;
 const desktop=matchMedia('(min-width:1024px)');
 const sidebarActive=()=>desktop.matches&&document.documentElement.dataset.dealerView==='cards'&&document.documentElement.dataset.storefrontPage!=='home';
 const text=(hy,ru)=>window.ZZWS_I18N?.language==='ru'?ru:hy;
 function localize(){sidebar.setAttribute('aria-label',text('Ֆիլտրեր','Фильтры'));priceTitle.textContent=text('Ձեր գինը','Ваша цена');min.placeholder=text('Սկսած','От');max.placeholder=text('Մինչև','До');min.setAttribute('aria-label',text('Նվազագույն գին','Минимальная цена'));max.setAttribute('aria-label',text('Առավելագույն գին','Максимальная цена'));apply.textContent=text('Ֆիլտր','Фильтр');sort.setAttribute('aria-label',text('Դասավորել ըստ','Сортировка'));}
 function clearPrice(){low=high=null;min.value=max.value='';status.textContent='';}
 function matchesPrice(p){const value=Number(p.wholesale);return low===null&&high===null||Number.isFinite(value)&&(low===null||value>=low)&&(high===null||value<=high);}
 form.onsubmit=e=>{e.preventDefault();const from=min.value.trim()===''?null:Number(min.value),to=max.value.trim()===''?null:Number(max.value);if(from!==null&&(!Number.isFinite(from)||from<0)||to!==null&&(!Number.isFinite(to)||to<0)||from!==null&&to!==null&&from>to){status.textContent=text('Ստուգեք գների միջակայքը','Проверьте диапазон цен');return;}low=from;high=to;status.textContent='';resetAndRender();};
 sort.onchange=()=>{const value=sort.value;if(value==='nameAsc'||value==='nameDesc'){el('sortColumn').value='name';el('sortBy').value=value==='nameAsc'?'columnAsc':'columnDesc';}else{el('sortPrice').value='wholesale';el('sortBy').value=value;}resetAndRender();};
 function refresh(){
  const who=catalogIdentity()?.id||serverIdentity?.id||null;if(who!==lastOwner){clearPrice();lastOwner=who;}
  const current=activeColumnSort(),mode=el('sortBy').value,selected=current.key==='name'?(current.direction===1?'nameAsc':current.direction===-1?'nameDesc':'default'):mode;
  const labels=[['default',text('Ստանդարտ','По умолчанию')],['priceAsc',text('Գին՝ աճման կարգով','Цена по возрастанию')],['priceDesc',text('Գին՝ նվազման կարգով','Цена по убыванию')],['nameAsc',text('Անվանում՝ Ա–Ֆ','Название от А до Я')],['nameDesc',text('Անվանում՝ Ֆ–Ա','Название от Я до А')],['marginDesc',text('Եկամտաբերություն','Доходность')]];
  sort.replaceChildren(...labels.map(([value,title])=>{const o=document.createElement('option');o.value=value;o.textContent=title;return o;}));sort.value=labels.some(([v])=>v===selected)?selected:'default';sort.hidden=window.ZZWS_CATALOG_CONTROLS?.enabled('sorting')===false;
  // Keep existing checkbox labels and access-controlled parent fields intact.
  const brandCounts=new Map(),categoryCounts=new Map();
  for(const p of allProducts){if(!selectedCategories.length||selectedCategories.includes(p.category))brandCounts.set(p.brand,(brandCounts.get(p.brand)||0)+1);if(!selectedBrands.length||selectedBrands.includes(p.brand))categoryCounts.set(p.category,(categoryCounts.get(p.category)||0)+1);}
  for(const [id,counts] of [['brandDropdown',brandCounts],['categoryDropdown',categoryCounts]])for(const label of el(id)?.querySelectorAll('label[data-value]')||[]){let count=label.querySelector('.sf-facet-count');if(!count){count=make('span','sf-facet-count');label.append(count);}count.textContent='('+ (counts.get(label.dataset.value)||0)+')';label.querySelector('input')?.setAttribute('tabindex','0');}
 }
 function sync(){const active=sidebarActive();layout.dataset.sidebar=String(active);if(active){filters.classList.remove('hidden');bar.classList.remove('filters-auto-compact');}window.ZZWS_STICKY?.refreshSummary();updateStickyOffsets();refresh();}
 window.ZZWS_CATALOG_LAYOUT={sidebarActive,matchesPrice,clearPrice,refresh};
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-dealer-view','data-storefront-page']});desktop.addEventListener('change',()=>{if(!desktop.matches&&document.documentElement.dataset.dealerView==='cards')filters.classList.add('hidden');sync();});window.addEventListener('zzws:languagechange',()=>{localize();refresh();});localize();sync();
})();
