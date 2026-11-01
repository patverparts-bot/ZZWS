// Deterministic selection: no provider, API key, rating invention or paid fallback.
export const priorities=['price','quiet','capacity','energy','diagonal'];
export const preferenceCopy={
 ru:{learn:'Я ещё учусь и пока не совсем понял ваш запрос. Пожалуйста, уточните, какую технику вы ищете и что для вас важно.',refine:'Давайте немного уточним ваши пожелания — бюджет, размер, бренд или функции, — чтобы я смог подобрать подходящие варианты из нашего ассортимента.',priority:'Помогу подобрать лучший вариант именно для вас. Что важнее: цена, тишина, вместительность или расход электроэнергии?',generic:'Что для вас важнее при выборе? Могу учесть бюджет, размеры, бренд и подтверждённые характеристики.',unverified:'Надёжность, срок службы и отзывы нельзя достоверно оценить только по характеристикам. Давайте выберем измеримый приоритет.',family:'Для семьи важны размер и вместительность. Какой объём в литрах, загрузка в кг или количество комплектов вам подойдёт? Можно также указать бюджет.',price:'Ниже цена',quiet:'Тише',capacity:'Вместительнее',energy:'Меньше расход энергии',diagonal:'Больше экран',more:'Показать ещё',why:'Почему эти модели?',reason:'Почему предложен',defaultOrder:'Сначала показываю варианты с меньшей ценой; это не рейтинг качества.',priorityOrder:'Сначала учитываю ваши ограничения и выбранный приоритет. При равных параметрах — меньшую цену.',energyNote:'Сравниваю заявленный расход, а не буквенные классы разных стандартов; объём и режим эксплуатации тоже влияют на расход.',end:'Мы просмотрели эту подборку. Давайте уточним приоритеты или изменим условия, и я подберу другие варианты.',noise:'Шум',volume:'Общий объём',load:'Загрузка',places:'Комплекты',screen:'Диагональ',year:'Расход за год',cycle:'Расход за цикл',minVolume:'Объём от',minDiagonal:'Диагональ от',minPlaces:'Комплектов от',maxNoise:'Шум до',inStock:'В наличии',promo:'Акционная цена',noFrost:'No Frost',smart:'Smart TV',fourK:'Разрешение не ниже 4K',color:'Цвет',white:'Белый',black:'Чёрный',silver:'Серебристый',unsupported:'Помогите мне точнее понять пожелание. Укажите бюджет, размер, бренд или функцию — я ещё учусь и подберу варианты по подтверждённым данным.'},
 hy:{learn:'Ես դեռ սովորում եմ և դեռ լիովին չհասկացա ձեր հարցումը։ Խնդրում եմ հստակեցրեք՝ ինչ տեխնիկա եք փնտրում և ինչն է ձեզ համար կարևոր։',refine:'Եկեք մի փոքր հստակեցնենք ձեր ցանկությունները՝ բյուջեն, չափը, բրենդը կամ գործառույթները, որպեսզի կարողանամ համապատասխան տարբերակներ ընտրել մեր տեսականուց։',priority:'Կօգնեմ ընտրել հենց ձեզ համար լավագույն տարբերակը։ Ի՞նչն է ավելի կարևոր՝ գինը, լուռ աշխատանքը, տարողությունը, թե՞ էլեկտրաէներգիայի ծախսը։',generic:'Ի՞նչն է ձեզ համար կարևոր ընտրելիս։ Կարող եմ հաշվի առնել բյուջեն, չափերը, բրենդը և հաստատված բնութագրերը։',unverified:'Միայն բնութագրերով հնարավոր չէ հավաստի գնահատել հուսալիությունը, ծառայության ժամկետը կամ կարծիքները։ Եկեք ընտրենք չափելի առաջնահերթություն։',family:'Ընտանիքի համար կարևոր են չափերն ու տարողությունը։ Քանի՞ լիտր, կգ կամ սպասքի հավաքածու է ձեզ անհրաժեշտ։ Կարող եք նաև նշել բյուջեն։',price:'Ավելի մատչելի',quiet:'Ավելի լուռ',capacity:'Ավելի տարողունակ',energy:'Ավելի քիչ էներգածախս',diagonal:'Ավելի մեծ էկրան',more:'Ցույց տալ ավելին',why:'Ինչո՞ւ այս մոդելները',reason:'Ինչու է առաջարկվում',defaultOrder:'Սկզբում ցույց եմ տալիս ավելի մատչելի տարբերակները․ սա որակի վարկանիշ չէ։',priorityOrder:'Նախ հաշվի եմ առնում ձեր սահմանափակումներն ու առաջնահերթությունը, հավասար ցուցանիշների դեպքում՝ ավելի մատչելի գինը։',energyNote:'Համեմատում եմ նշված էներգածախսը՝ առանց տարբեր ստանդարտների տառային դասերը խառնելու։ Ծավալն ու օգտագործման ռեժիմը նույնպես ազդում են ծախսի վրա։',end:'Այս ընտրանքն արդեն դիտեցինք։ Հստակեցնենք առաջնահերթությունները կամ փոխենք պայմանները, և կընտրեմ այլ տարբերակներ։',noise:'Աղմուկ',volume:'Ընդհանուր ծավալ',load:'Բեռնվածք',places:'Սպասքի հավաքածու',screen:'Անկյունագիծ',year:'Տարեկան ծախս',cycle:'Մեկ ցիկլի ծախս',minVolume:'Ծավալ՝ սկսած',minDiagonal:'Անկյունագիծ՝ սկսած',minPlaces:'Հավաքածուներ՝ սկսած',maxNoise:'Աղմուկ՝ մինչև',inStock:'Առկա',promo:'Ակցիոն գին',noFrost:'No Frost',smart:'Smart TV',fourK:'Առնվազն 4K թույլատրություն',color:'Գույն',white:'Սպիտակ',black:'Սև',silver:'Արծաթագույն',unsupported:'Օգնեք ավելի հստակ հասկանալ ձեր ցանկությունը։ Նշեք բյուջեն, չափը, բրենդը կամ գործառույթը․ ես դեռ սովորում եմ և կընտրեմ հաստատված տվյալներով տարբերակներ։'},
 en:{learn:'I am still learning and have not quite understood your request. Please tell me what appliance you need and what matters to you.',refine:'Let us refine your preferences — budget, size, brand or features — so I can find suitable options from our range.',priority:'I can help find the best fit for you. What matters most: price, quiet operation, capacity or energy use?',generic:'What matters most to you? I can use your budget, dimensions, brand and verified specifications.',unverified:'Specifications alone cannot reliably establish durability, service life or customer reviews. Let us choose a measurable priority.',family:'For a family, size and capacity matter. What volume in litres, load in kg or number of place settings suits you? You can also give a budget.',price:'Lower price',quiet:'Quieter',capacity:'More capacity',energy:'Less energy use',diagonal:'Larger screen',more:'Show more',why:'Why these models?',reason:'Why suggested',defaultOrder:'Lower-priced options appear first; this is not a quality ranking.',priorityOrder:'Your constraints and chosen priority come first, then lower price for equal specifications.',energyNote:'I compare stated energy use, without mixing letter ratings from different standards. Capacity and usage also affect consumption.',end:'We have reviewed this selection. Let us adjust your priorities or requirements to find other options.',noise:'Noise',volume:'Total volume',load:'Load',places:'Place settings',screen:'Diagonal',year:'Annual consumption',cycle:'Consumption per cycle',minVolume:'Volume at least',minDiagonal:'Diagonal at least',minPlaces:'Place settings at least',maxNoise:'Noise up to',inStock:'In stock',promo:'Promotional price',noFrost:'No Frost',smart:'Smart TV',fourK:'At least 4K resolution',color:'Colour',white:'White',black:'Black',silver:'Silver',unsupported:'Help me understand your preferences more precisely. Give a budget, size, brand or feature — I am still learning and will use verified data.'}
};
const normalized=v=>String(v||'').normalize('NFKC').toLowerCase();
export const wantsMore=message=>/^ещ[её]$|покажи.*ещ[её]|ещ[её] вариант|другие модел|show more|more options|ցույց տալ ավելին|այլ տարբերակ|ուրիշ մոդել/i.test(message);
export const wantsWhy=message=>/почему.*(?:эти|модел|предлож)|why these|why.*suggest|ինչո՞ւ|ինչու.*մոդել/i.test(message);
const best=/лучш|хорош|оптималь|цена.?качеств|топов|премиаль|качественн|над[её]жн|не ломал|долго служ|\bbest\b|\bgood\b|premium|reliab|լավագույն|լավ\s|որակյալ|հուսալի/i;
export const asksUnverified=message=>/над[её]жн|не ломал|долго служ|отзыв|reliab|durab|reviews?|հուսալի|կարծիք|երկար.*ծառայ/i.test(message);
const specNumber=(specs,pattern,max)=>{
 const value=specs.find(s=>pattern.test(s.name))?.value;
 const text=String(value??'').replace(/[,․]/g,'.').trim();
 if(!/^\d+(?:\.\d+)?(?:\s*(?:l|л|լ|kg|кг|կգ|db|дб|դբ|kwh|կվտժ|квт[⋅ч ]*|inch(?:es)?|["″]))?$/i.test(text))return null;
 const n=parseFloat(text);return n>0&&n<=max?n:null;
};
export function metric(specs,category,priority){
 if(priority==='quiet')return {value:specNumber(specs,category==='washer'?/noise level during spinning|шум.*отжим|աղմուկ.*քամ/i:/^noise level\s*\(db\)|^noise level$|^уровень шума|^աղմուկ/i,160),key:'noise',unit:'dB',direction:1};
 if(priority==='diagonal'&&category==='tv')return {value:specNumber(specs,/^diagonal$|^диагональ|^անկյունագիծ/i,300),key:'screen',unit:'″',direction:-1};
 if(priority==='capacity'){
  if(category==='fridge')return {value:specNumber(specs,/^total volume\s*\(l\)|^общий объ[её]м|^ընդհանուր ծավալ/i,3000),key:'volume',unit:'l',direction:-1};
  if(['washer','dryer'].includes(category))return {value:specNumber(specs,/load capacity.*kg|^capacity.*kg|загрузка|բեռնվածք/i,100),key:'load',unit:'kg',direction:-1};
  if(category==='dishwasher')return {value:specNumber(specs,/maximum capacity.*set|комплект|հավաքածու/i,30),key:'places',unit:'',direction:-1};
 }
 if(priority==='energy'){
  if(category==='fridge')return {value:specNumber(specs,/energy consumption of the year.*kwh|год.*квт|տարեկան.*կվտ/i,5000),key:'year',unit:'kWh',direction:1};
  if(['washer','dryer','dishwasher'].includes(category))return {value:specNumber(specs,/energy consumption per cycle.*kwh|цикл.*квт|ցիկլ.*կվտ/i,100),key:'cycle',unit:'kWh',direction:1};
 }
 return {value:null};
}
export function priorityOptions(category){
 return ['price',...(['fridge','washer','dryer','dishwasher','vacuum'].includes(category)?['quiet']:[]),...(['fridge','washer','dryer','dishwasher'].includes(category)?['capacity','energy']:[]),...(category==='tv'?['diagonal']:[])];
}
export function parsePreferences(message,state){
 const text=normalized(message),t=preferenceCopy[state.language];
 if(best.test(text))state.best=true;
 const tests={price:/дешев|деш[её]в|ниже цена|по цене|меньше цена|подешев|недорог|lower price|cheaper|lowest.price|ավելի մատչելի|էժան|ամենամատչելի/i,quiet:/тих|тише|малошум|quiet|լուռ|ցածր աղմուկ/i,capacity:/вместитель|побольше.*объ|больш.*(?:объ[её]м|загруз)|more capacity|spacious|տարողունակ|մեծ ծավալ/i,energy:/экономич|энергосбер|меньше.*(?:энерг|электр)|less energy|energy.efficient|քիչ էներգ|էներգախնայ/i,diagonal:/больш.*экран|больше экран|larger screen|մեծ էկրան/i};
 const selected=Object.entries(tests).find(([key,re])=>re.test(text)||text===t[key].toLowerCase())?.[0];
 if(selected){state.priority=selected;if(selected!=='price')state.cheap=false;}
 if(/no\s*frost|ноу\s*фрост|без размороз|առանց հալեց/i.test(text))state.noFrost=!/без no\s*frost|without no\s*frost|առանց no\s*frost/i.test(text);
 if(/smart\s*tv|смарт|խելացի հեռուստ/i.test(text))state.smart=!/без smart|без смарт|without smart|առանց smart/i.test(text);
 if(/\b4\s*k\b|\buhd\b/i.test(text))state.fourK=true;
 if(/только.*налич|в наличии|in stock|միայն առկա|առկա ապրանք/i.test(text))state.inStock=true;
 if(/акци|скидк|promotional|on sale|ակցի|զեղչ/i.test(text))state.promo=true;
 for(const [color,re] of Object.entries({white:/бел(?:ый|ая|ого)|\bwhite\b|սպիտակ/i,black:/ч[её]рн|\bblack\b|սև/i,silver:/серебрист|\bsilver\b|արծաթ/i}))if(re.test(text))state.color=color;
 const volume=/(?:от\s*|минимум\s*|at least\s*|առնվազն\s*)?(\d+(?:[.,]\d+)?)\s*(?:литр\p{L}*|л\b|litres?|liters?|լիտր|լ\b)/iu.exec(text);
 if(volume&&state.category==='fridge'&&Number(volume[1].replace(',','.'))>0&&Number(volume[1].replace(',','.'))<=3000){state.minVolume=Number(volume[1].replace(',','.'));state.volumeMax=/(?:до|не более|up to|մինչև)\s*$/i.test(text.slice(0,volume.index));}
 const diagonal=/(\d+(?:[.,]\d+)?)\s*(?:дюйм\p{L}*|inches|inch|["″]|դյույմ)/iu.exec(text);
 if(diagonal&&state.category==='tv'&&Number(diagonal[1].replace(',','.'))>0&&Number(diagonal[1].replace(',','.'))<=300){state.minDiagonal=Number(diagonal[1].replace(',','.'));state.diagonalMax=/(?:до|не более|up to|մինչև)\s*$/i.test(text.slice(0,diagonal.index));}
 const places=/(\d+)\s*(?:комплект\p{L}*|place settings|հավաքածու)/iu.exec(text);
 if(places&&state.category==='dishwasher'&&Number(places[1])>0&&Number(places[1])<=30){state.minPlaces=Number(places[1]);state.placesMax=/(?:до|не более|up to|մինչև)\s*$/i.test(text.slice(0,places.index));}
 const noise=/(?:до|не более|up to|մինչև)\s*(\d+(?:[.,]\d+)?)\s*(?:дб|db|դբ)/i.exec(text);
 if(noise&&Number(noise[1].replace(',','.'))>0&&Number(noise[1].replace(',','.'))<=160)state.maxNoise=Number(noise[1].replace(',','.'));
 if(/семь[яиюе]|семьи|family|ընտանիք/i.test(text)&&!state.capacity&&!state.minVolume&&!state.minPlaces)state.family=true;
 if(state.capacity||state.minVolume||state.minPlaces)delete state.family;
 if(/сброс|заново|начать сначала|start over|սկսել նորից/i.test(text))return {language:state.language,...(state.category?{category:state.category}:{})};
 if(/любой цвет|any colou?r|ցանկացած գույն/i.test(text))delete state.color;
 if(/без ограничени.*бюджет|без бюджета|no budget limit|առանց բյուջեի/i.test(text)){delete state.budgetMax;state.budgetSkipped=true;state.cheap=false;}
 if(/без ограничени.*(?:размер|габарит)|any size|առանց չափի սահմանափակման/i.test(text))for(const key of ['width','depth','height','widthMode','depthMode','heightMode','dimensionValue','dimensionAxis','dimensionMode'])delete state[key];
 state.page=wantsMore(text)?Math.min(100,(state.page||0)+1):wantsWhy(text)?state.page||0:0;
 return state;
}
const yes=value=>/^(?:yes|true|да|այո)$/i.test(String(value).trim());
export function preferenceMatch(state,p,specs,mode){
 let missing=false;
 const numeric=[['minVolume','capacity','fridge',true],['minDiagonal','diagonal','tv',true],['minPlaces','capacity','dishwasher',true],['maxNoise','quiet',state.category,false]];
 for(const [field,priority,category,min] of numeric)if(state[field]){const m=metric(specs,category,priority),isMax=state[{minVolume:'volumeMax',minDiagonal:'diagonalMax',minPlaces:'placesMax'}[field]];if(m.value==null)missing=true;else if(min&&!isMax?m.value<state[field]:m.value>state[field])return {accepted:false};}
 if(state.priority&&!['price'].includes(state.priority)&&metric(specs,state.category,state.priority).value==null)missing=true;
 if(state.noFrost!==undefined){
  const rows=specs.filter(s=>/^(?:refrigerator|freezer|freezing system|cooling system)$|систем.*(?:охлажд|размор)|սառեցման համակարգ/i.test(s.name));
  if(!rows.length)missing=true;else if(state.noFrost?!rows.every(s=>/no\s*frost/i.test(s.value)):rows.some(s=>/no\s*frost/i.test(s.value)))return {accepted:false};
 }
 if(state.smart!==undefined){const s=specs.find(s=>/smart tv supported|smart.*tv|смарт/i.test(s.name));if(!s)missing=true;else if(yes(s.value)!==state.smart)return {accepted:false};}
 if(state.fourK){const s=specs.find(s=>/^resolution|разрешение|թույլատրություն/i.test(s.name)),nums=s?.value.match(/\d+/g)?.map(Number)||[];if(nums.length!==2)missing=true;else if(Math.max(...nums)<3840||Math.min(...nums)<2160)return {accepted:false};}
 if(state.color){const s=specs.find(s=>/^colou?r$|^цвет$|^գույն$/i.test(s.name));if(!s)missing=true;else if(!({white:/white|бел|սպիտակ/i,black:/black|ч[её]рн|սև/i,silver:/silver|серебр|արծաթ/i}[state.color].test(s.value)))return {accepted:false};}
 if(state.inStock&&(p.catalogScope==='public'||!(p.stockAvailable===true||(p.stockAvailable==null&&(p.targetWarehousesStock>=3||p.stockStatus==='Առկա է')))))return {accepted:false};
 if(state.promo&&(p.catalogScope==='public'||!(mode==='KP'?p.kpIsPromo===true:p.isWholesalePromo===true)))return {accepted:false};
 return {accepted:!missing,unconfirmed:missing};
}
export function priorityCompare(a,b,state){
 if(!state.priority||state.priority==='price')return 0;
 const x=metric(a.specifications,state.category,state.priority),y=metric(b.specifications,state.category,state.priority);
 return x.value==null||y.value==null?0:(x.value-y.value)*x.direction;
}
export function isRecognizedFollowup(message,prior,state){
 const omit=['language','page','pending','shown'];
 const clean=s=>JSON.stringify(Object.fromEntries(Object.entries(s||{}).filter(([k])=>!omit.includes(k)).sort(([a],[b])=>a.localeCompare(b))));
 return clean(prior)!==clean(state)||wantsMore(message)||wantsWhy(message)||/те же|такие же|эти вариант|снова|повтори|same|again|նույն|կրկին/i.test(message)||Object.values(preferenceCopy).some(t=>Object.values(t).includes(message.trim()));
}
export function preferenceSummary(state){
 const t=preferenceCopy[state.language],out=[];
 if(state.priority)out.push(t[state.priority]);
 for(const field of ['minVolume','minDiagonal','minPlaces','maxNoise'])if(state[field]){const isMax=state[{minVolume:'volumeMax',minDiagonal:'diagonalMax',minPlaces:'placesMax'}[field]];out.push((isMax?{ru:{minVolume:'Объём до',minDiagonal:'Диагональ до',minPlaces:'Комплектов до'},hy:{minVolume:'Ծավալ՝ մինչև',minDiagonal:'Անկյունագիծ՝ մինչև',minPlaces:'Հավաքածուներ՝ մինչև'},en:{minVolume:'Volume up to',minDiagonal:'Diagonal up to',minPlaces:'Place settings up to'}}[state.language][field]:t[field])+': '+state[field]+({minVolume:' l',minDiagonal:'″',minPlaces:'',maxNoise:' dB'}[field]));}
 for(const key of ['inStock','promo','noFrost','smart','fourK'])if(state[key])out.push(t[key]);
 if(state.color)out.push(t.color+': '+t[state.color]);
 return out;
}
export function selectionReasons(product,state){
 const t=preferenceCopy[state.language],reasons=[];
 const m=metric(product.specifications,state.category,state.priority||'price');
 if(m.value!=null)reasons.push(t[m.key]+': '+m.value+' '+m.unit);
 for(const key of ['noFrost','smart','fourK'])if(state[key])reasons.push(t[key]);
 if(state.capacity){const load=metric(product.specifications,state.category,'capacity');if(load.value!=null){const text=t[load.key]+': '+load.value+' '+load.unit;if(!reasons.includes(text))reasons.push(text);}}
 if(state.color)reasons.push(t.color+': '+t[state.color]);
 if(state.inStock)reasons.push(t.inStock);
 if(state.promo)reasons.push(t.promo);
 for(const [field,key] of [['minVolume','capacity'],['minDiagonal','diagonal'],['minPlaces','capacity'],['maxNoise','quiet']])if(state[field]){const v=metric(product.specifications,state.category,key);if(v.value!=null){const text=t[v.key]+': '+v.value+' '+v.unit;if(!reasons.includes(text))reasons.push(text);}}
 for(const axis of ['width','depth','height'])if(state[axis]&&product.matchedDimensions?.[axis]!=null)reasons.push(({ru:{width:'Ширина',depth:'Глубина',height:'Высота'},hy:{width:'Լայնություն',depth:'Խորություն',height:'Բարձրություն'},en:{width:'Width',depth:'Depth',height:'Height'}}[state.language][axis])+': '+product.matchedDimensions[axis]+' cm');
 if(product.price)reasons.push((state.language==='ru'?'Цена':state.language==='hy'?'Գին':'Price')+': '+product.price.amount.toLocaleString('en-US')+' ֏');
 return reasons.slice(0,6);
}
