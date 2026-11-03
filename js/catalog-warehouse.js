/* Compact table-only warehouse rendering. Client availability remains projected. */
(() => {
 window.ZZWS_CATALOG_WAREHOUSE={html(product){
  if(typeof catalogIsAdmin!=='function'||!catalogIsAdmin())return null;
  const rows=Object.entries(window.ZZWS_WAREHOUSE_ALLOCATION?.stocks(product)||{}).filter(([,qty])=>qty>0).sort(([a],[b])=>a.localeCompare(b));if(!rows.length)return null;
  return '<dl class="catalog-stock-list" aria-label="'+(window.ZZWS_I18N?.language==='ru'?'Склад и количество':'Պահեստ և քանակ')+'">'+rows.map(([code,qty])=>'<div data-warehouse-code="'+code+'"><dt>'+code+'</dt><dd>'+qty.toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM')+'</dd></div>').join('')+'</dl>';
 }};
})();
