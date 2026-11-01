export const yerevanDate=(now=Date.now())=>new Date(now+4*3600000).toISOString().slice(0,10);
export function offerLive(row,now=Date.now()){
 return !!row&&row.kind==='offers'&&row.active===true&&!row.deleted_at&&(!row.expires_on||row.expires_on>=yerevanDate(now));
}
export async function currentOffer(table,query){
 const rows=await query(table('catalog_bulletins').select('id,kind,title,articles,active,created,revision,expires_on,deleted_at').eq('kind','offers').eq('active',true).is('deleted_at',null).order('created',{ascending:false}).limit(1));
 return offerLive(rows[0])?rows[0]:null;
}
export const offerStamp=row=>row?row.id+':'+row.revision:'';
export function wholesaleOfferPrice(product,admin=false){
 const price=product.isWholesalePromo?product.wholesale:admin&&product.kpIsPromo?product.kpPrice:0;
 return Number.isFinite(price)&&price>0?price:0;
}
export function offerPrice(product,admin=false){
 const promo=wholesaleOfferPrice(product,admin),regular=product.wholesale;
 return promo||(Number.isFinite(regular)&&regular>0?regular:0);
}
export function manualOfferProducts(row,products,admin=false){
 if(!offerLive(row))return [];
 const available=new Map(products.filter(p=>offerPrice(p,admin)>0).map(p=>[p.articul,p]));
 return [...new Set(row.articles)].filter(a=>available.has(a)).map(a=>available.get(a));
}
export function offerProducts(row,products,admin=false){
 // products have already been projected through this account's catalogue and prices.
 const manual=manualOfferProducts(row,products,admin),automatic=products.filter(p=>wholesaleOfferPrice(p,admin)>0);
 return [...new Map([...manual,...automatic].map(p=>[p.articul,p])).values()];
}
export function offerDTO(row,products,admin=false){
 const eligible=offerProducts(row,products,admin);
 const manual=manualOfferProducts(row,products,admin);
 return eligible.length?{id:row?.id||'wholesale-promotions',title:offerLive(row)?row.title:'Հատուկ առաջարկներ',revision:row?.revision||1,expiresOn:null,manualExpiresOn:offerLive(row)?row.expires_on:null,manualArticles:manual.map(p=>p.articul),articles:eligible.map(p=>p.articul)}:null;
}
