import {styledBuyerOfferWorkbook} from './buyer-offer-workbook.mjs';
import {effectiveRules,selectPrice} from './rules.mjs';
import {phoneNumber} from './phones.mjs';
import {categoryChoices} from './user-sheet.mjs';
import {productDetails} from './dealer.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD_SKU=new Set(['__proto__','prototype','constructor']);
const PRICE_ERROR='Գինը հասանելի չէ։ Բարձրացրեք գումարը և կրկին ստուգեք։';
const invalid=message=>Object.assign(Error(message),{code:400});
const unavailable=()=>Object.assign(Error(PRICE_ERROR),{code:409});
const costParts=value=>{
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>1e10)throw unavailable();
 const [mantissa,exponent='0']=String(value).toLowerCase().split('e'),parts=mantissa.split('.'),scale=(parts[1]?.length||0)-Number(exponent),digits=BigInt(parts.join(''));
 return scale>=0?{n:digits,d:10n**BigInt(scale)}:{n:digits*10n**BigInt(-scale),d:1n};
};
// Integer arithmetic avoids a floating-point remainder raising an exact floor by one dram.
export function buyerPriceFloor(cost,markupPercent){
 const basisPoints=Math.round(markupPercent*100);
 if(typeof markupPercent!=='number'||!Number.isFinite(markupPercent)||markupPercent<0||markupPercent>1000||Math.abs(markupPercent*100-basisPoints)>1e-7)throw invalid('Ստուգեք նվազագույն հավելագինը։');
 const value=costParts(cost),den=value.d*10000n;
 return Number((value.n*BigInt(10000+basisPoints)+den-1n)/den);
}
export function buyerDetails(input){
 if(typeof input?.buyerName!=='string')throw invalid('Լրացրեք գնորդի անունը և հեռախոսահամարը։');
 const name=input.buyerName.trim();
 if(!name||name.length>200||/[\u0000-\u001f\u007f]/u.test(name))throw invalid('Լրացրեք գնորդի անունը և հեռախոսահամարը։');
 const phone=phoneNumber(input.buyerPhone);if(!phone)throw invalid('Լրացրեք գնորդի անունը և հեռախոսահամարը։');
 buyerPriceFloor(1,input.markupPercent);
 return {name,phone};
}
export function buyerInputLines(lines){
 if(!Array.isArray(lines)||!lines.length||lines.length>500)throw invalid('Ընտրեք մինչև 500 ապրանք։');
 const seen=new Set();
 return lines.map(row=>{
  if(!row||typeof row.articul!=='string'||!row.articul||row.articul.length>100||BAD_SKU.has(row.articul)||seen.has(row.articul)||!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>9999||!Number.isSafeInteger(row.salePrice)||row.salePrice<=0||row.salePrice>1e10)throw invalid('Ստուգեք ապրանքների քանակներն ու վաճառքի գները։');
  seen.add(row.articul);return {articul:row.articul,qty:row.qty,salePrice:row.salePrice};
 }).sort((a,b)=>a.articul.localeCompare(b.articul,'en'));
}
const readableNumber=row=>Number.isSafeInteger(Number(row.offer_number))&&Number(row.offer_number)>0?'ZZWS-'+String(row.offer_number).padStart(6,'0'):null;
const publicOffer=row=>({id:row.id,number:readableNumber(row),buyer:{name:row.buyer_name,phone:row.buyer_phone},lines:row.public_lines,total:Number(row.total),finalizedAt:row.finalized_at,createdAt:row.finalized_at||row.created_at});
export function buyerOfferWorkbook(offer){
 return styledBuyerOfferWorkbook(offer);
}
const FINANCIAL_SPEC=/price|cost|wholesale|partner|margin|discount|profit|markup|\bAMD\b|դրամ|գին|մեծածախ|շահույթ|հավելագին|զեղչ|цен[аыуе]|стоимост|оптов|закуп|прибыл|нацен|маржа|скидк|[֏$€₽£]/iu;
export function buyerPublicDetails(product,details){
 const specs=values=>(Array.isArray(values)?values:[]).flatMap(row=>{
  if(!row||typeof row.name!=='string'||typeof row.value!=='string'&&typeof row.value!=='number')return [];
  const name=row.name.trim(),value=String(row.value).trim();
  return !name||!value||name.length>200||value.length>2000||FINANCIAL_SPEC.test(name+' '+value)?[]:[{name,value}];
 });
 let sourceUrl=null;try{const u=new URL(details.sourceUrl);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password){u.search='';u.hash='';sourceUrl=u.href;}}catch{}
 const checkedAt=typeof details.checkedAt==='string'&&details.checkedAt.length<80&&Number.isFinite(Date.parse(details.checkedAt))?details.checkedAt:null;
 return {articul:product.articul,name:product.name,highlights:specs(details.highlights),specifications:specs(details.specifications),sourceUrl,checkedAt};
}
function chosenCategory(user,requested,rules){
 const id=user.role==='admin'?(requested==='WS'?'Dealers':requested||'Dealers'):(user.sheet||'Dealers');
 if(typeof id!=='string'||!Object.hasOwn(rules,id)||user.role!=='admin'&&requested!=null&&(requested==='WS'?'Dealers':requested)!==id)throw invalid('Գնային կատեգորիան հասանելի չէ։ Թարմացրեք կատալոգը։');
 return id;
}
export function buyerPublicRetail(product,source){
 const retail=Number.isFinite(product.retail)&&product.retail>0&&product.retail<=1e10?product.retail:null;
 // The source base column is regular public retail. KP/ws promotions are procurement terms.
 const previous=source?.base;
 return {retail,retailPromotion:retail!==null&&Number.isFinite(previous)&&previous>retail&&previous<=1e10?{previousRetail:previous}:null};
}
function productsFor(c,catalog,offer){
 // Current account access is always reevaluated; setup never grants a broader catalogue.
 const projected=c.project(catalog.products,c.user,catalog.rules,{forOrder:true,mainWarehouses:catalog.mainWarehouses});
 const raw=new Map(catalog.products.map(p=>[p.articul,p])),rules=effectiveRules(catalog.rules),id=chosenCategory(c.user,offer.price_category,rules),policy=rules[id].pricing;
 return projected.flatMap(p=>{
  const source=raw.get(p.articul);if(!source)return [];
  const cost=c.user.role==='admin'?selectPrice(source,policy).price:p.wholesale;
  if(!Number.isFinite(cost)||cost<=0||cost>1e10||c.user.role==='admin'&&policy.hideAboveRetail&&source.retail>0&&cost>source.retail)return [];
  const minimum=buyerPriceFloor(cost,Number(offer.markup_percent));
  if(minimum>1e10)return [];
  return [{product:p,cost,minimum,publicRetail:buyerPublicRetail(p,source)}];
 });
}
function publicBuyerCatalog(c,catalog,offer){
 const products=productsFor(c,catalog,offer).map(({product:p,minimum,publicRetail})=>({articul:p.articul,name:p.name,brand:p.brand,category:p.category,...publicRetail,salePrice:Math.max(Math.ceil(publicRetail.retail||0),minimum),stockAvailable:p.stockAvailable===true}));
 return {id:offer.id,buyer:{name:offer.buyer_name,phone:offer.buyer_phone},version:catalog.id+':'+catalog.rulesRevision,products};
}
function quoteFor(c,catalog,offer,input){
 const bySku=new Map(productsFor(c,catalog,offer).map(p=>[p.product.articul,p]));
 let saleTotal=0n,costTotal=0n,costDenominator=1n;
 const internal=[],lines=input.map(row=>{
  const entry=bySku.get(row.articul);if(!entry||row.salePrice<entry.minimum)throw unavailable();
  const amount=row.qty*row.salePrice;if(!Number.isSafeInteger(amount))throw unavailable();
  saleTotal+=BigInt(amount)*100n;
  const value=costParts(entry.cost);if(value.d>costDenominator){costTotal*=value.d/costDenominator;costDenominator=value.d;}
  costTotal+=value.n*BigInt(row.qty)*(costDenominator/value.d);
  internal.push({articul:row.articul,qty:row.qty,unitCost:entry.cost});
  return {articul:row.articul,name:entry.product.name,brand:entry.product.brand,category:entry.product.category,...entry.publicRetail,qty:row.qty,salePrice:row.salePrice,amount};
 });
 if(saleTotal>10000000000000000n)throw invalid('Առաջարկի գումարը չափազանց մեծ է։');
 const profitCents=saleTotal*costDenominator-costTotal*100n;
 return {lines,internal,total:Number(saleTotal)/100,expectedProfit:Number((profitCents*2n+costDenominator)/(2n*costDenominator))/100};
}
export async function buyerOfferRoutes(c){
 const prefix='dealer/buyer-offers/';if(!c.path.startsWith(prefix))return null;
 const {req,user,query,table,body,json,fail,current,service}=c;
 if(!user||!['admin','client'].includes(user.role)||user.needsPasswordSetup||user.needsProfileSetup||user.role==='admin'&&!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
 if(req.method!=='POST')fail(405,'Չթույլատրված գործողություն');
 const action=c.path.slice(prefix.length);if(!['options','start','resume','catalog','details','quote','finalize','export','handoff'].includes(action))fail(404,'Բաժինը չի գտնվել');
 const input=await body(req);if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Ստուգեք առաջարկի տվյալները։');
 const ownedOffer=async id=>{if(!UUID.test(id||''))fail(404,'Առաջարկը չի գտնվել');const row=await query(table('buyer_offers').select('*').eq('id',id).eq('actor_id',user.id).maybeSingle());if(!row)fail(404,'Առաջարկը չի գտնվել');return row;};
 const requireUnexpired=offer=>{if(Date.parse(offer.expires_at)<=Date.now())fail(409,'Աշխատանքային շրջանն ավարտված է։ Կրկին բացեք գնորդի ռեժիմը։');};
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error){if(r.error.code==='PT403')fail(403,'Հասանելիությունն արգելված է');if(r.error.code==='PT404')fail(404,'Առաջարկը չի գտնվել');if(r.error.code==='PT409'||r.error.code==='PT412'||r.error.code==='23505')fail(409,'Տվյալները փոխվել են։ Թարմացրեք առաջարկը և կրկին ստուգեք։');fail(400,'Չհաջողվեց պահպանել առաջարկը։ Ստուգեք տվյալները։');}return r.data;};
 try{
  if(action==='options'){
   const v=await current(),rules=effectiveRules(v.rules),id=chosenCategory(user,null,rules),choices=categoryChoices(rules);
   return json({priceCategories:user.role==='admin'?choices:choices.filter(row=>row.id===id),defaultPriceCategory:id});
  }
  if(action==='start'){
   let setup=input;
   if(Object.hasOwn(input,'fromOfferId')){
    const prior=await ownedOffer(input.fromOfferId);requireUnexpired(prior);
    if(prior.state==='handed_off')fail(409,'Առաջարկն արդեն փոխանցված է աշխատանքային զամբյուղ։');
    // Private setup stays on the server; browser recovery stores only opaque IDs and public selections.
    setup={buyerName:prior.buyer_name,buyerPhone:prior.buyer_phone,markupPercent:Number(prior.markup_percent),priceCategory:prior.price_category,source:prior.source};
   }
   const buyer=buyerDetails(setup),v=await current(),priceCategory=chosenCategory(user,setup.priceCategory,effectiveRules(v.rules));
   const source=setup.source??'catalog';if(!['catalog','cart','selection','product','bundle'].includes(source))throw invalid('Ընտրեք առաջարկի ապրանքների աղբյուրը։');
   const baseCart=Object.create(null);
   if(source==='cart'){
    const saved=await query(table('user_memory').select('data').eq('user_id',user.id).maybeSingle());
    for(const [sku,row] of Object.entries(saved?.data?.cart||{}))if(!BAD_SKU.has(sku)&&sku.length>=1&&sku.length<=100&&Number.isSafeInteger(row?.qty)&&row.qty>0&&row.qty<=1000000)baseCart[sku]={qty:row.qty};
   }
   const row=await query(table('buyer_offers').insert({actor_id:user.id,buyer_name:buyer.name,buyer_phone:buyer.phone,markup_percent:setup.markupPercent,price_category:priceCategory,source,base_cart:baseCart}).select('id,buyer_name,buyer_phone').single());
   return json({id:row.id,buyer});
  }
  const offer=await ownedOffer(input.id);
  if(action==='resume'){
   requireUnexpired(offer);
   const common={id:offer.id,buyer:{name:offer.buyer_name,phone:offer.buyer_phone},source:offer.source,transferred:offer.state==='handed_off'};
   if(offer.state!=='draft')return json({...common,phase:'final',offer:publicOffer(offer)});
   return json({...publicBuyerCatalog(c,await current(),offer),...common,phase:'browse'});
  }
  if(action==='export'){
   if(offer.state==='draft')fail(409,'Նախ կազմեք առաջարկը։');
   return new Response(buyerOfferWorkbook(publicOffer(offer)),{headers:{...c.headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="ZIGZAG-Offer-'+readableNumber(offer)+'.xlsx"','Cache-Control':'no-store'}});
  }
  if(action==='handoff'){
   if(!UUID.test(input.requestId||''))throw invalid('Ստուգեք գործողության նույնացուցիչը։');
   // This is the only response containing employee-only calculated profit/cart costs.
   return json(await rpc('zzws_handoff_buyer_offer',{p_actor:user.id,p_offer:offer.id,p_request:input.requestId}));
  }
  if(action==='finalize'&&offer.state!=='draft'){
   const rows=buyerInputLines(input.lines);
   if(offer.finalize_request!==input.requestId||JSON.stringify(buyerInputLines(offer.request_lines))!==JSON.stringify(rows))fail(409,'Առաջարկն արդեն կազմված է։ Բացեք պահպանված տարբերակը։');
   return json(publicOffer(offer));
  }
  if(offer.state!=='draft'||Date.parse(offer.expires_at)<=Date.now())fail(409,'Աշխատանքային շրջանն ավարտված է։ Կրկին բացեք գնորդի ռեժիմը։');
  const v=await current();
  if(action==='details'){
   if(!Array.isArray(input.articuls)||!input.articuls.length||input.articuls.length>4||input.articuls.some(id=>typeof id!=='string'||!id||id.length>100))throw invalid('Ընտրեք մեկից չորս ապրանք։');
   const bySku=new Map(productsFor(c,v,offer).map(row=>[row.product.articul,row.product])),items=[];
   for(const id of new Set(input.articuls)){const p=bySku.get(id);if(!p)fail(404,'Ապրանքը հասանելի չէ։');items.push(buyerPublicDetails(p,productDetails(p,c.knowledge||{products:{}})));}
   return json({items});
  }
  if(action==='catalog'){
   return json(publicBuyerCatalog(c,v,offer));
  }
  const rows=buyerInputLines(input.lines),quote=quoteFor(c,v,offer,rows);
  if(action==='quote')return json({id:offer.id,lines:quote.lines,total:quote.total});
  if(!UUID.test(input.requestId||''))throw invalid('Ստուգեք գործողության նույնացուցիչը։');
  const result=await rpc('zzws_finalize_buyer_offer',{p_actor:user.id,p_offer:offer.id,p_request:input.requestId,p_input:rows,p_public:quote.lines,p_internal:quote.internal,p_catalog:v.id,p_rules:v.rulesRevision,p_profile:user.profileRevision,p_total:quote.total,p_profit:quote.expectedProfit});
  return json(publicOffer(result));
 }catch(error){if(error.status)throw error;fail(error.code||400,error.message||'Ստուգեք առաջարկի տվյալները։');}
}
