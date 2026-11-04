import {effectiveRules} from './rules.mjs';

// WS is a saved legacy selector value. Category IDs, unlike display names, stay stable.
export const priceCategoryId=mode=>mode==='WS'?'Dealers':mode;
export const validPriceCategory=mode=>typeof mode==='string'&&(mode==='WS'||mode==='Dealers'||mode==='KP'||/^cat_[a-z0-9_-]{1,60}$/.test(mode));
export function checkedPriceCategory(mode,rules){
 const id=priceCategoryId(mode??'WS');
 if(!validPriceCategory(id)||!Object.hasOwn(effectiveRules(rules),id))throw Object.assign(Error('Գնային կատեգորիան հասանելի չէ։ Թարմացրեք կատալոգը։'),{code:400});
 return id;
}
export function projectedCategoryPrice(product,mode='WS'){
 const id=priceCategoryId(mode),prices=product?.stockPickerPrices;
 // An explicit null (or absent key in an authoritative map) must never bypass policy.
 const value=prices&&typeof prices==='object'
  ?Object.hasOwn(prices,id)?prices[id]:null
  :id==='KP'?(product?.kpPrice!==undefined?product.kpPrice:product?.wholesale):id==='Dealers'?product?.wholesale:null;
 return typeof value==='number'&&Number.isFinite(value)&&value>0?value:0;
}
