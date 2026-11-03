/* Offer input is independent of stock allocation and checkout. */
(function(root){
 'use strict';
 function parse(rows){
  const populated=rows.map(r=>r.map(v=>String(v??'').trim())).filter(r=>r.some(Boolean));
  if(!populated.length)throw Error('Ցանկը դատարկ է');
  const first=populated[0],find=re=>first.findIndex(v=>re.test(v));
  let q=find(/^(քանակ|количество|qty|quantity)$/i),s=find(/^(արտիկուլ|կոդ|артикул|код|sku)$/i),n=find(/^(մոդել|անվանում|номенклатура|модель|наименование|name|model)$/i),p=find(/^(գին|цена|price)$/i);
  const header=q>=0;if(!header){q=1;n=0;p=2;s=-1;}
  if(header&&s<0&&n<0)throw Error('Նշեք մոդելի կամ արտիկուլի սյունակը');
  const values=populated.slice(header?1:0);if(!values.length)throw Error('Ցանկը դատարկ է');if(values.length>2000)throw Error('Առավելագույնը 2000 տող');
  return values.map((r,i)=>{const quantity=Number(r[q]),text=p>=0?r[p]||'':'',price=text===''?null:Number(text.replace(/[\s֏]/g,'').replace(',','.'));
   if(!/^\d+$/.test(r[q]||'')||!Number.isSafeInteger(quantity)||quantity<1||quantity>999999||price!==null&&(!Number.isFinite(price)||price<=0||price>1e12))throw Error('Ստուգեք քանակը կամ գինը. տող '+(i+1+(header?1:0)));
   return {sku:s>=0?r[s]:'',name:n>=0?r[n]:'',quantity,price};
  });
 }
 function resolve(rows,products,mode,core){return rows.map(row=>{const match=core.match(row,products);if(!match.product)return {...row,...match};const p=match.product,base=p.stockPickerPrices?p.stockPickerPrices[mode]??null:p.wholesale??null;return {articul:p.articul,name:p.name,brand:p.brand,category:p.category,quantity:row.quantity,price:row.price!==null?row.price:p.stockPickerPrices?p.stockPickerPrices[mode]??null:p.wholesale??null,special:row.price!==null&&row.price!==base};});}
 function total(lines){let amount=0,unpriced=0;for(const row of lines){if(Number.isFinite(row.price)&&row.price>0)amount+=row.price*row.quantity;else unpriced+=row.quantity;}return {amount,unpriced};}
 const api={parse,resolve,total};if(typeof module==='object'&&module.exports)module.exports=api;else root.ZZWS_PROPOSAL_DATA=api;
})(typeof window==='object'?window:globalThis);
