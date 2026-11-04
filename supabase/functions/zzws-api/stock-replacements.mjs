import {validPriceCategory,projectedCategoryPrice} from './price-categories.mjs';
import {technicalFacts} from './dealer.mjs';
import {knowledgeProduct} from './assistant.mjs';

// Read-only replacement policy for a single zero-allocated list row. This is
// separate from the existing cart/order replacement policy.
const norm=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const numeric=['width','height','depth','nicheWidth','nicheHeight','nicheDepth','capacity','volume','placeSettings','diagonal'];
const extra=['spin','inverter','noFrost','resolution','screen','energy'];
const schemas={washer:['capacity','drying','installation','subtype'],dryer:['capacity','installation','subtype'],fridge:['volume','noFrost','installation','subtype'],dishwasher:['placeSettings','installation'],tv:['diagonal','resolution','screen'],oven:['volume','connection','installation'],hob:['connection','installation'],hood:['installation','subtype'],microwave:['volume','installation','subtype']};
const hard=new Set(['type','subtype','installation','connection','drying']);
const stringFields=new Set(['subtype','installation','connection','resolution','screen']);
const boolFields=new Set(['drying','inverter','noFrost']);
const aliases={
 installation:[
  ['built_in',['built in','builtin','integrated','ներկառուցվող','встраиваемый','встраиваемая','встраиваемое']],
  ['freestanding',['free standing','freestanding','առանձին կանգնած','отдельностоящий','отдельностоящая','отдельностоящее']],
  ['wall_mounted',['wall','wall mounted','wall mount','настенный','настенная','պատի']],
  ['ceiling_mounted',['ceiling','ceiling mounted','потолочный','потолочная','առաստաղային']],
  ['island',['island','островной','островная','կղզյակային']],
  ['countertop',['countertop','table top','tabletop','настольный','настольная','սեղանի']]
 ],
 connection:[
  ['gas',['gas','gas hob','gas cooktop','gas oven','газ','газовый','газовая','газовое','газовая варочная панель','газовая духовка','գազ','գազային','գազային եփման վահանակ']],
  ['electric',['electric','electrical','electric hob','electrical hob','electric cooktop','electric oven','электрический','электрическая','электрическое','электрическая варочная панель','электрическая духовка','էլեկտրական','էլեկտրական եփման վահանակ']],
  ['induction',['induction','induction hob','induction cooktop','индукционный','индукционная','индукционное','индукционная варочная панель','ինդուկցիոն','ինդուկցիոն եփման վահանակ']],
  ['combined',['combined','combination','mixed','gas electric','gas electrical','gas and electric','gas electric hob','gas and electric hob','gaselectric','комбинированный','комбинированная','комбинированное','газоэлектрическая','газовая и электрическая','համակցված','գազաէլեկտրական','գազ և էլեկտրական']]
 ],
 subtype:[
  ['front',['front','front load','front loading','фронтальная','фронтальный','фронтальная загрузка','առջևի','առջևի բեռնում']],
  ['top',['top','top load','top loading','вертикальная','вертикальный','вертикальная загрузка','վերևի','վերևից բեռնում']]
 ]
};
const canonicalAliases=Object.fromEntries(Object.entries(aliases).map(([key,groups])=>[key,new Map(groups.flatMap(([value,words])=>[value,...words].map(word=>[norm(word),value])))]));
export function stockReplacementRequirements(type){
 if(!Object.hasOwn(schemas,type))return [];
 const required=new Set(['width','height','depth',...schemas[type]]);
 return [...new Set([...required,'subtype','nicheWidth','nicheHeight','nicheDepth','inverter'])].map(key=>({key,type:numeric.includes(key)?'number':boolFields.has(key)?'boolean':'string',required:required.has(key),...(numeric.includes(key)?{unit:key==='capacity'?'kg':key==='volume'?'l':key==='diagonal'?'inch':key==='placeSettings'?'sets':'cm'}:{})}));
}
export function validateStockReplacementInput(p){
 const sku=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=100;
 const qty=v=>Number.isSafeInteger(v)&&v>0&&v<=999999;
 if(!p||typeof p!=='object'||Array.isArray(p)||!sku(p.sourceArticul)||!qty(p.qty)||!Array.isArray(p.rows)||p.rows.length>4000||p.rows.some(r=>!r||!sku(r.articul)||!qty(r.qty)))throw Object.assign(Error('Ստուգեք ապրանքն ու ցանկի քանակները։'),{code:400});
 if(p.includeLast!=null&&typeof p.includeLast!=='boolean'||p.sameBrand!=null&&typeof p.sameBrand!=='boolean'||p.priceMode!=null&&!validPriceCategory(p.priceMode)||p.maxPrice!=null&&(!Number.isFinite(p.maxPrice)||p.maxPrice<=0||p.maxPrice>1e12)||p.candidateArticul!=null&&!sku(p.candidateArticul))throw Object.assign(Error('Ստուգեք փոխարինման պայմանները։'),{code:400});
 const manual=p.manualRequirements??{};
 if(!manual||typeof manual!=='object'||Array.isArray(manual)||Object.keys(manual).length>4||Object.entries(manual).some(([key,value])=>numeric.includes(key)?!Number.isFinite(value)||value<=0||value>100000:boolFields.has(key)?typeof value!=='boolean':stringFields.has(key)?typeof value!=='string'||!value.trim()||value.length>100:true))throw Object.assign(Error('Նշեք մինչև չորս հստակ պահանջ։'),{code:400});
 const modes=p.manualModes??{};
 if(!modes||typeof modes!=='object'||Array.isArray(modes)||Object.keys(modes).length>4||Object.entries(modes).some(([key,value])=>!numeric.includes(key)||!Object.hasOwn(manual,key)||!['min','max','exact'].includes(value)))throw Object.assign(Error('Ստուգեք թվային պահանջների սահմանները։'),{code:400});
 return {sourceArticul:p.sourceArticul,qty:p.qty,rows:p.rows.map(r=>({articul:r.articul,qty:r.qty})),includeLast:p.includeLast===true,priceMode:p.priceMode||'WS',sameBrand:p.sameBrand===true,...(p.maxPrice!=null?{maxPrice:p.maxPrice}:{}),manualRequirements:{...manual},manualModes:Object.fromEntries(Object.keys(manual).filter(key=>numeric.includes(key)).map(key=>[key,modes[key]||'exact'])),...(p.candidateArticul?{candidateArticul:p.candidateArticul}:{})};
}

// Kept behaviorally identical to js/warehouse-allocation.js. Differential tests
// cover main-warehouse priority, single-main fulfillment and shop leveling.
export function stockReplacementStocks(product){
 const value=String(product._stockStatus??product.stockStatus??'').trim(),out={};
 if(!value)return out;
 for(const entry of value.split(',')){
  const match=entry.trim().match(/^(\d{3}):\s*(\d+)$/);if(!match||Object.hasOwn(out,match[1]))return {};
  const qty=Number(match[2]);if(!Number.isSafeInteger(qty))return {};out[match[1]]=qty;
 }return out;
}
function take(pool,quantity,priority,includeLast){
 let need=quantity;const allocations=[];
 const single=priority.find(code=>(pool[code]||0)>=need);
 for(const code of single?[single]:priority){const qty=Math.min(need,pool[code]||0);if(qty){allocations.push({warehouse:code,quantity:qty});pool[code]-=qty;need-=qty;}if(!need)break;}
 if(need){
  const reserve=includeLast?0:1,shops=Object.keys(pool).filter(code=>!priority.includes(code)&&pool[code]>reserve).sort((a,b)=>pool[b]-pool[a]||a.localeCompare(b));
  const amount=shops.reduce((sum,code)=>Math.min(need,sum+Math.min(need,pool[code]-reserve)),0);
  if(amount){
   let low=reserve,high=pool[shops[0]];
   while(low<high){const mid=low+Math.floor((high-low)/2);let removed=0;for(const code of shops){removed+=Math.min(amount+1,Math.max(0,pool[code]-mid));if(removed>amount)break;}if(removed>amount)low=mid+1;else high=mid;}
   const picked=new Map();let extra=amount;
   for(const code of shops){const qty=Math.max(0,pool[code]-low);picked.set(code,qty);extra-=qty;}
   for(const code of [...shops].sort()){if(!extra)break;if(pool[code]>=low&&pool[code]-picked.get(code)>reserve){picked.set(code,picked.get(code)+1);extra--;}}
   for(const code of shops){const qty=picked.get(code);if(qty){allocations.push({warehouse:code,quantity:qty});pool[code]-=qty;need-=qty;}}
  }
 }
 return {allocated:quantity-need,shortage:need,allocations};
}
function inventory(rows,products,priority,includeLast){
 if(!Array.isArray(priority)||priority.some(code=>typeof code!=='string'||!/^\d{3}$/.test(code))||new Set(priority).size!==priority.length)throw Object.assign(Error('Պահեստների կարգավորումները հասանելի չեն։'),{code:409});
 const bySku=new Map(products.map(p=>[p.articul,p])),remaining=new Map();
 const results=rows.map(row=>{const product=bySku.get(row.articul);if(!product)return {...row,allocated:0,shortage:row.qty,allocations:[]};if(!remaining.has(row.articul))remaining.set(row.articul,stockReplacementStocks(product));return {...row,...take(remaining.get(row.articul),row.qty,priority,includeLast)};});
 return {results,pool:product=>({...remaining.get(product.articul)||stockReplacementStocks(product)})};
}
export function allocateStockReplacementRows(rows,products,{priority,includeLast=false}={}){return inventory(rows,products,priority,includeLast).results;}
function canonical(key,value){
 if(value==null||value==='')return null;
 if(typeof value!=='string')return value;
 const text=norm(value);
 if(!text||['unknown','unconfirmed','not specified','not available','n a','other','неизвестно','неизвестный','не указано','прочее','անհայտ','չի նշվում'].includes(text))return null;
 if(Object.hasOwn(canonicalAliases,key))return canonicalAliases[key].get(text)??(key==='subtype'?text:null);
 return text;
}
function facts(product,knowledge){
 const verified=technicalFacts(product,knowledge),known=verified.verified&&Number.isFinite(Date.parse(verified.checkedAt));
 const out={type:verified.type};
 if(known){for(const[key,value]of Object.entries(verified))if(!['dimensions','niche','verified','sourceUrl','checkedAt'].includes(key))out[key]=value;for(const key of ['width','height','depth']){out[key]=verified.dimensions[key]??null;out['niche'+key[0].toUpperCase()+key.slice(1)]=verified.niche[key]??null;}}
 if(known){
  const patterns={washer:/^loading (?:type|method)$|^load type$|^тип загрузки$|^բեռնման տեսակ$/i,dryer:/^drying (?:type|technology|system)$|^тип сушки$/i,fridge:/^refrigerator type$|^fridge type$|^тип холодильника$/i,hood:/^hood type$|^тип вытяжки$/i,microwave:/^microwave type$|^тип микроволновой печи$/i};
  const pattern=patterns[out.type];if(pattern)out.subtype=knowledgeProduct(product,knowledge).specifications.find(s=>pattern.test(s.name))?.value??null;
 }
 return {values:out,sourceType:known?'verified_snapshot':'unverified',sourceUrl:known?verified.sourceUrl:null,checkedAt:known?verified.checkedAt:null};
}
function compare(source,target,requirements,manual,modes){
 const required=new Set(requirements.filter(r=>r.required).map(r=>r.key));
 if(canonical('installation',source.installation)==='built_in')for(const key of ['nicheWidth','nicheHeight','nicheDepth'])required.add(key);
 const same=[],differences=[],missing=[];
 for(const key of new Set([...required,'type','subtype',...extra])){
  const before=source[key],after=target[key],a=canonical(key,before),b=canonical(key,after);
  if(a==null||b==null){if(required.has(key)||a!=null)missing.push(key);continue;}
  const equal=typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<=.01:a===b;
  if(!equal&&hard.has(key))return null;
  (equal?same:differences).push({key,before,after});
 }
 for(const[key,before]of Object.entries(manual)){
  const after=target[key],a=canonical(key,before),b=canonical(key,after);
  if(a==null||b==null){missing.push('manual.'+key);continue;}
  if(typeof a==='number'&&typeof b==='number'){
   const mode=modes[key]||'exact';if(mode==='min'?b<a-.01:mode==='max'?b>a+.01:Math.abs(a-b)>.01)return null;
  }else if(a!==b)return null;
 }
 return {same,differences,missing:[...new Set(missing)]};
}
export function suggestStockReplacements(source,products,knowledge,{qty,rows=[],priority,includeLast=false,priceMode='WS',sameBrand=false,maxPrice,manualRequirements={},manualModes={},candidateArticul,admin=false}={}){
 const sourceFacts=facts(source,knowledge),requirements=stockReplacementRequirements(sourceFacts.values.type).map(r=>canonical('installation',sourceFacts.values.installation)==='built_in'&&r.key.startsWith('niche')?{...r,required:true}:r),price=p=>{const value=admin?projectedCategoryPrice(p,priceMode):Number(p.wholesale);return Number.isFinite(value)&&value>0?value:null;};
 const sourceDTO={articul:source.articul,name:source.name,price:price(source),sourceType:sourceFacts.sourceType,sourceUrl:sourceFacts.sourceUrl,checkedAt:sourceFacts.checkedAt};
 const modes=Object.fromEntries(Object.keys(manualRequirements).filter(key=>numeric.includes(key)).map(key=>[key,manualModes[key]||'exact']));
 const base={source:sourceDTO,requirements,manualRequirements,manualModes:modes,manualRequirementsSource:'user_request',quantityConfirmed:admin,candidates:[]};
 // Clients retain the existing binary catalogue contract. Quantity probes must
 // not turn this read-only endpoint into an oracle for private warehouse counts.
 const stock=admin?inventory(rows,products,priority,includeLast):null;
 if(admin?take(stock.pool(source),qty,priority,includeLast).allocated>0:source.stockAvailable===true)return {...base,reason:'source_available'};
 if(!requirements.length)return {...base,reason:'unsupported'};
 if(Object.keys(manualRequirements).some(key=>!requirements.some(r=>r.key===key)))throw Object.assign(Error('Այս կատեգորիայի համար պահանջն անհայտ է։'),{code:400});
 const candidates=[];
 const excluded=new Set(rows.map(row=>row.articul));
 for(const product of products){
  if(product.articul===source.articul||excluded.has(product.articul)||candidateArticul&&product.articul!==candidateArticul||norm(source.category)!==norm(product.category)||sameBrand&&norm(source.brand)!==norm(product.brand)||!admin&&product.stockAvailable!==true)continue;
  const unit=price(product);if(unit==null||maxPrice!=null&&unit>maxPrice)continue;
  const target=facts(product,knowledge);if(target.values.type!==sourceFacts.values.type)continue;
  const comparison=compare(sourceFacts.values,target.values,requirements,manualRequirements,modes);if(!comparison)continue;
  const pool=admin?stock.pool(product):null,allocation=admin?take(pool,qty,priority,includeLast):null;if(admin&&!allocation.allocated)continue;
  const matchGroup=sourceFacts.sourceType!=='verified_snapshot'||target.sourceType!=='verified_snapshot'||comparison.missing.length?'insufficient':comparison.differences.length?'differences':'verified';
  candidates.push({articul:product.articul,name:product.name,brand:product.brand,price:unit,priceDifference:price(source)==null?null:unit-price(source),matchGroup,comparison,sourceType:target.sourceType,sourceUrl:target.sourceUrl,checkedAt:target.checkedAt,quantityConfirmed:admin,...(admin?{requestedQty:qty,availableQty:allocation.allocated+Object.entries(pool).reduce((sum,[code,count])=>sum+Math.max(0,count-(priority.includes(code)||includeLast?0:1)),0),offeredQty:allocation.allocated,shortage:allocation.shortage,allocations:allocation.allocations}:{}),manualRequirements,manualModes:modes,manualRequirementsSource:'user_request'});
 }
 const order={verified:0,differences:1,insufficient:2};
 candidates.sort((a,b)=>order[a.matchGroup]-order[b.matchGroup]||(admin?Number(a.shortage>0)-Number(b.shortage>0):0)||a.comparison.differences.length-b.comparison.differences.length||Math.abs(a.priceDifference??a.price)-Math.abs(b.priceDifference??b.price)||a.articul.localeCompare(b.articul));
 return {...base,reason:candidates.length?'ok':'no_candidates',candidates:candidates.slice(0,6)};
}
