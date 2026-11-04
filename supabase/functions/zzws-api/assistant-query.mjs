import {queryText,FAMILY_LABELS,KIND_LABELS} from './appliance-taxonomy.mjs';
import {preferenceCopy} from './assistant-preferences.mjs';

// User input only. Catalogue categories, specifications and product identity must
// never pass through spelling correction. Unknown/ambiguous words stay as typed.
const fold = value => String(value).normalize('NFKC').toLowerCase().replaceAll('ё','е');
const words = text => text.split(/\s+/u).filter(Boolean);
const vocabulary = new Map();
function add(text) { for (const word of words(text)) vocabulary.set(fold(word),word); }
add(`холодильник холодильника холодильники холодильников морозильник морозильника морозильники
стиральная стиральную стиральной стиралка машина машину машины посудомоечная посудомоечную посудомойка
сушильная сушильную сушилка телевизор телевизора телевизоры пылесос пылесоса пылесосы
кофемашина кофемашину кофеварка кофеварку ноутбук ноутбука микроволновка микроволновку микроволновая
духовка духовку духовой варочная варочную панель вытяжка вытяжку чайник чайника утюг
отпариватель парогенератор блендер миксер кондиционер аэрогриль наушники смартфон саундбар
проектор тостер мясорубка соковыжималка водонагреватель бойлер плита плиту планшет монитор колонка
встраиваемый встраиваемая встраиваемую встроенный отдельно стоящий стоящая фронтальная вертикальная загрузка
газовая газовую электрическая электрическую индукционная индукционную комбинированная
капсульная капельная рожковая автоматическая полуавтоматическая робот беспроводной ручной моющий промышленный
погружной стационарный портативный
привет здравствуйте нужен нужна нужны подбери подберите предложи посоветуй хочу ищу сравни сравнить подробнее расскажи
аналог похожий похожие замена вместо первый второй третьей модели этих почему покажи еще другие варианты
тихий тихая тихую тихие тише малошумный недорогой недорогая дешевый дешевая дешевле подешевле
вместительный вместительная вместительнее экономичный экономичная энергосберегающий
лучший лучшая хорошие хороший надежный надежная отзывы качество семьи семья
бюджет бюджета тысяч тысячи тысяча драм драмов миллиона миллион
ширина ширину ширине ширины глубина глубину глубине глубины высота высоту высоте высоты
размер размеры габариты ниша ниши корпус корпуса больше менее более меньше строго точно
литров литра литр дюймов дюйма дюйм комплектов комплекта сантиметров сантиметра сантиметр
миллиметров миллиметр килограммов килограмм
инвертор инвертора инверторный инверторная сушка сушкой сушки сушку
конвекция конвекцией гриль грилем паровая паром льдогенератор диспенсер тепловой насос автодозировка
ноу фрост смарт белый белая черный черная серебристый серебристая цвет бренд бренда
наличии наличие акция акции скидка скидки любой любое ограничений ограничения ограничение
сброс заново сначала повтори обязателен обязател обязательный нужен нужно загрузку изменить другой
доступные самые показать почему`);
add(`refrigerator fridge freezer washing washer machine dishwasher tumble dryer drying
television vacuum cleaner coffee maker laptop notebook microwave oven cooking surface cooktop cooker hood
kettle iron garment steamer steam generator blender mixer conditioner fryer headphones earbuds smartphone
soundbar projector toaster grinder juicer heater tablet monitor speaker
built integrated freestanding front loading induction electric combined capsule drip espresso automatic
portafilter robot industrial cordless handheld canister bagged bagless portable stationary immersion wireless
hello need looking recommend want compare details first second third similar alternative replacement replace
quiet quieter cheap cheaper cheapest affordable lowest priced spacious capacity energy efficient
best good premium reliable reliability reviews family
budget price lower thousand million width depth height dimensions niche opening maximum minimum exactly
least more less than without with inverter required drying grill convection dispenser heat pump dosing
frost smart white black silver colour color stock promotional sale brand options models show these
suggest why again another same start over limit`);
add(`սառնարան սառնարանը սառցարան լվացքի մեքենա մեքենան սպասք լվացող չորանոց չորացնող
հեռուստացույց փոշեկուլ սրճեփ նոթբուք միկրոալիքային վառարան ջեռոց եփող մակերես օդաքարշ
թեյնիկ արդուկ գոլորշիչ գոլորշու գեներատոր բլենդեր հարիչ օդորակիչ վարսահարդարիչ ականջակալ
սմարթֆոն սաունդբար պրոյեկտոր թոսթեր մսաղաց հյութաքամիչ ջրատաքացուցիչ պլանշետ մոնիտոր բարձրախոս
ներկառուցվող առանձին գազային էլեկտրական ինդուկցիոն համակցված կապսուլային կաթիլային ավտոմատ
ռոբոտ անլար ձեռքի լուռ տարողունակ մատչելի էժան էներգախնայ լավագույն հուսալի ընտանիք
բյուջե բյուջեի հազար դրամ լայնություն խորություն բարձրություն չափ չափերը խորշ
մինչև առնվազն առավելագույն ճշգրիտ առանց ավելի քիչ ինվերտոր ինվերտորային չորացում չորացումով
գրիլ կոնվեկցիա սպիտակ արծաթագույն գույն բրենդ առկա ակցիա զեղչ ցանկացած
ցույց ավելին տարբերակ մոդելները ինչու համարժեք փոխարինել փնտրում պետք ուզում`);

// Match the existing transliteration aliases, including nearby misspellings.
for (const word of words(`holodilnik xolodilnik stiralka stiralnaya posudomoyka posudomoechnaya
pilesos pylesos vstraivaemiy vstraivaemyj vstraivaemyy duhovka duxovka kofemashina morozilnik
televizor analog pohozhiy poxojiy podberi sushilnaya`)) vocabulary.set(word,queryText(word));

const standardBrands = words('Bosch Samsung Haier Beko Indesit Electrolux Miele Hisense Gorenje Candy Whirlpool Philips Siemens Panasonic Xiaomi Sony LG');
// Common Russian/Armenian spellings feed the existing brand parser.
add('бош самсунг хайер хаер беко индезит электролюкс миле хайсенс горенье բոշ սամսունգ հայեր բեկո ինդեզիտ էլեկտրոլյուքս միլե հայսենս գորենյե');
// Valid category/feature names and dialogue wording must win over a nearby
// dictionary candidate (hair/Haier, meat/heat, cooler/cooker, նույն/գույն).
for(const labels of [...Object.values(FAMILY_LABELS),...Object.values(KIND_LABELS)])for(const label of labels)for(const word of label.match(/\p{L}+/gu)||[])add(word);
const dialogueWords=new Set(Object.values(preferenceCopy).flatMap(copy=>Object.values(copy).flatMap(text=>(text.match(/\p{L}+/gu)||[]).map(fold))));
// Exact grammar words are protected, and never candidates for fuzzy correction.
const grammar = new Set(words('не ни нет без до от на по за для или и с в к у но да это эти как что еще те же такие снова повтори no not nor non in on of or to up at by for any all air gas tv do is it with without same again ոչ և թե ու սև նույն կրկին').map(fold));
const script = word => /[а-я]/u.test(word)?'ru':/[\u0531-\u058f]/u.test(word)?'hy':/^[a-z]+$/u.test(word)?'en':null;

// Bounded optimal-string-alignment distance also counts swapped neighbours as
// one typo. Length/script buckets and a cutoff keep the Edge CPU work bounded.
function distance(a,b,limit) {
 if (Math.abs(a.length-b.length)>limit) return limit+1;
 let previous=Array.from({length:b.length+1},(_,i)=>i),older;
 for(let i=1;i<=a.length;i++) {
  const row=Array(b.length+1).fill(limit+1);row[0]=i;let minimum=row[0];
  for(let j=Math.max(1,i-limit);j<=Math.min(b.length,i+limit);j++) {
   row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
   if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],older[j-2]+1);
   minimum=Math.min(minimum,row[j]);
  }
  if(minimum>limit)return limit+1;
  older=previous;previous=row;
 }
 return previous[b.length];
}
function index(entries) {
 const buckets=new Map();
 for(const [word,value]of entries) {
  const alphabet=script(word);if(!alphabet||word.length<4||grammar.has(word))continue;
  const key=alphabet+':'+word.length;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push([word,value]);
 }
 return buckets;
}
const baseIndex=index(vocabulary);
const commonTypos=new Map([['еше','еще']]);

export function normalizeAssistantQuery(message,{brands=[],protectedTerms=[]}={}) {
 const brandWords=new Map();
 for(const brand of new Set([...standardBrands,...brands]))for(const word of String(brand||'').match(/[\p{L}\p{N}]+/gu)||[])brandWords.set(fold(word),word);
 const brandIndex=index(brandWords),protectedWords=new Set(protectedTerms.map(fold)),memo=new Map();
 return String(message).replace(/[\p{L}\p{N}]+(?:[-_./][\p{L}\p{N}]+)*/gu,token=>{
  const word=fold(token);
  // Includes model suffixes, SKUs, capacities such as 4K/8kg and exact words
  // from an identified model. Do not try to repair product identity.
  if(!/^\p{L}+$/u.test(token)||protectedWords.has(word)||grammar.has(word))return token;
  if(brandWords.has(word))return token;
  if(vocabulary.has(word)){const value=vocabulary.get(word);return fold(value)===word?token:value;}
  if(dialogueWords.has(word))return token;
  if(commonTypos.has(word))return commonTypos.get(word);
  if(word.length<4||word.length>32)return token;
  if(memo.has(word))return memo.get(word);
  const alphabet=script(word);if(!alphabet)return token;
  const limit=word.length>=9?2:1;let best=limit+1,values=new Set();
  for(const buckets of [baseIndex,brandIndex])for(let length=word.length-limit;length<=word.length+limit;length++)for(const [candidate,value]of buckets.get(alphabet+':'+length)||[]) {
   if(['не','un','non'].some(prefix=>word===prefix+candidate||candidate===prefix+word))continue;
   const score=distance(word,candidate,Math.min(limit,best));
   if(score>limit||score>best)continue;
   if(score<best){best=score;values=new Set();}
   values.add(fold(value));
  }
  const result=values.size===1?[...values][0]:token;
  memo.set(word,result);return result;
 });
}
