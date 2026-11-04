(() => {
 'use strict';
 const defaults=[{id:'Dealers',label:'Մշտական Գորրընկեր'},{id:'KP',label:'Խոշոր Գործընկեր'}];
 let categories=defaults.map(row=>({...row})),knownLabels=new Map(defaults.map(row=>[row.id,row.label]));
 const valid=id=>id==='Dealers'||id==='KP'||/^cat_[a-z0-9_-]{1,60}$/.test(id);
 const canonical=id=>id==='WS'?'Dealers':id;
 function choices(){return categories.map(row=>({...row}));}
 function normalize(id){id=canonical(id);return typeof id==='string'&&valid(id)?id:'Dealers';}
 function label(id){id=canonical(id);const name=categories.find(row=>row.id===id)?.label||knownLabels.get(id);if(!name)return String(id||'');const fallback=defaults.find(value=>value.id===id);return fallback?.label===name?(window.ZZWS_I18N?.t(name)||name):name;}
 function populate(select,{selected=select.value,legacyWS=false}={}){
  const current=normalize(selected),options=categories.map(row=>{const option=document.createElement('option');option.value=legacyWS&&row.id==='Dealers'?'WS':row.id;option.textContent=label(row.id);option.dataset.i18nSkip='true';return option;});
  if(!categories.some(row=>row.id===current)){const missing=document.createElement('option');missing.value=current;missing.textContent=label(current)+' — '+(window.ZZWS_I18N?.t('Կատեգորիան հասանելի չէ')||'Կատեգորիան հասանելի չէ');missing.disabled=true;missing.dataset.i18nSkip='true';options.push(missing);}
  select.replaceChildren(...options);select.value=legacyWS&&current==='Dealers'?'WS':current;return current;
 }
 function refresh(){window.dispatchEvent(new CustomEvent('zzws:price-categories'));}
 function configure(rows){
  const next=[],seen=new Set();
  for(const row of Array.isArray(rows)?rows:defaults){if(!row||typeof row.id!=='string'||!valid(row.id)||seen.has(row.id)||typeof row.label!=='string'||!row.label.trim()||row.label.length>100||/[\u0000-\u001f\u007f]/u.test(row.label))continue;seen.add(row.id);next.push({id:row.id,label:row.label.trim()});if(next.length===50)break;}
  for(const row of defaults)if(!seen.has(row.id))next.push({...row});
  if(JSON.stringify(next)===JSON.stringify(categories))return;categories=next;for(const row of next)knownLabels.set(row.id,row.label);refresh();
 }
 window.ZZWS_PRICE_CATEGORIES=Object.freeze({choices,label,normalize,populate,configure,refresh,reset(){knownLabels=new Map(defaults.map(row=>[row.id,row.label]));configure(defaults);}});
 window.addEventListener('zzws:languagechange',refresh);
})();
