/* Group only actual, accessible category values. The catalogue keeps every subcategory. */
(() => {
 const families=[
  ['tv','Հեռուստացույցներ',/հեռուստացույց|телевизор|\b(?:tv|television)\b/i],
  ['washer','Լվացքի մեքենաներ',/լվացքի մեքեն|стиральн|washing.?machine|\bwasher/i],
  ['dishwasher','Սպասք լվացող մեքենաներ',/սպասք.*(?:լվա|մեքեն)|посудомо|dishwasher/i],
  ['hob','Եփման վահանակներ',/եփման.*վահանակ|սալօջախ|варочн|\bhob|cooktop/i],
  ['oven','Ներկառուցվող ջեռոցներ',/ջեռոց|ներկառուց.*վառարան|духов|built.?in.?oven|\boven/i],
  ['fridge','Սառնարաններ',/սառնարան|холодильн|refrigerator|\bfridge/i]
 ];
 function groups(products,facts={}){
  return families.flatMap(([id,label,pattern])=>{const rows=products.filter(p=>p.category&&(facts[p.articul]?.type===id||pattern.test(p.category))&&!(/միկրոալիք|microwave|мини.?печ/i.test(p.category)&&id==='oven'));return rows.length?[{id,label,product:rows[0],categories:[...new Set(rows.map(p=>p.category))]}]:[];});
 }
 window.ZZWS_STOREFRONT_CATEGORIES={groups};
})();
