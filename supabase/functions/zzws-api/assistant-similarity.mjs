import {applianceProfile,labelFor} from './appliance-taxonomy.mjs';
// SEARCH bands, not installation tolerances or an assertion of interchangeability.
export const SIMILARITY_POLICY={
 washer:{required:['capacity','loading'],metrics:{capacity:{absolute:1,weight:4},spin:{absolute:200,weight:1}},dimensions:{width:1,height:2,depth:3}},
 dryer:{required:['capacity'],metrics:{capacity:{absolute:1,weight:4}},dimensions:{width:1,height:2,depth:3}},
 fridge:{required:['volume','kind'],metrics:{volume:{relative:.15,weight:4}},dimensions:{width:5,height:10,depth:5}},
 freezer:{required:['volume'],metrics:{volume:{relative:.15,weight:4}},dimensions:{width:5,height:10,depth:5}},
 dishwasher:{required:['places'],metrics:{places:{absolute:2,weight:4}},dimensions:{width:1,height:2,depth:3}},
 tv:{required:['diagonal','resolution'],metrics:{diagonal:{relative:.10,absolute:5,weight:5}},dimensions:{}},
 oven:{required:['volume'],metrics:{volume:{relative:.15,weight:3}},dimensions:{width:1,height:1,depth:2}},
 microwave:{required:['volume'],metrics:{volume:{relative:.20,weight:3}},dimensions:{width:3,height:2,depth:3}},
 hob:{required:['connection','burners'],metrics:{},dimensions:{width:1,depth:1}},
 hood:{required:[],metrics:{},dimensions:{width:1,depth:3,height:5}},
 vacuum:{required:['kind'],metrics:{suctionPa:{relative:.20,weight:3}},dimensions:{}},coffee:{required:['kind'],metrics:{volume:{relative:.20,weight:1}},dimensions:{width:3,height:5,depth:5}},
 kettle:{required:['volume'],metrics:{volume:{relative:.20,weight:3}},dimensions:{}},
 blender:{required:['kind'],metrics:{volume:{relative:.20,weight:2}},dimensions:{}},
 laptop:{required:['processor','memoryGB','storageGB'],metrics:{diagonal:{absolute:1,weight:3},memoryGB:{relative:.5,weight:4},storageGB:{relative:.5,weight:3}},dimensions:{}},
 aircon:{required:['kind'],metrics:{},dimensions:{}},iron:{required:[],metrics:{},dimensions:{}},steamer:{required:[],metrics:{},dimensions:{}},steamGenerator:{required:[],metrics:{},dimensions:{}}
};
const names={capacity:['Բեռնվածք','Загрузка','Load'],volume:['Ծավալ','Объём','Volume'],places:['Հավաքածուներ','Комплектов','Place settings'],diagonal:['Անկյունագիծ','Диагональ','Diagonal'],spin:['Քամում','Отжим','Spin'],price:['Գին','Цена','Price'],width:['Լայնություն','Ширина','Width'],height:['Բարձրություն','Высота','Height'],depth:['Խորություն','Глубина','Depth'],memoryGB:['RAM','ОЗУ','RAM'],storageGB:['Հիշողություն','Накопитель','Storage'],suctionPa:['Ներծծում','Всасывание','Suction']};
const unit={capacity:'kg',volume:'l',places:'sets',diagonal:'″',spin:'rpm',memoryGB:'GB',storageGB:'GB',suctionPa:'Pa',price:'AMD',width:'cm',height:'cm',depth:'cm'};
const featureNames={noFrost:['No Frost','No Frost','No Frost'],grill:['Գրիլ','Гриль','Grill'],convection:['Կոնվեկցիա','Конвекция','Convection'],steam:['Գոլորշի','Пар','Steam'],iceMaker:['Սառույցի գեներատոր','Льдогенератор','Ice maker'],waterDispenser:['Ջրի դիսպենսեր','Диспенсер воды','Water dispenser'],heatPump:['Ջերմային պոմպ','Тепловой насос','Heat pump'],autoDose:['Ավտոմատ չափաբաժին','Автодозировка','Auto dosing'],resolution:['Թույլատրություն','Разрешение','Resolution']};
const str=v=>String(v??'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const resolution=v=>{const nums=String(v??'').match(/\d+/g)?.map(Number);return nums?.length===2?Math.max(...nums)*Math.min(...nums):null;};
export const wantsSimilar=message=>/\banalog\b|poxoj|pohozh|zamena|vmesto|аналог|похож|подобн|замен[ауи]|вместо|similar|alternative|replacement|replace|նման|փոխարին|համարժեք/i.test(message);
export function similaritySource(source,details){
 const profile=applianceProfile(source,details),policy=SIMILARITY_POLICY[profile.family];
 const missing=!policy?['category']:policy.required.filter(key=>profile[key]==null);
 if(!profile.verified)missing.push('verified');
 if(['washer','dryer','fridge','freezer','dishwasher','oven','microwave','hob','hood'].includes(profile.family)&&!profile.installation)missing.push('installation');
 if(profile.installation==='built_in')for(const axis of ['width','height','depth'])if(!Number.isFinite(profile.niche[axis]))missing.push('niche.'+axis);
 return {profile,policy,missing};
}
export function compareSimilar(source,target,sourcePrice,targetPrice,{budgetMax,priceBand=.20,toleranceScale=1}={}){
 const {profile:a,policy,missing}=source,b=target;
 if(!policy||missing.length)return {accepted:false,missing};
 if(a.family!==b.family||!b.verified)return {accepted:false};
 // Category/function, utility connection and form factor cannot be traded for price.
 for(const key of ['kind','installation','connection','loading','drying','hinge','burnerLayout','processor','graphics','storageType'])if(a[key]!=null&&(b[key]==null||str(a[key])!==str(b[key])))return {accepted:false,missing:b[key]==null?[key]:[]};
 if(a.refreshRate!=null&&(b.refreshRate==null||b.refreshRate<a.refreshRate))return {accepted:false};
 if(a.family==='laptop'&&(b.memoryGB<a.memoryGB||b.storageGB<a.storageGB))return {accepted:false};
 if(a.capsuleSystem){const systems=v=>String(v).split(/[,/]/).map(s=>str(s).replace(/^nespressov(?:ertuo)?$/,'nespressovertuo'));if(!b.capsuleSystem||!systems(a.capsuleSystem).every(s=>systems(b.capsuleSystem).includes(s)))return {accepted:false};}
 if(a.wetCleaning===true&&b.wetCleaning!==true)return {accepted:false};
 if(a.family==='tv'&&a.panel&&(!b.panel||str(a.panel)!==str(b.panel)))return {accepted:false};
 if(a.family==='hob'&&a.burners!=null&&a.burners!==b.burners)return {accepted:false};
 if(a.noFrost===true&&b.noFrost!==true)return {accepted:false};
 for(const field of ['grill','convection','steam','iceMaker','waterDispenser','heatPump','autoDose'])if(a[field]===true&&b[field]!==true)return {accepted:false};
 const changes=[];let distance=0,compared=0;
 const change=(field,requested,actual)=>{const delta=Math.round((actual-requested)*1000)/1000;changes.push({field,requested,actual,difference:delta,unit:unit[field],labels:names[field],fromSource:true});};
 if(a.installation==='built_in'){
  for(const axis of ['width','height','depth'])if(!Number.isFinite(b.niche[axis])||Math.abs(a.niche[axis]-b.niche[axis])>.01)return {accepted:false,missing:!Number.isFinite(b.niche[axis])?['niche.'+axis]:[]};
  compared+=3;
 }else for(const [axis,band]of Object.entries(policy.dimensions))if(a.dimensions[axis]!=null){
  if(b.dimensions[axis]==null)return {accepted:false,missing:[axis]};
  const delta=Math.abs(b.dimensions[axis]-a.dimensions[axis]);if(delta>band*toleranceScale+.001)return {accepted:false};
  compared++;distance+=delta/(band||1);if(delta>.01)change(axis,a.dimensions[axis],b.dimensions[axis]);
 }
 for(const key of policy.required)if(b[key]==null)return {accepted:false,missing:[key]};
 for(const [key,rule]of Object.entries(policy.metrics))if(Number.isFinite(a[key])){
  if(!Number.isFinite(b[key]))return {accepted:false,missing:[key]};
  const band=Math.min(rule.absolute??Infinity,rule.relative!=null?a[key]*rule.relative:Infinity)*toleranceScale,delta=Math.abs(b[key]-a[key]);
  if(delta>band+.001)return {accepted:false};compared++;distance+=delta/(band||1)*(rule.weight||1);if(delta>.001)change(key,a[key],b[key]);
 }
 if(a.family==='tv'){
  const ar=resolution(a.resolution),br=resolution(b.resolution);if(!ar||!br||br<ar)return {accepted:false,missing:!br?['resolution']:[]};compared++;
 }
 if(!compared&&Object.keys(policy.metrics).length)return {accepted:false,missing:['comparable_metrics']};
 if(sourcePrice>0&&targetPrice>0&&!budgetMax){const delta=Math.abs(targetPrice-sourcePrice);if(delta>sourcePrice*priceBand+.01)return {accepted:false};distance+=delta/sourcePrice;if(delta>.01)change('price',sourcePrice,targetPrice);}
 const featureChanges=Object.keys(featureNames).filter(key=>a[key]!=null&&b[key]!=null&&a[key]!==b[key]).map(key=>({field:key,before:a[key],after:b[key]}));
 return {accepted:true,kind:changes.some(c=>c.field!=='price')||featureChanges.length?'near':'exact',distance:distance+featureChanges.length*.25,changes,featureChanges,compared};
}
export function similarityReasons(match,lang='ru'){
 const i={hy:0,ru:1,en:2}[lang]??1;
 const value=v=>typeof v!=='boolean'?String(v):lang==='ru'?(v?'да':'нет'):lang==='hy'?(v?'այո':'ոչ'):(v?'yes':'no');
 return [...match.changes.slice(0,5).map(d=>(d.labels?.[i]||d.field)+': '+d.requested+' → '+d.actual+' '+d.unit+' ('+(d.difference>0?'+':'')+d.difference+')'),...(match.featureChanges||[]).map(d=>(featureNames[d.field]?.[i]||d.field)+': '+value(d.before)+' → '+value(d.after))];
}
export function similarityIntro(source,language,{strict=false,budgetMax,price}={}){
 const family=labelFor(source.profile.family,language);
 const i={hy:0,ru:1,en:2}[language]??1,bands=[];
 for(const [key,rule]of Object.entries(source.policy.metrics))if(Number.isFinite(source.profile[key])){const band=strict?0:Math.min(rule.absolute??Infinity,rule.relative!=null?source.profile[key]*rule.relative:Infinity);bands.push((names[key]?.[i]||key)+' ±'+Math.round(band*100)/100+' '+(unit[key]||''));}
 if(source.profile.installation==='built_in')bands.push(language==='hy'?'Խորշի չափերը՝ նույնը':language==='en'?'Same niche dimensions':'Размеры ниши — те же');
 else for(const [key,band]of Object.entries(source.policy.dimensions))if(Number.isFinite(source.profile.dimensions[key]))bands.push((names[key]?.[i]||key)+' ±'+(strict?0:band)+' cm');
 if(price>0&&!budgetMax)bands.push(language==='hy'?'Գին ±20%':language==='en'?'Price ±20%':'Цена ±20%');
 const intro=language==='hy'?'Նույն տեսակի '+family+' եմ փնտրում։ Տարբերությունները նշված են քարտերում։':language==='en'?'Looking for the same type of '+family+'. Differences are listed on each card.':'Подбираю тот же тип товара: '+family+'. Отличия указаны в карточках.';
 const installation=source.profile.installation==='built_in'?(language==='hy'?' Տեղադրումը ստուգեք կոնկրետ մոդելի հրահանգով։':language==='en'?' Check installation against the exact model instructions.':' Монтаж проверьте по инструкции конкретной модели.'):'';
 return intro+' '+bands.join(' · ')+'.'+installation;
}
