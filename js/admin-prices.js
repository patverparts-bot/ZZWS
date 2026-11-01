/* Presentation only: projected WS/KP values, never the selected order price. */
(() => {
 'use strict';
 const copy={hy:{ws:'Մեծածախ',kp:'Խոշոր գործընկերոջ գին',promo:'KP ակցիա',margin:'Եկամտաբերություն'},ru:{ws:'Оптовая',kp:'Цена крупного партнёра',promo:'Акция KP',margin:'Доходность'}};
 const language=()=>window.ZZWS_I18N?.language==='ru'?'ru':'hy';
 const active=()=>typeof catalogIsAdmin==='function'&&catalogIsAdmin();
 const valid=value=>Number.isFinite(value)&&value>0;
 const money=value=>valid(value)?value.toLocaleString(language()==='ru'?'ru-RU':'hy-AM')+' ֏':'—';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function model(product){
  if(!active()||!product)return [];
  const domus=/ԴՈՄՈՒՍ|ДОМУՍ|DOMUS/i.test(typeof catalogIdentity==='function'?catalogIdentity()?.client||'':'');
  return ['ws','kp'].map(kind=>{const value=kind==='ws'?product.wholesale:product.kpPrice,margin=kind==='ws'?product.marginVal:product.kpMarginVal;return {kind,value:valid(value)?value:null,promo:kind==='kp'&&valid(value)&&product.kpIsPromo===true,margin:product.retail>0&&valid(value)&&Number.isFinite(margin)?margin.toFixed(domus?2:1)+(domus?'':'%'):'—'};});
 }
 function blockHTML(row,withMargin=true){const labels=copy[language()];return '<div class="admin-price-block admin-price-'+row.kind+'" data-admin-price-block data-admin-price-kind="'+row.kind+'" data-admin-price-number="'+(row.value??'')+'" data-admin-price-margin="'+escape(row.margin)+'" data-admin-price-promo="'+row.promo+'" data-i18n-skip="true"><dt class="admin-price-label">'+labels[row.kind]+'</dt><dd class="admin-price-value">'+money(row.value)+'</dd>'+(row.promo?'<dd class="admin-price-promo">'+labels.promo+'</dd>':'')+(withMargin?'<dd class="admin-price-margin"><span>'+labels.margin+'</span> <strong>'+escape(row.margin)+'</strong></dd>':'')+'</div>';}
 function html(product){const rows=model(product);return rows.length?'<dl class="admin-price-pair" data-admin-price-pair>'+rows.map(r=>blockHTML(r)).join('')+'</dl>':'';}
 function cell(product,kind){const row=model(product).find(r=>r.kind===kind);return row?'<dl class="admin-price-single" data-admin-price-single>'+blockHTML(row,false)+'</dl>':'';}
 function rows(product){return model(product).map(row=>{const template=document.createElement('template');template.innerHTML=blockHTML(row);return template.content.firstElementChild;});}
 function pair(product){if(!active())return null;const node=document.createElement('dl');node.className='admin-price-pair';node.dataset.adminPricePair='';node.append(...rows(product));return node;}
 function clear(){for(const node of document.querySelectorAll('[data-admin-price-pair],[data-admin-price-single],[data-admin-price-block]'))node.remove();}
 function localize(){if(!active()){clear();return;}const labels=copy[language()];for(const block of document.querySelectorAll('[data-admin-price-block]')){block.querySelector('.admin-price-label').textContent=labels[block.dataset.adminPriceKind];block.querySelector('.admin-price-value').textContent=money(Number(block.dataset.adminPriceNumber));const promo=block.querySelector('.admin-price-promo');if(promo)promo.textContent=labels.promo;const margin=block.querySelector('.admin-price-margin span');if(margin)margin.textContent=labels.margin;}}
 window.ZZWS_ADMIN_PRICES=Object.freeze({active,model,money,html,cell,rows,pair,clear});
 window.addEventListener('zzws:languagechange',localize);
})();
