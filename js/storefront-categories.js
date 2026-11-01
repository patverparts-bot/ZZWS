/* Group only actual, accessible category values. The catalogue keeps every subcategory. */
(() => {
 // Category illustrations are reviewed assets, independent of catalogue order.
 const photos=Object.freeze({"tv":"js/category-photos/tv-185983ca06df.png","washer":"js/category-photos/washer-5ccf37918cfb.png","dishwasher":"js/category-photos/dishwasher-feef7ffb103b.jpg","hob":"js/category-photos/hob-f936654bbc4e.jpg","oven":"js/category-photos/oven-1d80debd6be1.jpg","fridge":"js/category-photos/fridge-c6fdbe794654.png"});
 const families=[
  ['tv','Հեռուստացույցներ',/հեռուստացույց|телевизор|\b(?:tv|television)\b/i],
  ['washer','Լվացքի մեքենաներ',/լվացքի մեքեն|стиральн|washing.?machine|\bwasher/i],
  ['dishwasher','Սպասք լվացող մեքենաներ',/սպասք.*(?:լվա|մեքեն)|посудомо|dishwasher/i],
  ['hob','Եփման վահանակներ',/եփման.*վահանակ|սալօջախ|ներկառուց.*գազօջախ|варочн|\bhob|cooktop/i],
  ['oven','Ներկառուցվող ջեռոցներ',/ջեռոց|ներկառուց.*վառարան|духов|built.?in.?oven|\boven/i],
  ['fridge','Սառնարաններ',/սառնարան|холодильн|refrigerator|\bfridge/i]
 ];
 function groups(products,facts={}){
  return families.flatMap(([id,label,pattern])=>{const rows=products.filter(p=>p.category&&(facts[p.articul]?.type===id||pattern.test(p.category))&&!(/միկրոալիք|microwave|мини.?печ/i.test(p.category)&&id==='oven'));return rows.length?[{id,label,product:rows[0],categories:[...new Set(rows.map(p=>p.category))]}]:[];});
 }
 window.ZZWS_STOREFRONT_CATEGORIES={groups,photo:id=>photos[id]||null};
})();
