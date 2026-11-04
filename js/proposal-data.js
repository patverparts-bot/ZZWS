/* Offer input is independent of stock allocation and checkout. */
(function(root){
 'use strict';
 function number(value){
  let s=String(value??'').replace(/[\s֏]/g,'');
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf('.')>s.lastIndexOf(',')?s.replace(/,/g,''):s.replace(/\./g,'').replace(',','.');
  else if(s.includes(','))s=/^[+-]?\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.');
  return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN;
 }
 function parse(rows){
  const populated=rows.map((r,i)=>{let cells=Array.from(r,v=>String(v??'').trim());
   // Plain pasted lists may have one cell containing identity - quantity.
   if(cells.length===1){const pair=cells[0].match(/^(.+?)\s+[-–—]\s*([+-]?\d+(?:[.,]\d+)?)(?:\s*(?:հատ|hat|шт\.?|pcs?\.?))?$/iu);const spaced=cells[0].match(/^([0-9][A-Z0-9._/\-]*)\s+([+-]?\d+(?:[.,]\d+)?)(?:\s*(?:հատ|hat|шт\.?|pcs?\.?))?$/iu);if(pair||spaced){const match=pair||spaced;cells=[match[1].trim(),match[2]];}}
   return {cells,line:i+1};}).filter(r=>r.cells.some(Boolean));
  if(!populated.length)throw Error('Ցանկը դատարկ է');
  const first=populated[0].cells,find=re=>first.findIndex(v=>re.test(v));
  let q=find(/^(քանակ|количество|qty|quantity)$/i),s=find(/^(արտիկուլ|կոդ|артикул|код|sku)$/i),n=find(/^(մոդել|անվանում|номенклатура|модель|наименование|name|model)$/i),p=find(/^(գին|цена|price)$/i);
  const header=q>=0;if(!header){
   q=1;n=0;p=2;s=-1;
   // Headerless copies of our warehouse export retain article/name, optional
   // characteristic, quantity, price, warehouse and the calculated line total.
   // Pick the layout once from identity/warehouse columns, never from price size.
   const pair=/^[0-9][A-Z0-9._/-]*$/i.test(first[0]||'')&&/\p{L}/u.test(first[1]||'');
   if(pair&&first.length>=6&&/^(\d{3})?$/.test(first[5]||'')){s=0;n=1;q=3;p=4;}
   else if(pair&&first.length>=4&&first.length<=5){s=0;n=1;q=2;p=3;}
   else if(pair&&first.length===3){s=0;n=1;q=2;p=-1;}
  }
  if(header&&s<0&&n<0)throw Error('Նշեք մոդելի կամ արտիկուլի սյունակը');
  const result=[];
  for(const entry of populated.slice(header?1:0)){
   const r=entry.cells,sku=s>=0?r[s]||'':'',name=n>=0?r[n]||'':'',qty=r[q]||'',text=p>=0?r[p]||'':'';
   // A total in an unmapped column (e.g. G109) is not a product row.
   if(!sku&&!name&&!qty&&!text)continue;
   const identity=(sku||name).replace(/[:։.]$/,'').trim();
   if((!sku||!name)&&/^(итого|всего|total|grand total|ընդամենը|ընդհանուր|ընդհանուր գումար)$/i.test(identity))continue;
   if(!sku&&!name)throw Error('Արտիկուլը կամ մոդելը բացակայում է. տող '+entry.line);
   const quantity=number(qty),price=text===''?null:number(text);
   if(!Number.isSafeInteger(quantity)||quantity<1||quantity>999999||price!==null&&(!Number.isFinite(price)||price<=0||price>1e12))throw Error('Ստուգեք քանակը կամ գինը. տող '+entry.line);
   result.push({sku,name,quantity,price});
  }
  if(!result.length)throw Error('Ցանկը դատարկ է');if(result.length>2000)throw Error('Առավելագույնը 2000 տող');return result;
 }
 function resolve(rows,products,mode,core){return rows.map(row=>{const match=core.match(row,products);if(!match.product)return {...row,...match};const p=match.product,base=p.stockPickerPrices?p.stockPickerPrices[mode]??null:p.wholesale??null;return {articul:p.articul,name:p.name,brand:p.brand,category:p.category,quantity:row.quantity,price:row.price!==null?row.price:p.stockPickerPrices?p.stockPickerPrices[mode]??null:p.wholesale??null,special:row.price!==null&&row.price!==base};});}
 function total(lines){let amount=0,unpriced=0;for(const row of lines){if(Number.isFinite(row.price)&&row.price>0)amount+=row.price*row.quantity;else unpriced+=row.quantity;}return {amount,unpriced};}
 function counts(lines){return {items:new Set(lines.map(r=>String(r.articul||r.sku||r.name||'').normalize('NFKC').trim().toUpperCase())).size,quantity:lines.reduce((sum,r)=>sum+r.quantity,0)};}
 function summary(lines){const n=counts(lines);return 'Անվանումներ՝ '+n.items.toLocaleString('hy-AM')+' · Ընդհանուր քանակ՝ '+n.quantity.toLocaleString('hy-AM')+' հատ';}
 const api={parse,resolve,total,counts,summary};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZWS_PROPOSAL_DATA=api;
})(typeof window==='object'?window:globalThis);
