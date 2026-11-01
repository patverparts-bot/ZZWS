// Home-page settings and aggregate recommendations. Customer/order details are never returned.
export const sectionKeys=['terms','delivery','contacts','help'];
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function storefrontSettings(config={}){
 const s=config?.storefront||{};
 return {newDays:s.newDays??7,bannerSeconds:s.bannerSeconds??8,pinned:s.pinned||[],excluded:s.excluded||[],sections:Object.fromEntries(sectionKeys.map(key=>[key,{enabled:s.sections?.[key]?.enabled??true,hy:s.sections?.[key]?.hy||'',ru:s.sections?.[key]?.ru||''}]))};
}
export function validateStorefront(value){
 if(!plain(value)||Object.keys(value).some(k=>!['newDays','bannerSeconds','pinned','excluded','sections'].includes(k))||!Number.isInteger(value.newDays)||value.newDays<1||value.newDays>365||!Number.isInteger(value.bannerSeconds)||value.bannerSeconds<5||value.bannerSeconds>60)throw Error('Ստուգեք նորույթի օրերը և բանների փոփոխման վայրկյանները');
 for(const [key,max] of [['pinned',8],['excluded',100]])if(!Array.isArray(value[key])||value[key].length>max||new Set(value[key]).size!==value[key].length||value[key].some(v=>typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>30))throw Error('Ստուգեք բանների արտիկուլների ցանկը');
 if(value.pinned.some(a=>value.excluded.includes(a)))throw Error('Նույն ապրանքը միաժամանակ ընտրված և բացառված է');
 if(!plain(value.sections)||Object.keys(value.sections).some(k=>!sectionKeys.includes(k)))throw Error('Բաժինների սխալ կարգավորում');
 const sections={};
 for(const key of sectionKeys){const row=value.sections[key];if(!plain(row)||Object.keys(row).some(k=>!['enabled','hy','ru'].includes(k))||typeof row.enabled!=='boolean'||['hy','ru'].some(k=>typeof row[k]!=='string'||row[k].length>10000))throw Error('Լրացրեք բաժնի հայերեն և ռուսերեն տվյալները');sections[key]={enabled:row.enabled,hy:row.hy.trim(),ru:row.ru.trim()};}
 return {newDays:value.newDays,bannerSeconds:value.bannerSeconds,pinned:[...value.pinned],excluded:[...value.excluded],sections};
}
export function newProductFlags(product,days=7,now=Date.now()){
 const appeared=Date.parse(product.introducedAt),until=appeared+days*86400000;
 return Number.isFinite(appeared)&&appeared<=now&&until>now?{isNew:true,newUntil:new Date(until).toISOString()}:{};
}
export const inStock=product=>product.stockAvailable===true||(product.stockAvailable==null&&(product.targetWarehousesStock>=3||product.stockStatus==='Առկա է'));
export async function storefrontRanking(service,query,products,config,userId,days){
 const excluded=new Set(storefrontSettings(config).excluded),articuls=products.filter(p=>inStock(p)&&!excluded.has(p.articul)).map(p=>p.articul);
 return articuls.length?query(service.rpc('zzws_storefront_popularity',{p_user:userId,p_days:days,p_articuls:articuls})):[];
}
export function storefrontDTO(products,rows,config={},now=Date.now()){
 const settings=storefrontSettings(config),available=new Map(products.filter(inStock).map(p=>[p.articul,p]));
 const excluded=new Set(settings.excluded),pinned=settings.pinned.filter(a=>available.has(a)&&!excluded.has(a));
 const ranking=rows.filter(r=>available.has(r.articul)&&!excluded.has(r.articul)).map(r=>({articul:r.articul,score:Math.max(0,Number(r.orders||0))})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.articul.localeCompare(b.articul));
 const banners=[...new Set([...pinned,...ranking.map(r=>r.articul)])].slice(0,8);
 // Only IDs from this user's projected catalogue; no purchase counts or buyer IDs.
 return {newDays:settings.newDays,bannerSeconds:settings.bannerSeconds,banners,manualBanners:pinned,sections:Object.fromEntries(Object.entries(settings.sections).filter(([,row])=>row.enabled&&(row.hy||row.ru)))};
}
