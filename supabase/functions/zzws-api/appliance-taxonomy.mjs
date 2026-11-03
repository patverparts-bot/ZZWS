// Product classification uses the catalogue CATEGORY, never a token in a model name.
export const clean=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const FAMILY_LABELS={
 washer:['Լվացքի մեքենա','Стиральная машина','Washing machine'],dishwasher:['Սպասք լվացող մեքենա','Посудомоечная машина','Dishwasher'],dryer:['Չորանոց','Сушильная машина','Dryer'],fridge:['Սառնարան','Холодильник','Fridge'],freezer:['Սառցարան','Морозильник','Freezer'],tv:['Հեռուստացույց','Телевизор','TV'],vacuum:['Փոշեկուլ','Пылесос','Vacuum'],coffee:['Սրճեփ','Кофемашина','Coffee machine'],laptop:['Նոթբուք','Ноутбук','Laptop'],microwave:['Միկրոալիքային վառարան','Микроволновка','Microwave'],oven:['Ջեռոց','Духовой шкаф','Oven'],hob:['Եփող մակերես','Варочная панель','Hob'],hood:['Օդաքարշ','Вытяжка','Cooker hood'],kettle:['Թեյնիկ','Чайник','Kettle'],iron:['Արդուկ','Утюг','Iron'],steamer:['Գոլորշիչ','Отпариватель','Garment steamer'],steamGenerator:['Գոլորշու գեներատոր','Парогенератор','Steam generator'],blender:['Բլենդեր','Блендер','Blender'],mixer:['Հարիչ','Миксер','Mixer'],aircon:['Օդորակիչ','Кондиционер','Air conditioner'],airfryer:['Օդային տապակիչ','Аэрогриль','Air fryer'],hairdryer:['Վարսահարդարիչ','Фен','Hair dryer'],headphones:['Ականջակալ','Наушники','Headphones'],phone:['Սմարթֆոն','Смартфон','Smartphone'],soundbar:['Սաունդբար','Саундбар','Soundbar'],projector:['Պրոյեկտոր','Проектор','Projector'],toaster:['Թոսթեր','Тостер','Toaster'],meatgrinder:['Մսաղաց','Мясорубка','Meat grinder'],juicer:['Հյութաքամիչ','Соковыжималка','Juicer'],waterheater:['Ջրատաքացուցիչ','Водонагреватель','Water heater']};
Object.assign(FAMILY_LABELS,{cooker:['Գազօջախ','Кухонная плита','Cooker'],winecooler:['Գինու մառան','Винный шкаф','Wine cooler'],tablet:['Պլանշետ','Планшет','Tablet'],monitor:['Մոնիտոր','Монитор','Monitor'],speaker:['Բարձրախոս','Колонка','Speaker']});
export const labelFor=(family,language='ru')=>FAMILY_LABELS[family]?.[{hy:0,ru:1,en:2}[language]??1]||family;
export const KIND_LABELS={french_door:['French Door','French Door','French Door'],stovetop:['Ոչ էլեկտրական','Для плиты','Stovetop'],electric:['Էլեկտրական','Электрический','Electric'],fridge_freezer:['Սառցարանով','С морозильником','Fridge freezer'],fridge_only:['Առանց սառցարան','Без морозильника','Fridge only'],wireless:['Անլար','Беспроводные','Wireless'],robot:['Ռոբոտ','Робот','Robot'],cordless:['Անլար','Беспроводной','Cordless'],canister:['Սովորական','Обычный','Canister'],wet:['Լվացող','Моющий','Wet cleaning'],handheld:['Ձեռքի','Ручной','Handheld'],industrial:['Արտադրական','Промышленный','Industrial'],pool_robot:['Լողավազանի ռոբոտ','Робот для бассейна','Pool robot'],capsule:['Կապսուլային','Капсульная','Capsule'],drip:['Կաթիլային','Капельная','Drip'],espresso:['Կիսաավտոմատ','Рожковая','Portafilter'],automatic:['Ավտոմատ','Автоматическая','Automatic'],cezve:['Էլեկտրական սրճեփ','Электротурка','Electric cezve'],manual:['Ոչ էլեկտրական','Неэлектрическая','Manual'],portable:['Շարժական','Переносной','Portable'],stationary:['Ստացիոնար','Стационарный','Stationary'],washer_dryer:['Չորացումով','С сушкой','Washer dryer'],chest:['Հորիզոնական','Ларь','Chest'],upright:['Ուղղահայաց','Вертикальный','Upright'],side_by_side:['Side-by-Side','Side-by-Side','Side-by-Side'],beverage:['Ըմպելիքների','Для напитков','Beverage'],wine:['Գինու','Винный','Wine'],mini:['Մինի','Мини','Mini'],pizza:['Պիցցայի','Для пиццы','Pizza'],split:['Split','Сплит','Split'],multi_split:['Multi-split','Мультисплит','Multi split'],island:['Կղզյակային','Островная','Island'],chimney:['Ծխնելուզային','Каминная','Chimney'],gaming:['Խաղային','Игровые','Gaming'],tws:['TWS','TWS','TWS'],wired:['Լարային','Проводные','Wired']};
export const kindLabel=(kind,language='ru')=>KIND_LABELS[kind]?.[{hy:0,ru:1,en:2}[language]??1]||kind;
// Specific types must precede the broader terms contained in their names.
const families=[
 ['dishwasher',/посудомо|սպասք.*լվա|dishwash/i],['dryer',/сушильн|չորացնող մեքենա|չորանոց$|tumble dryer|drying machine|^dryer$/i],
 ['washer',/стирал|լվացք|washing machine|\bwasher\b/i],['freezer',/морозильн|սառցարան|\bfreezer\b/i],
 ['fridge',/холодильн|холодос|սառնարան|refrigerator|\bfridge\b/i],['microwave',/микроволн|միկրոալիք|microwave/i],
 ['airfryer',/аэрогрил|аэрофрит|օդային|ճարպաջեռոց|air.?fryer/i],['oven',/духов|ջեռոց|վառարան|\boven\b/i],
 ['winecooler',/винн.*шкаф|գինու մառան|wine cooler/i],['hob',/ներկառուցվող.*գազօջախ|варочн|եփող մակերես|եփման|պատրաստման մակերես|cooking surface|\bhob\b|cooktop/i],['hood',/вытяж|օդա[քխ]ար[շք]|օդաքարշ|cooker hood|kitchen hood/i],
 ['cooker',/գազօջախ|газов.*плит|кухонн.*плит|range cooker|^cooker/i],['tablet',/планшет|պլանշետ|tablet/i],['monitor',/монитор|մոնիտոր|monitor/i],['speaker',/колонк|բարձրախոս|speaker/i],['tv',/телевиз|հեռուստացույց|television|\btv\b/i],['projector',/проектор|պրոյեկտոր|projector/i],['soundbar',/саундбар|սաունդբար|soundbar/i],
 ['vacuum',/пылесос|փոշեկուլ|vacuum cleaner|^vacuum$/i],['coffee',/кофемаш|кофевар|սրճեփ|coffee machine|coffee maker/i],
 ['laptop',/ноутбук|նոթբուք|laptop|notebook/i],['steamGenerator',/парогенератор|գոլորշու գեներատոր|steam generator/i],['steamer',/отпарив|գոլո[շրշ]իչ|գոլորշիչ|garment steamer/i],
 ['hairdryer',/(?:^|\s)фен|վարսահարդարիչ|hair.?dryer/i],['iron',/утюг|արդուկ|\biron\b/i],['kettle',/чайник|թեյնիկ|kettle/i],
 ['blender',/блендер|բլենդեր|blender/i],['mixer',/миксер|հարիչ|\bmixer\b/i],['aircon',/кондиционер|օդորակիչ|air conditioner/i],
 ['headphones',/наушник|ականջակալ|headphones|earbuds/i],['phone',/смартфон|սմարթֆոն|smartphone|mobile phone/i],['toaster',/тостер|թոսթեր|toaster/i],['meatgrinder',/мясоруб|մսաղաց|meat grinder/i],['juicer',/соковыжим|հյութաքամիչ|juicer/i],['waterheater',/водонагрев|бойлер|ջրատաքաց|ջրի տաքացում|water heater/i]
];
const accessory=/аксессуар|accessor|պարագա|աքսեսուար|մալուխ|կախիչ|պայուսակ|պարկ և|հեռակառավար|ալեհավաք|սեղան|մաքրող (?:նյութ|միջոց)|cleaning product|креплен|кронштейн|кабел|чехол|пульт|утюжильн.*доск|board|mount|\bstand\b|bag for/i;
const subtypes={
 kettle:[['stovetop',/неэлектр|для плиты|ոչ էլեկտրական|stovetop|non.electric/i],['electric',/электрочайн|электрическ|էլեկտրական|electric kettle/i]],
 fridge:[['french_door',/french.?door|французск|ֆրանսիական/i],['fridge_freezer',/двухкамер|с морозильн|սառցարանով|fridge.freezer/i],['fridge_only',/однокамер|без морозильн|առանց սառցարան|fridge.only/i],['wine',/винн|գինու|wine/i],['beverage',/напитк|ըմպելիք|beverage/i],['portable',/автохолод|переносн|շարժական|portable/i],['side_by_side',/side.?by.?side|сайд.*сайд/i]],
 freezer:[['chest',/ларь|лар[ьи]|chest|հորիզոնական/i],['upright',/шкаф|upright|ուղղահայաց/i]],
 vacuum:[['pool_robot',/լողավազան|бассейн|pool/i],['robot',/робот|ռոբոտ|robot/i],['industrial',/промышлен|строительн|արտադրական|industrial|workshop/i],['wet',/моющ|լվացող|wet/i],['cordless',/беспровод|аккумуляторн|անլար|cordless|stick vacuum/i],['handheld',/ручн|ձեռքի|handheld|мини|մինի/i],['canister',/парк|պարկով|առանց պարկի|bagged|bagless|canister/i]],
 coffee:[['capsule',/капсул|կապսուլ|capsule|pod coffee/i],['drip',/капельн|կաթիլային|drip|filter coffee/i],['espresso',/рожков|полуавтомат|կիսաավտոմատ|semi.?automatic|portafilter/i],['automatic',/автомат|ավտոմատ|bean.to.cup|automatic/i],['cezve',/турк|էլեկտրական սրճեփ|cezve/i],['manual',/ոչ էլեկտրական|неэлектр|manual coffee/i]],
 oven:[['mini',/мини|մինի|mini|countertop/i],['pizza',/пицц|պիցցա|pizza/i]],
 blender:[['handheld',/погружн|ձեռքի|hand blender|immersion/i],['portable',/портатив|շարժական|portable/i],['stationary',/стационар|ստացիոնար|stationary|countertop blender/i]],
 aircon:[['multi_split',/multi.?split|мультисплит/i],['portable',/мобильн|շարժական|portable/i],['split',/сплит|split/i]],
 hood:[['island',/островн|կղզյակ|island/i],['chimney',/каминн|ծխնելուզ|chimney/i]],
 headphones:[['wireless',/беспровод|անլար|wireless/i],['gaming',/игров|խաղային|gaming/i],['tws',/\btws\b/i],['wired',/проводн|լարային|wired/i]],
 washer:[['washer_dryer',/с суш|չորանոցներով|washer.?dryer/i]]
};
export const VALID_KINDS=new Set(Object.values(subtypes).flatMap(rows=>rows.map(([key])=>key)));
const translit={holodilnik:'холодильник',xolodilnik:'холодильник',stiralka:'стиральная машина',stiralnaya:'стиральная',posudomoyka:'посудомоечная машина',posudomoechnaya:'посудомоечная',pilesos:'пылесос',pylesos:'пылесос',vstraivaemiy:'встраиваемый',vstraivaemyj:'встраиваемый',vstraivaemyy:'встраиваемый',duhovka:'духовой шкаф',duxovka:'духовой шкаф',kofemashina:'кофемашина',morozilnik:'морозильник',televizor:'телевизор',analog:'аналог',pohozhiy:'похожий',poxojiy:'похожий',podberi:'подбери',sushilnaya:'сушильная'};
export const queryText=message=>String(message).replace(/\b[a-z]+\b/gi,word=>translit[word.toLowerCase()]||word);
export function categoryIntent(message){
 const text=queryText(message),family=families.find(([,pattern])=>pattern.test(text))?.[0];
 const result={};if(family)result.category=family;
 if(family){const kind=subtypes[family]?.find(([,pattern])=>pattern.test(text))?.[0];if(kind)result.kind=kind;}
 if(/встраива|встроенн|ներկառուց|built[ -]?in|integrated/i.test(text))result.builtIn=true;
 if(/отдельно[ -]?стоящ|անկախ տեղադրմամբ|առանձին կանգնած|free[ -]?standing/i.test(text))result.builtIn=false;
 if(/вертикальн.*загруз|top.?load|վերևից.*բեռն/i.test(text))result.loading='top';
 else if(/фронтальн|front.?load|առջևի.*բեռն/i.test(text))result.loading='front';
 if(/индукци|ինդուկց|induction/i.test(text))result.connection='induction';
 else if(/комбинирован|համակցված|combined|gas.*electric/i.test(text))result.connection='combined';
 else if(/газов|գազային|\bgas\b/i.test(text))result.connection='gas';
 else if(/электрическ|էլեկտրական|\belectric\b/i.test(text))result.connection='electric';
 if(family&&!['hob','oven','cooker'].includes(family))delete result.connection;
 return result;
}
const categoryCache=new Map();
export function classifyCategory(category){const key=String(category||'');if(categoryCache.has(key))return categoryCache.get(key);const result=Object.freeze(classifyUncached(key));if(categoryCache.size>=4096)categoryCache.clear();categoryCache.set(key,result);return result;}
function classifyUncached(category){
 const text=String(category||'');if(accessory.test(text))return {family:'accessory',kind:null};
 const intent=categoryIntent(text),family=intent.category||'other';let kind=intent.kind||null;
 if(family==='iron'&&/մազ|волос|hair/i.test(text))return {family:'other',kind:'hair_straightener'};
 let installation=intent.builtIn===true?'built_in':intent.builtIn===false?'freestanding':null;
 // These are exact, separate catalogue classes, rather than a guess from the model name.
 if(!installation&&/^(?:Սառնարաններ|Սառցարաններ|Լվացքի մեքենաներ(?: չորանոցներով)?|Սպասք լվացող մեքենաներ|Չորացնող մեքենաներ)$/i.test(text))installation='freestanding';
 if(family==='vacuum'&&!kind&&/^(?:пылесос|vacuum|vacuum cleaner)$/i.test(text))kind='canister';
 return {family,kind,installation,connection:intent.connection||null,loading:intent.loading||null};
}
const raw=(specs,re)=>specs.find(s=>re.test(s.name))?.value;
const scalar=value=>{const text=String(value??'').trim().replace(',','.');return /^\d+(?:\.\d+)?\s*(?:l|л|լ|kg|кг|կգ|rpm|["″]|inch(?:es)?|sets?|w|db|hz|gb|tb|pa|bar)?$/i.test(text)?parseFloat(text):null;};
export function readDimensions(specs,niche=false){
 const out={};for(const s of specs||[]){const isNiche=/embedding|niche|cut.?out|opening|монтаж|ниш|խորշ/i.test(s.name);if(isNiche!==niche||/pack|shipping|carton|упаков/i.test(s.name))continue;
  const text=s.name+' '+s.value,scale=/\bmm\b|мм|մմ/i.test(text)?.1:/\bcm\b|см|սմ/i.test(text)?1:null;if(scale==null)continue;
  const nums=String(s.value).replace(/,/g,'.').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
  if(nums.length===1)for(const [key,re]of [['width',/^width|^ширина|^լայնու/i],['height',/^height|^высота|^բարձրու/i],['depth',/^depth|^глубина|^խորու/i]])if(re.test(s.name))out[key]=nums[0]*scale;
  const order=s.name.replace(/[\s()]/g,'').match(/([hwd])[x×х]([hwd])[x×х]([hwd])/i);
  if(order&&new Set(order.slice(1).map(x=>x.toLowerCase())).size===3&&nums.length===3)order.slice(1).forEach((x,i)=>out[{h:'height',w:'width',d:'depth'}[x.toLowerCase()]]=nums[i]*scale);
 }return out;
}
export function applianceProfile(p,details){
 const specs=details?.specifications||[],base=p._taxonomy||classifyCategory(p.category),profile={...base,verified:details?.status==='verified',dimensions:readDimensions(specs),niche:readDimensions(specs,true)};
 const installation=String(raw(specs,/^installation(?: type)?$|^type$/i)||'');
 if(/built[ -]?in|integrated|встраива|ներկառուց/i.test(installation)||specs.some(s=>/embedding|niche dimensions/i.test(s.name)))profile.installation='built_in';
 else if(/free[ -]?standing|отдельно.?стоящ/i.test(installation))profile.installation='freestanding';
 const loading=String(raw(specs,/^loading$|load(?:ing)? type|^type$|загрузки|բեռնման/i)||'');if(/top|вертик|վերև/i.test(loading))profile.loading='top';else if(/front|фронт|առջև/i.test(loading))profile.loading='front';
 const connection=categoryIntent(String(raw(specs,/^hob type$|^oven type$|^type of connection$/i)||''));if(connection.connection)profile.connection=connection.connection;
 profile.capacity=scalar(raw(specs,/load capacity.*kg|^capacity.*kg|загрузка/i));profile.volume=scalar(raw(specs,/^total volume|^total capacity|^oven capacity|^capacity.*\(l\)|^volume.*\(l\)/i));
 profile.places=scalar(raw(specs,/maximum capacity.*set|place settings/i));profile.diagonal=scalar(raw(specs,/^diagonal$|^screen size/i));profile.spin=scalar(raw(specs,/spin speed/i));profile.burners=scalar(raw(specs,/number of (?:(?:induction |electric ceramic )?burners|zones|cooking zones)|конфорок/i));
 const burnerText=String(raw(specs,/^number of burners$/i)||'');if(/^\d+\s*\+\s*\d+$/.test(burnerText)){profile.burners=burnerText.split('+').reduce((sum,n)=>sum+Number(n),0);profile.burnerLayout=burnerText.replace(/\s/g,'');}
 profile.hinge=raw(specs,/hinge (?:type|system)|door mounting/i)||null;profile.refreshRate=scalar(raw(specs,/refresh rate|частота обновления/i));const power=raw(specs,/^power(?: \(w\))?$|rated power|connected load/i);profile.powerW=scalar(String(power??'').replace(/kw/i,'w'));if(profile.powerW&&/kw/i.test(String(power)))profile.powerW*=1000;
 profile.processor=raw(specs,/^processor$|^processor model$|^cpu$/i)||null;profile.graphics=raw(specs,/graphics (?:card|processor)|^gpu$/i)||null;profile.storageType=raw(specs,/storage type|drive type/i)||null;
 profile.memoryGB=scalar(raw(specs,/^ram(?: capacity)?(?: \(gb\))?$|^memory \(ram\)$/i));const storage=raw(specs,/storage capacity|^internal memory|^ssd.*capacity|^storage \(gb\)/i);profile.storageGB=scalar(storage);if(profile.storageGB&&/tb/i.test(String(storage)))profile.storageGB*=1024;
 profile.capsuleSystem=raw(specs,/capsules? type|capsule system/i)||null;profile.wetCleaning=raw(specs,/wet cleaning|mopping/i)==null?null:/yes|да|այո/i.test(String(raw(specs,/wet cleaning|mopping/i)));
 profile.suctionPa=scalar(raw(specs,/suction.*\(pa\)/i));
 profile.resolution=raw(specs,/^resolution/i)||null;profile.panel=raw(specs,/^screen type$|^panel type$/i)||null;
 const drying=String(raw(specs,/^drying$|^drying function$|maximum loading for drying|drying capacity/i)??'');profile.drying=profile.kind==='washer_dryer'||/^(?:yes|да|այո)$/i.test(drying)||scalar(drying)>0?true:/^(?:no|нет|ոչ|0)$/i.test(drying)?false:profile.family==='washer'&&/^(?:Լվացքի մեքենաներ|Washing machines?|Washer)$/i.test(p.category||'')?false:null;
 const zones=specs.filter(s=>/^(refrigerator|freezer|freezing system|cooling system)$/i.test(s.name));profile.noFrost=zones.length?zones.every(s=>/no\s*frost/i.test(s.value)):null;
 for(const [key,pattern]of Object.entries({grill:/^grill$/i,convection:/^convection$/i,steam:/^steam|steam function/i,iceMaker:/ice maker|icemaker/i,waterDispenser:/water dispenser/i,heatPump:/heat pump/i,autoDose:/auto.*dos|i.?dos/i})){const v=raw(specs,pattern);profile[key]=v==null?null:/^(yes|true|да|այո|1)$/i.test(String(v))?true:/^(no|false|нет|ոչ|0)$/i.test(String(v))?false:null;}
 if(profile.family==='fridge'&&!profile.kind){const freeze=scalar(raw(specs,/^freezer volume/i)),freezeType=raw(specs,/^freezer$/i);if(freeze>0)profile.kind='fridge_freezer';else if(freeze===0||/^(?:no|нет|ոչ)$/i.test(String(freezeType)))profile.kind='fridge_only';}
 if(profile.family==='fridge'&&!profile.kind){const layout=String(raw(specs,/^type$|refrigerator type|fridge type/i)||'');if(/side.?by.?side/i.test(layout))profile.kind='side_by_side';else if(/french.?door/i.test(layout))profile.kind='french_door';}
 return profile;
}
export function categoryAccepts(state,profile){
 if(profile.family!==state.category||['other','accessory'].includes(profile.family))return false;
 if(state.kind&&profile.kind!==state.kind)return false;
 if(!state.kind&&state.category==='fridge'&&['wine','beverage','portable'].includes(profile.kind))return false;
 if(!state.kind&&state.category==='oven'&&['mini','pizza'].includes(profile.kind))return false;
 if(!state.kind&&state.category==='vacuum'&&['pool_robot','industrial'].includes(profile.kind))return false;
 if(state.builtIn!==undefined&&profile.installation!==(state.builtIn?'built_in':'freestanding'))return false;
 if(state.connection&&profile.connection!==state.connection)return false;
 if(state.loading&&profile.loading!==state.loading)return false;
 if(!state.kind&&state.category==='kettle'&&profile.kind==='stovetop')return false;
 for(const [field,key]of [['memoryMin','memoryGB'],['storageMin','storageGB'],['refreshMin','refreshRate']])if(state[field]&&(!Number.isFinite(profile[key])||profile[key]<state[field]))return false;
 if(state.powerMax&&(!Number.isFinite(profile.powerW)||profile.powerW>state.powerMax))return false;
 if(state.minBurners&&profile.burners!==state.minBurners)return false;
 if(state.capsuleSystem&&(!profile.capsuleSystem||!String(profile.capsuleSystem).toLowerCase().includes(state.capsuleSystem)))return false;
 for(const field of ['grill','convection','steam','iceMaker','waterDispenser','heatPump','autoDose'])if(state[field]!==undefined&&profile[field]!==state[field])return false;
 return true;
}
