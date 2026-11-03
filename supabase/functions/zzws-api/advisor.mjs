import {FAMILY_LABELS,labelFor,kindLabel,categoryIntent,queryText,classifyCategory,applianceProfile,categoryAccepts,VALID_KINDS} from './appliance-taxonomy.mjs';
import {similaritySource,compareSimilar,similarityReasons,similarityIntro,wantsSimilar} from './assistant-similarity.mjs';
import {matchDimensions,dimensionMode} from './size-matching.mjs';
import {priorities,preferenceCopy,parsePreferences,priorityOptions,preferenceMatch,priorityCompare,preferenceSummary,selectionReasons,asksUnverified,isRecognizedFollowup,wantsWhy,wantsMore} from './assistant-preferences.mjs';
// Conversational selection runs locally: no model, API key or paid service is required.
const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const categories = FAMILY_LABELS;
const installationPattern=/built[ -]?in|встраива|встроенн|ներկառուց/i;
const axes = {width: /ширин|шире|width|լայնու/i, depth: /глубин|глубже|depth|խորու/i, height: /высот|выше|height|բարձրու/i};
const pendingValues = ['subtype','category','dimension','dimensionValue','budget','currency','relax','priority','family'];
const labels = {
  ru: {category:'Какую технику подбираем?',dimension:'60 см — это максимальная ширина или глубина?'.replace('60','{n}'),dimensionValue:'Какой максимальный размер в сантиметрах?',budget:'Какой максимальный бюджет в драмах? Можно написать, например, «до 200 тысяч» или выбрать самые доступные варианты.',currency:'Укажите бюджет в армянских драмах (֏), чтобы сравнить его с ценами каталога.',low:'Самые доступные',width:'Ширина',depth:'Глубина',height:'Высота',washer:'Стиральная машина',dishwasher:'Посудомоечная машина',dryer:'Сушильная машина',fridge:'Холодильник',tv:'Телевизор',vacuum:'Пылесос',coffee:'Кофемашина',laptop:'Ноутбук',microwave:'Микроволновка',kettle:'Чайник',iron:'Утюг',found:'Нашёл подходящие варианты. Цены взяты из вашего текущего каталога, характеристики — с zigzag.am.',none:'По этим условиям подтверждённых вариантов в вашем каталоге не нашлось. Какое условие готовы изменить? Я сохраню остальные пожелания.',empty:'В вашем доступном каталоге сейчас нет подходящей категории. Какую другую технику поискать?',unknown:'Товары с неподтверждёнными параметрами не включены в подборку.',budgetChange:'Изменить бюджет',sizeChange:'Изменить размер',loadChange:'Изменить загрузку',brandChange:'Другой бренд',featureChange:'Изменить требования к функциям',features:'Уточните, нужна ли сушка и обязателен ли инверторный двигатель.',more:'Напишите, что изменить: бюджет, размер, загрузку, бренд или функции.',summary:'Ваши условия',budgetLabel:'Бюджет до',widthLabel:'Ширина до',depthLabel:'Глубина до',heightLabel:'Высота до',loadLabel:'Загрузка',loadMin:'Загрузка от',cheap:'Сначала дешевле',noLimit:'Без ограничения бюджета',brand:'Бренд',withDryer:'С сушкой',noDryer:'Без сушки',inverter:'Инверторный двигатель',cm:'см',kg:'кг',priceUnknown:'Не удалось подтвердить цену подходящих товаров. Уточните цену у менеджера.'},
  hy: {category:'Ի՞նչ տեխնիկա եք փնտրում։',dimension:'{n} սմ-ը առավելագույն լայնությո՞ւնն է, թե՞ խորությունը։',dimensionValue:'Որքա՞ն է առավելագույն չափը սանտիմետրերով։',budget:'Որքա՞ն է առավելագույն բյուջեն դրամով։ Օրինակ՝ «մինչև 200 հազար», կամ ընտրեք ամենամատչելիները։',currency:'Նշեք բյուջեն հայկական դրամով (֏)։',low:'Ամենամատչելիները',width:'Լայնություն',depth:'Խորություն',height:'Բարձրություն',washer:'Լվացքի մեքենա',dishwasher:'Սպասք լվացող մեքենա',dryer:'Չորանոց',fridge:'Սառնարան',tv:'Հեռուստացույց',vacuum:'Փոշեկուլ',coffee:'Սրճեփ',laptop:'Նոթբուք',microwave:'Միկրոալիքային վառարան',kettle:'Թեյնիկ',iron:'Արդուկ',found:'Գտա համապատասխան տարբերակներ։ Գները՝ ձեր ընթացիկ կատալոգից, բնութագրերը՝ zigzag.am-ից։',none:'Այս պայմաններով ձեր կատալոգում հաստատված տարբերակներ չգտնվեցին։ Ո՞ր պայմանը կփոխեք։ Մյուս ցանկությունները կպահպանեմ։',empty:'Ձեր հասանելի կատալոգում այս կատեգորիան հիմա չկա։ Ի՞նչ այլ տեխնիկա փնտրեմ։',unknown:'Չհաստատված պարամետրերով ապրանքները չեն ներառվել։',budgetChange:'Փոխել բյուջեն',sizeChange:'Փոխել չափը',loadChange:'Փոխել տարողությունը',brandChange:'Այլ բրենդ',featureChange:'Փոխել գործառույթները',features:'Նշեք՝ պե՞տք է չորացում, և պարտադի՞ր է ինվերտորային շարժիչը։',more:'Նշեք՝ ինչ փոխել՝ բյուջե, չափ, տարողություն, բրենդ կամ գործառույթներ։',summary:'Ձեր պայմանները',budgetLabel:'Բյուջե՝ մինչև',widthLabel:'Լայնություն՝ մինչև',depthLabel:'Խորություն՝ մինչև',heightLabel:'Բարձրություն՝ մինչև',loadLabel:'Տարողություն',loadMin:'Տարողություն՝ սկսած',cheap:'Սկզբում մատչելիները',noLimit:'Առանց բյուջեի սահմանափակման',brand:'Բրենդ',withDryer:'Չորացումով',noDryer:'Առանց չորացման',inverter:'Ինվերտորային շարժիչ',cm:'սմ',kg:'կգ',priceUnknown:'Համապատասխան ապրանքների գինը հաստատված չէ։ Ճշտեք մենեջերի հետ։'},
  en: {category:'What kind of appliance are you looking for?',dimension:'Is {n} cm the maximum width or depth?',dimensionValue:'What is the maximum size in centimetres?',budget:'What is your maximum budget in Armenian drams? For example, “up to 200 thousand”, or choose the lowest-priced options.',currency:'Please give your budget in Armenian drams (֏).',low:'Lowest-priced options',width:'Width',depth:'Depth',height:'Height',washer:'Washing machine',dishwasher:'Dishwasher',dryer:'Tumble dryer',fridge:'Fridge',tv:'TV',vacuum:'Vacuum cleaner',coffee:'Coffee machine',laptop:'Laptop',microwave:'Microwave',kettle:'Kettle',iron:'Iron',found:'Here are matching options. Prices are from your current catalogue; specifications are from zigzag.am.',none:'No verified options in your catalogue meet these requirements. Which requirement would you like to change? I will keep the others.',empty:'That category is not currently in your accessible catalogue. What other appliance should I look for?',unknown:'Products with unconfirmed required specifications were excluded.',budgetChange:'Change budget',sizeChange:'Change size',loadChange:'Change capacity',brandChange:'Another brand',featureChange:'Change feature requirements',features:'Please specify whether drying and an inverter motor are required.',more:'Tell me what to change: budget, size, capacity, brand or features.',summary:'Your requirements',budgetLabel:'Budget up to',widthLabel:'Width up to',depthLabel:'Depth up to',heightLabel:'Height up to',loadLabel:'Capacity',loadMin:'Capacity at least',cheap:'Lowest price first',noLimit:'No budget limit',brand:'Brand',withDryer:'With drying',noDryer:'Without drying',inverter:'Inverter motor',cm:'cm',kg:'kg',priceUnknown:'Matching product prices are unconfirmed. Please check with your manager.'}
};
for(const lang of ['hy','ru','en'])for(const family of Object.keys(FAMILY_LABELS))labels[lang][family]=labelFor(family,lang);
Object.assign(labels.ru,{dimension:'{n} см — это ширина, глубина или высота?',dimensionValue:'Укажите размер в сантиметрах. Если это предел для ниши, напишите «не больше».',widthTarget:'Ширина',depthTarget:'Глубина',heightTarget:'Высота',near:'Сначала показаны точные размеры, затем близкие варианты с указанными отличиями. Проверьте размеры перед выбором.',found:'Подобрал варианты по вашим условиям. Характеристики — с zigzag.am, цены — из вашего каталога.'});
Object.assign(labels.hy,{dimension:'{n} սմ-ը լայնությո՞ւնն է, խորությո՞ւնը, թե՞ բարձրությունը։',dimensionValue:'Նշեք չափը սանտիմետրերով։ Եթե այն խորշի սահմանափակում է, գրեք «ոչ ավելի»։',widthTarget:'Լայնություն',depthTarget:'Խորություն',heightTarget:'Բարձրություն',near:'Սկզբում ճշգրիտ չափերով տարբերակներն են, ապա՝ մոտ չափերով՝ տարբերությունների նշումով։ Ընտրելուց առաջ ստուգեք չափերը։',found:'Ընտրեցի ձեր պայմաններին համապատասխան տարբերակներ։ Բնութագրերը՝ zigzag.am-ից, գները՝ ձեր կատալոգից։'});
Object.assign(labels.en,{dimension:'Is {n} cm the width, depth or height?',dimensionValue:'Enter the size in cm. If this is a hard space limit, say “no more than”.',widthTarget:'Width',depthTarget:'Depth',heightTarget:'Height',near:'Exact sizes appear first, followed by nearby sizes with explicit differences. Check dimensions before choosing.',found:'Here are options for your requirements. Specifications are from zigzag.am; prices are from your catalogue.'});
for(const lang of Object.keys(labels))Object.assign(labels[lang],{none:preferenceCopy[lang].refine,empty:preferenceCopy[lang].refine,unknown:'',priceUnknown:preferenceCopy[lang].refine});

export function validateAdvisor(value) {
  if (value == null) return null;
  const invalid = () => {throw Object.assign(Error('Ընտրության պայմանները սխալ են։ Սկսեք նոր զրույց։'),{code:400});};
  if (typeof value !== 'object' || Array.isArray(value)) invalid();
  const result = {};
  for (const name of ['category','language','pending','dimensionAxis','brand','dimensionMode','widthMode','depthMode','heightMode','priority','color','kind','connection','loading','similarTo','sizeBasis','capsuleSystem']) if (value[name] != null) {
    if (typeof value[name] !== 'string' || value[name].length > 100) invalid(); result[name] = value[name];
  }
  if (result.category && !Object.hasOwn(categories,result.category)) invalid();
  if (result.language && !Object.hasOwn(labels,result.language)) invalid();
  if (result.pending && !pendingValues.includes(result.pending)) invalid();
  if (result.dimensionAxis && !Object.hasOwn(axes,result.dimensionAxis)) invalid();
  if(result.priority&&!priorities.includes(result.priority))invalid();
  if(result.kind&&!VALID_KINDS.has(result.kind))invalid();
  if(result.connection&&!['gas','electric','induction','combined'].includes(result.connection))invalid();
  if(result.loading&&!['front','top'].includes(result.loading))invalid();
  if(result.sizeBasis&&!['physical','niche'].includes(result.sizeBasis))invalid();
  if(result.color&&!['white','black','silver'].includes(result.color))invalid();
  for(const name of ['dimensionMode','widthMode','depthMode','heightMode'])if(result[name]&&!['target','max','min','exact'].includes(result[name]))invalid();
  for (const name of ['budgetMax','width','depth','height','dimensionValue','capacity','minVolume','minDiagonal','minPlaces','maxNoise','minBurners','memoryMin','storageMin','refreshMin','powerMax']) if (value[name] != null) {
    const max = name === 'budgetMax' ? 1e9 : ['storageMin','powerMax'].includes(name)?1e6:name==='memoryMin'?1024: name === 'capacity' ? 100 : name==='minVolume'?3000:name==='minDiagonal'?300:name==='minPlaces'?30:name==='maxNoise'?160:1000;
    if (typeof value[name] !== 'number' || !Number.isFinite(value[name]) || value[name] <= 0 || value[name] > max) invalid(); result[name] = value[name];
  }
  for (const name of ['grill','convection','steam','iceMaker','waterDispenser','heatPump','autoDose','similarityStrict','builtIn','cheap','budgetSkipped','capacityMin','drying','inverter','best','family','noFrost','smart','fourK','inStock','promo','volumeMax','diagonalMax','placesMax']) if (value[name] != null) {
    if (typeof value[name] !== 'boolean') invalid(); result[name] = value[name];
  }
  if(value.page!=null){if(!Number.isInteger(value.page)||value.page<0||value.page>100)invalid();result.page=value.page;}
  if(value.shown!=null){if(!Array.isArray(value.shown)||value.shown.length>3||value.shown.some(v=>typeof v!=='string'||!v||v.length>100))invalid();result.shown=[...new Set(value.shown)];}
  return result;
}

const numeric = text => Number(String(text).replace(/[ \u00a0]/g,'').replace(',','.'));
const numberPattern = '(\\d+(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?)';
const sizeUnits = '(см|сантиметр\\p{L}*|cm|centimet(?:er|re)s?|սմ|սանտիմետր|мм|миллиметр\\p{L}*|mm|մմ)';
const langOf = (message, prior) => /[а-яё]/i.test(message) ? 'ru' : /[\u0531-\u058f]/u.test(message) ? 'hy' : /[a-z]/i.test(message) ? 'en' : prior || 'ru';
const detectCategory = message => categoryIntent(message).category;
function readSizeMode(text,start,matched){
  const prefix=text.slice(Math.max(0,start-30),start),scope=matched+' '+prefix;
  if(/ниш|про[её]м|встраива|built.?in|ներկառուցվող|fits? (?:in|into)|opening|տեղավորվ|խորշ/i.test(text))return 'max';
  if(/не\s*$/u.test(prefix)&&/^(?:шире|выше|глубже)/iu.test(matched))return 'max';
  if(/строго|точно|exactly|ճշգրիտ/i.test(scope))return 'exact';
  if(/\b(?:max(?:imum)?|up to)\b|не (?:больше|более|шире|выше|глубже)|ոչ ավելի|առավելագույն|մինչև|(?:^|\s)до(?:\s|\d)/iu.test(matched)||/(?:до|не больше|не более|не шире|не выше|не глубже|up to|no more than|մինչև|ոչ ավելի)\s*$/iu.test(prefix))return 'max';
  if(/at least|не меньше|не менее|առնվազն|(?:^|\s)от(?:\s|\d)/i.test(scope)||/(?:от)\s*$/u.test(prefix))return 'min';
  return 'target';
}

function parseRequirements(message, prior, visibleProducts, responseLanguage) {
  message=queryText(message);
  const intent=categoryIntent(message),category=intent.category;
  const state = category && category !== prior?.category ? {} : {...prior};
  state.language = responseLanguage || langOf(message,state.language); if (category) state.category = category;if(category&&!wantsSimilar(message)&&prior?.similarTo)delete state.similarTo;
  const refined=state.category?categoryIntent(labelFor(state.category,'en')+' '+message):intent;for(const key of ['kind','connection','loading'])if(intent[key]||refined[key])state[key]=intent[key]||refined[key];
  if(/ниша|ниши|вырез|խորշ|niche|cut.?out/i.test(message))state.sizeBasis='niche';
  if(/размер корпуса|габариты корпуса|physical dimensions|չափ.*կորպուս/i.test(message))state.sizeBasis='physical';
  if(/точный аналог|строго.*аналог|exact match|ճշգրիտ համարժեք/i.test(message))state.similarityStrict=true;
  if(installationPattern.test(message))state.builtIn=true;
  if(/отдельно[ -]стоящ|freestanding|free standing|անկախ տեղադրմամբ/i.test(message))state.builtIn=false;
  const text = message.toLowerCase(), oldPending = state.pending; delete state.pending;
  for(const [key,re]of Object.entries({grill:/грил|գրիլ|grill/i,convection:/конвекц|կոնվեկց|convection/i,steam:/паровая|с паром|գոլորշիով|steam function/i,iceMaker:/льдогенератор|սառույց.*գեներատոր|ice.?maker/i,waterDispenser:/диспенсер|ջրի դիսպենսեր|water dispenser/i,heatPump:/теплов.*насос|ջերմային պոմպ|heat pump/i,autoDose:/автодоз|ավտոմատ.*չափաբաժին|auto.?dos|i.?dos/i}))if(re.test(text)){const match=re.exec(text),prefix=text.slice(Math.max(0,match.index-12),match.index);state[key]=!/без\s*$|without\s*$|առանց\s*$/i.test(prefix);}
  const powerLimit=/(?:до|не более|up to|մինչև)\s*(\d+(?:[.,]\d+)?)\s*(кВт|Вт|kW|W)/i.exec(text);if(powerLimit)state.powerMax=Number(powerLimit[1].replace(',','.'))*(/квт|kw/i.test(powerLimit[2])?1000:1);
  const refresh=/(\d+)\s*(?:гц|hz|հց)/i.exec(text);if(refresh&&state.category==='tv')state.refreshMin=Number(refresh[1]);
  for(const [key,re]of [['memoryMin',/(?:озу|ram|оперативн\p{L}*|օպերատիվ)\D{0,8}(\d+)\s*(?:gb|гб|գբ)/iu],['storageMin',/(?:ssd|накопител\p{L}*|storage|rom)\D{0,8}(\d+)\s*(gb|гб|tb|тб)/iu]]){const match=re.exec(text);if(match)state[key]=Number(match[1])*(/tb|тб/i.test(match[2]||'')?1024:1);}
  const burnerCount=/(\d+)\s*(?:конфор|зон|burners?|zones?|գոտի)/i.exec(text);if(burnerCount&&Number(burnerCount[1])>0&&Number(burnerCount[1])<=10)state.minBurners=Number(burnerCount[1]);
  if(state.category==='coffee'&&/nespresso|dolce gusto/i.test(text))state.capsuleSystem=/dolce gusto/i.test(text)?'dolce gusto':/nespresso\s*(?:v(?:ertuo)?)/i.test(text)?'nespresso v':'nespresso';
  if (/недорог|дешев|бюджетн|cheap|affordable|lowest.priced|մատչելի|էժան/i.test(text)) state.cheap = true;
  if (/без ограничени.*бюджет|без бюджета|no budget limit|առանց բյուջեի/i.test(text) || text.trim() === labels[state.language].low.toLowerCase()) {state.budgetSkipped=true;state.cheap=true;delete state.budgetMax;}
  let currencyError = false;
  for (const match of text.matchAll(new RegExp(numberPattern+'\\s*(тыс(?:яч[аиу]?)?|thousand|k|հազ(?:ար)?|млн|million|մլն)?\\s*(драм(?:ов|а)?|֏|amd|դրամ|руб(?:лей)?|₽|usd|eur|[$€])?','giu'))) {
    if(/^[248]\s*k$/i.test(match[0].trim())&&state.category==='tv')continue;
    const before=text.slice(Math.max(0,match.index-28),match.index), after=text.slice(match.index+match[0].length,match.index+match[0].length+14);
    if (/^\s*(?:конфор|зон|zones?|burners?|гц|hz|gb|tb|гб|тб|pa|па|kw|w|квт|вт|см|сантиметр|cm|սմ|mm|мм|մմ|кг|kg|կգ|литр|л\b|litres?|liters?|լիտր|дюйм|inch|["″]|դյույմ|дб|db|դբ|комплект|place settings|հավաքածու)/i.test(after)) continue;
    const amount=numeric(match[1])*(/млн|million|մլն/i.test(match[2]||'')?1e6:match[2]?1000:1);
    if (match[2] || match[3] || /бюджет|до\s*$|budget|up to\s*$|մինչև\s*$/i.test(before) || oldPending==='budget' || oldPending==='currency') {
      if (/руб|₽|usd|eur|[$€]/i.test(match[3]||'') || /[$€]\s*$/.test(before)) {currencyError=true;continue;}
      if (amount>0 && amount<=1e9) {state.budgetMax=amount;delete state.budgetSkipped;}
    }
  }
  if (/[$€₽]|\b(?:usd|eur)\b|рубл|доллар|евро|dollars?|euros?|դոլար|եվրո/i.test(text)) currencyError=true;
  let sized = false;
  for (const [axis,pattern] of Object.entries(axes)) {
    const named = new RegExp('(?:'+pattern.source+')\\p{L}*[^\\d]{0,14}'+numberPattern+'\\s*'+sizeUnits+'?','iu').exec(text);
    const reversed = new RegExp(numberPattern+'\\s*'+sizeUnits+'\\s*(?:по|в|in|of)?\\s*(?:'+pattern.source+')','iu').exec(text);
    const match=named||reversed;
    if (match) {const amount=numeric(match[1])*(/мм|mm|մմ|миллиметр/i.test(match[2]||'')?.1:1);if(amount>0&&amount<=1000){state[axis]=amount;state[axis+'Mode']=readSizeMode(text,match.index,match[0]);sized=true;delete state.dimensionValue;delete state.dimensionAxis;delete state.dimensionMode;}}
    else if (pattern.test(text)) {
      if (state.dimensionValue) {state[axis]=state.dimensionValue;state[axis+'Mode']=state.dimensionMode||'target';delete state.dimensionValue;delete state.dimensionMode;sized=true;}
      else if (!state[axis] || oldPending==='dimension') state.dimensionAxis=axis;
    }
  }
  const size = new RegExp(numberPattern+'\\s*'+sizeUnits+'(?!\\p{L})','iu').exec(text);
  if (size && !sized) {const amount=numeric(size[1])*(/мм|mm|մմ|миллиметр/i.test(size[2])?.1:1);if(amount>0&&amount<=1000){const mode=readSizeMode(text,size.index,size[0]);if(state.dimensionAxis){state[state.dimensionAxis]=amount;state[state.dimensionAxis+'Mode']=mode;delete state.dimensionAxis;}else{state.dimensionValue=amount;state.dimensionMode=mode;}}}
  if (oldPending==='dimensionValue' && !size && /^\s*\d+(?:[.,]\d+)?\s*$/.test(text)) {const amount=numeric(text);if(amount>0&&amount<=1000&&state.dimensionAxis){state[state.dimensionAxis]=amount;state[state.dimensionAxis+'Mode']='target';delete state.dimensionAxis;}}
  const load=/(?:от\s*|at least\s*)?(\d+(?:[.,]\d+)?)\s*(?:кг|килограмм\p{L}*|kg|կգ)/iu.exec(text);
  if(load){const amount=numeric(load[1]);if(amount>0&&amount<=100){state.capacity=amount;state.capacityMin=/от|at least/i.test(load[0]);}}
  if (/без суш|without dry|առանց չոր/i.test(text)) state.drying=false;
  else if (/с суш|with dry|չորացումով/i.test(text)) state.drying=true;
  if (/инвертор.*не (?:нужен|обязател)|inverter not required|ինվերտոր.*պարտադիր չէ/i.test(text)) delete state.inverter;
  else if(/без инвертор|without inverter|առանց ինվերտոր/i.test(text))state.inverter=false;
  else if (/инвертор|inverter|ինվերտոր/i.test(text)) state.inverter=true;
  const brands=[...new Set([...visibleProducts.map(p=>p.brand), 'Bosch','Samsung','LG','Haier','Beko','Indesit','Electrolux','Miele','Hisense','Gorenje','Candy','Whirlpool'])].filter(Boolean);
  const brand=brands.find(b=>(' '+norm(text)+' ').includes(' '+norm(b)+' '));
  if(brand)state.brand=brand;
  const alias=Object.entries({Bosch:/бош|բոշ/i,Samsung:/самсунг|սամսունգ/i,LG:/(?:^|\s)лджи|էլջի/i,Haier:/хайер|хаер|հայեր/i,Beko:/беко|բեկո/i,Indesit:/индезит|ինդեզիտ/i,Electrolux:/электролюкс|էլեկտրոլյուքս/i,Miele:/миле|միլե/i,Hisense:/хайсенс|հայսենս/i,Gorenje:/горенье|գորենյե/i}).find(([,pattern])=>pattern.test(text));
  if(alias)state.brand=alias[0];
  if(/любой бренд|без предпочтений по бренду|any brand|ցանկացած բրենդ/i.test(text))delete state.brand;
  const next=parsePreferences(message,state);
  if(wantsMore(message)){
    const criteria=s=>JSON.stringify(Object.entries(s||{}).filter(([key])=>!['page','shown','pending','language'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
    if(criteria(prior)!==criteria(next))next.page=0;
  }
  return {state:next,currencyError};
}

export function dimensions(specifications) {
  const result={};
  for(const {name,value} of specifications){
    const unit=String(name)+' '+String(value), scale=/(?:\bmm\b|мм|մմ)/i.test(unit)?.1:/(?:\bcm\b|см|սմ)/i.test(unit)?1:null;
    if(!scale)continue;
    const nums=String(value).replace(/,/g,'.').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
    for(const [axis,pattern] of Object.entries(axes))if(pattern.test(name)&&nums.length===1)result[axis]=nums[0]*scale;
    const order=String(name).toLowerCase().replace(/[\s()]/g,'');
    const ordered=order.match(/(?:dimensions|размеры)?([hwd])(?:x|×|х)([hwd])(?:x|×|х)([hwd])/);
    if(ordered&&new Set(ordered.slice(1)).size===3&&nums.length===3)ordered.slice(1).forEach((axis,i)=>result[{h:'height',w:'width',d:'depth'}[axis]]=nums[i]*scale);
  }
  return result;
}

const quantity = (specs,pattern) => {const value=specs.find(s=>pattern.test(s.name))?.value;if(value==null)return null;const parsed=Number(String(value).replace(',','.').match(/\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(parsed)?parsed:null;};
const customerPrice = (p,mode) => {
  const price=mode==='KP'?p.kpPrice:p.wholesale;
  return typeof price==='number'&&Number.isFinite(price)&&price>0 ? {amount:price,kind:'customer',currency:'AMD'} : typeof p.retail==='number'&&Number.isFinite(p.retail)&&p.retail>0 ? {amount:p.retail,kind:'retail',currency:'AMD'} : null;
};
const categoryMatches = (p,category) => (p._taxonomy?.family||classifyCategory(p.category).family)===category;

export function requirementSummary(state) {
  const t=labels[state.language||'ru'],parts=[];
  if(state.category)parts.push(t[state.category]);
  if(state.kind)parts.push(kindLabel(state.kind,state.language));
  if(state.connection)parts.push(state.connection);
  if(state.loading)parts.push(state.loading==='top'?(state.language==='ru'?'Вертикальная загрузка':state.language==='hy'?'Վերևից բեռնում':'Top loading'):(state.language==='ru'?'Фронтальная загрузка':state.language==='hy'?'Առջևից բեռնում':'Front loading'));
  if(state.similarTo)parts.push((state.language==='ru'?'Аналог модели':state.language==='hy'?'Համարժեք մոդել':'Similar to')+': '+state.similarTo);
  if(state.budgetMax)parts.push(t.budgetLabel+' '+state.budgetMax.toLocaleString('en-US')+' ֏');
  if(state.cheap)parts.push(t.cheap);
  for(const axis of Object.keys(axes))if(state[axis])parts.push(t[axis+(dimensionMode(state,axis)==='max'?'Label':'Target')]+' '+(dimensionMode(state,axis)==='min'?'≥ ':dimensionMode(state,axis)==='exact'?'= ':'')+state[axis]+' '+t.cm);
  if(state.capacity)parts.push(t[state.capacityMin?'loadMin':'loadLabel']+' '+state.capacity+' '+t.kg);
  if(state.builtIn!==undefined)parts.push(state.language==='ru'?(state.builtIn?'Встраиваемая':'Отдельно стоящая'):state.language==='en'?(state.builtIn?'Built-in':'Freestanding'):(state.builtIn?'Ներկառուցվող':'Անկախ տեղադրմամբ'));
  if(state.brand)parts.push(t.brand+': '+state.brand);
  if(state.drying!==undefined)parts.push(t[state.drying?'withDryer':'noDryer']);
  if(state.inverter!==undefined)parts.push(state.inverter?t.inverter:state.language==='hy'?'Առանց ինվերտորային շարժիչի':state.language==='en'?'Without inverter':'Без инвертора');
  parts.push(...preferenceSummary(state));
  return parts.join(' · ');
}

export function advise(message, prior, visibleProducts, verifiedProduct, responseLanguage, orderPriceMode='WS', publicProducts=[],policyOptions={}) {
  const isRequest=/нуж|подбер|ищу|посовет|хочу|need|looking for|recommend|want|փնտր|ուզում|պետք/i.test(message);
  if(!prior&&!detectCategory(message)&&!isRequest&&!policyOptions.similarTo&&!policyOptions.learning?.expectedRequest)return null;
  const parsed=parseRequirements(message,prior,[...visibleProducts,...publicProducts],responseLanguage);let state=parsed.state;const currencyError=parsed.currencyError;
  if(policyOptions.learning?.expectedRequest){const correction=parseRequirements(policyOptions.learning.expectedRequest,null,[...visibleProducts,...publicProducts],responseLanguage).state;if(correction.category&&correction.category!==state.category)state=Object.fromEntries(Object.entries(state).filter(([key])=>['language','budgetMax','budgetSkipped','cheap','brand'].includes(key)));state={...state,...Object.fromEntries(Object.entries(correction).filter(([key])=>!['page','shown','pending','language'].includes(key)))};}
  const t=labels[state.language],extra=preferenceCopy[state.language];
  const reply=(answer,pending=null,replies=[],recommendations=[],publicRecommendations=[])=>{
    if(pending)state.pending=pending;
    return {name:'ԶիգԶագ',answer,mode:'selection',modelUnavailable:false,products:[],choices:[],context:[],advisor:state,requirementSummary:requirementSummary(state),quickReplies:replies,recommendations,publicRecommendations};
  };
  if(policyOptions.similarTo)state.similarTo=policyOptions.similarTo;
  let reference=null,referenceProduct=null,referencePrice=null;
  if(state.similarTo){referenceProduct=[...visibleProducts,...publicProducts].find(p=>p.articul===state.similarTo);if(referenceProduct){reference=similaritySource(referenceProduct,verifiedProduct(referenceProduct));state.category=reference.profile.family;if(!state.kind&&reference.profile.kind)state.kind=reference.profile.kind;if(state.builtIn===undefined&&reference.profile.installation)state.builtIn=reference.profile.installation==='built_in';if(state.brand===referenceProduct.brand&&!/тот же бренд|только.*бренд|same brand|նույն բրենդ/i.test(message))delete state.brand;referencePrice=customerPrice(referenceProduct,orderPriceMode)?.amount;if(referencePrice){state.budgetSkipped=true;if(/не дороже|not more expensive|ոչ ավելի թանկ/i.test(message))state.budgetMax=referencePrice;}}
   if(!reference||reference.missing.length)return reply(state.language==='ru'?'Для точного аналога нужны подтверждённые тип, установка и ключевые параметры исходной модели. Выберите другую исходную модель или напишите категорию и обязательные требования для обычного подбора.':state.language==='hy'?'Համարժեք ընտրելու համար պետք են սկզբնական մոդելի հաստատված տեսակը, տեղադրումը և հիմնական չափերն ու բնութագրերը։ Նշեք այլ սկզբնական մոդել կամ նոր ընտրության կատեգորիան և պարտադիր պահանջները։':'A comparable alternative needs verified type, installation and key specifications for the source model. Choose another source model or enter a category and mandatory requirements for a fresh selection.');
  }
  if(!state.category)return reply(extra.learn+' '+t.category,'category',['washer','fridge','dishwasher','tv','vacuum'].map(k=>t[k]));
  if(!reference&&['coffee','vacuum'].includes(state.category)&&!state.kind)return reply(state.language==='ru'?'Уточните тип: у этих товаров разные функции и принципы работы.':state.language==='hy'?'Ճշտեք տեսակը․ այս ապրանքների գործառույթներն ու աշխատանքի սկզբունքը տարբեր են։':'Please choose a subtype; their functions and operating principles differ.','subtype',(state.category==='coffee'?['automatic','capsule','espresso','drip']:['canister','cordless','robot','wet']).map(kind=>kindLabel(kind,state.language)+' '+t[state.category]));
  if(!reference&&state.category==='hob'&&!state.connection)return reply(state.language==='ru'?'Какая панель нужна: газовая, электрическая или индукционная?':state.language==='hy'?'Ի՞նչ մակերես է պետք՝ գազային, էլեկտրական, թե՞ ինդուկցիոն։':'Gas, electric or induction hob?','subtype',state.language==='ru'?['Газовая варочная панель','Электрическая варочная панель','Индукционная варочная панель']:state.language==='hy'?['Գազային եփող մակերես','Էլեկտրական եփող մակերես','Ինդուկցիոն եփող մակերես']:['Gas hob','Electric hob','Induction hob']);
  if(currencyError)return reply(t.currency,'currency');
  if(state.dimensionValue)return reply(t.dimension.replace('{n}',state.dimensionValue),'dimension',[t.width,t.depth,t.height]);
  if(state.dimensionAxis)return reply(t.dimensionValue,'dimensionValue');
  if(prior&&!detectCategory(message)&&!isRecognizedFollowup(message,prior,state)&&!Object.values(t).includes(message.trim())&&!asksUnverified(message))return reply(extra.unsupported,null,[t.budgetChange,t.brandChange]);
  const availablePriorities=priorityOptions(state.category);
  if(state.priority&&!availablePriorities.includes(state.priority))return reply(extra.generic,'priority',availablePriorities.map(k=>extra[k]));
  if(asksUnverified(message)||(state.best&&!state.priority))return reply((asksUnverified(message)?extra.unverified+' ':'')+(state.category==='fridge'?extra.priority:extra.generic),'priority',availablePriorities.map(k=>extra[k]));
  if(state.family)return reply(extra.family,'family');
  if(new RegExp('^'+t.budgetChange+'$','i').test(message.trim()))return reply(t.budget,'budget',[t.noLimit]);
  if(message.trim()===t.sizeChange)return reply(state.language==='ru'?'Какой размер изменить: ширину, глубину или высоту?':state.language==='hy'?'Ո՞ր չափը փոխել՝ լայնությունը, խորությունը, թե՞ բարձրությունը։':'Which size should change: width, depth or height?','dimension',[t.width,t.depth,t.height]);
  if(message.trim()===t.loadChange)return reply(state.language==='ru'?'Какая загрузка нужна в килограммах?':state.language==='hy'?'Քանի՞ կգ տարողություն է պետք։':'What capacity do you need in kg?','relax');
  if(message.trim()===t.brandChange)return reply(state.language==='ru'?'Какой бренд предпочитаете? Можно написать «любой бренд».':state.language==='hy'?'Ո՞ր բրենդն եք նախընտրում։ Կարող եք նշել «ցանկացած բրենդ»։':'Which brand do you prefer? You can say “any brand”.','relax');
  if(message.trim()===t.featureChange)return reply(t.features,'relax');
  if(state.cheap&&!state.budgetMax&&!state.budgetSkipped)return reply(t.budget,'budget',[t.low]);
  const categoryProducts=[...visibleProducts,...publicProducts].filter(p=>categoryMatches(p,state.category));
  if(!categoryProducts.length)return reply(t.empty,'category',['washer','fridge','dishwasher','tv','vacuum'].filter(k=>k!==state.category).map(k=>t[k]));
  const matches=[],publicMatches=[];let uncertain=0,unpriced=0;
  for(const p of categoryProducts){
    if(p.articul===state.similarTo||policyOptions.learning?.excluded?.has(p.articul))continue;
    if(state.brand&&norm(p.brand)!==norm(state.brand))continue;
    const product=verifiedProduct(p);
    if(product.status!=='verified'){uncertain++;continue;}
    const specs=product.specifications,profile=applianceProfile(p,product),dims=state.sizeBasis==='niche'?profile.niche:profile.dimensions,load=quantity(specs,/load capacity|capacity.*kg|загрузка|տարողություն.*կգ/i);
    if(!categoryAccepts(state,profile))continue;
    const preference=preferenceMatch(state,p,specs,orderPriceMode);if(!preference.accepted){if(preference.unconfirmed)uncertain++;continue;}
    const strictDimensions=policyOptions.learning?.strictSimilarity?{...state,...Object.fromEntries(['width','height','depth'].filter(axis=>state[axis]&&dimensionMode(state,axis)==='target').map(axis=>[axis+'Mode','exact']))}:state;
    const sizeMatch=matchDimensions(strictDimensions,dims);if(!sizeMatch.accepted&&!sizeMatch.unconfirmed)continue;
    if(state.capacity&&load!=null&&(state.capacityMin?load<state.capacity:Math.abs(load-state.capacity)>.001))continue;
    let missing=!!sizeMatch.unconfirmed||!!(state.capacity&&load==null);
    if(state.drying!==undefined){const dryer=/չորանոցներով|с суш|washer.dryer/i.test(p.category);const drying=specs.find(s=>/drying|сушка|չորացում/i.test(s.name));if(dryer){if(!state.drying)continue;}else if(state.category==='washer'&&!state.drying){}else if(drying){const yes=/yes|да|այո|\d/i.test(drying.value)&&!/no|нет|ոչ|^0(?:\D|$)/i.test(drying.value);if(yes!==state.drying)continue;}else missing=true;}
    if(state.inverter!==undefined){const motor=specs.find(s=>/motor type|мotor type|compressor type|двигатель|компрессор|շարժիչ|կոմպրեսոր/i.test(s.name));if(!motor)missing=true;else if(/inverter|инвертор|ինվերտոր/i.test(motor.value)!==state.inverter)continue;}
    if(missing){uncertain++;continue;}
    const price=customerPrice(p,orderPriceMode);
    const similarity=reference?compareSimilar(reference,profile,referencePrice,price?.amount,{budgetMax:state.budgetMax,toleranceScale:state.similarityStrict||policyOptions.learning?.strictSimilarity?0:1}):null;
    if(similarity&&!similarity.accepted)continue;
    const match={kind:sizeMatch.kind==='near'||similarity?.kind==='near'?'near':'exact',distance:sizeMatch.distance+(similarity?.distance||0),deviations:[...sizeMatch.deviations,...(similarity?.changes||[])]};
    if(p.catalogScope==='public'){
      publicMatches.push({...product,catalogScope:'public',orderability:{status:'manager',reason:'outside_catalog'},budgetStatus:state.budgetMax?'unconfirmed':'unspecified',matchedDimensions:dims,match,similarity});
      continue; // No private prices/stock; an unknown price never confirms a budget.
    }
    if(!price){unpriced++;continue;}
    if(state.budgetMax&&price.amount>state.budgetMax)continue;
    matches.push({...product,price,orderability:price.kind==='customer'?{status:'orderable'}:{status:'manager',reason:'order_price_missing'},stockStatus:p.stockStatus||'',matchedDimensions:dims,match,similarity});
  }
  matches.sort((a,b)=>(a.orderability.status==='manager')-(b.orderability.status==='manager')||(a.match.kind==='near')-(b.match.kind==='near')||a.match.distance-b.match.distance||priorityCompare(a,b,state)||a.price.amount-b.price.amount||a.articul.localeCompare(b.articul));
  publicMatches.sort((a,b)=>(a.match.kind==='near')-(b.match.kind==='near')||a.match.distance-b.match.distance||priorityCompare(a,b,state)||a.articul.localeCompare(b.articul));
  const offset=(state.page||0)*3;
  const explain=p=>({...p,reasons:[...selectionReasons(p,state),...(p.similarity?similarityReasons(p.similarity,state.language):[])].slice(0,10)});
  const publicOffers=publicMatches.slice(offset,offset+3).map(explain);
  if(matches.length||publicOffers.length){
    // Keep a separate allowance for reference-only offers, so cheap retail
    // prices cannot crowd products with an actual permitted order price out.
    const orderable=matches.filter(p=>p.orderability.status==='orderable');
    const exact=orderable.filter(p=>p.match.kind==='exact').slice(offset,offset+3).map(explain),near=orderable.filter(p=>p.match.kind==='near').slice(offset,offset+3).map(explain);
    const manager=matches.filter(p=>p.orderability.status==='manager').slice(offset,offset+3).map(explain);
    const shown=[...exact,...near,...manager];
    if(!shown.length&&!publicOffers.length)return reply(extra.end,null,[extra.price,t.budgetChange,t.brandChange]);
    state.shown=shown.slice(0,3).map(p=>p.articul);
    const publicNote=state.language==='hy'?'Լրացուցիչ տարբերակների գինը, պատվերի պայմանները և բյուջեին համապատասխանությունը ճշտեք մենեջերի հետ։':state.language==='ru'?'Цену, условия заказа и соответствие бюджету дополнительных вариантов можно уточнить у менеджера.':'Ask your manager about pricing, ordering terms and budget fit for additional options.';
    const more=[orderable.filter(p=>p.match.kind==='exact'),orderable.filter(p=>p.match.kind==='near'),matches.filter(p=>p.orderability.status==='manager'),publicMatches].some(list=>list.length>offset+3);
    const why=shown.map(p=>p.name+': '+p.reasons.join('; ')).join('\n');
    return reply((reference?similarityIntro(reference,state.language,{strict:state.similarityStrict||policyOptions.learning?.strictSimilarity,budgetMax:state.budgetMax,price:referencePrice})+' ':'')+(shown.length?t.found+' '+(state.priority&&state.priority!=='price'?extra.priorityOrder:extra.defaultOrder):'')+(state.priority==='energy'?' '+extra.energyNote:'')+([...near,...manager].some(p=>p.match.kind==='near')?' '+t.near:'')+(publicOffers.length?' '+publicNote:'')+(why&&wantsWhy(message)?'\n\n'+why:''),null,[...(more?[extra.more]:[]),extra.why],shown,publicOffers);
  }
  const changes=[t.budgetChange,...(Object.keys(axes).some(axis=>state[axis])?[t.sizeChange]:[]),...(state.capacity?[t.loadChange]:[]),...(state.brand?[t.brandChange]:[]),...(state.drying!==undefined||state.inverter?[t.featureChange]:[])];
  return reply(t.none,'relax',changes);
}
