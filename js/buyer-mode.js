/* Buyer presentation uses only the public offer DTO. It never renders purchase prices. */
(() => {
 'use strict';
 const copy={
  ru:{setup:'Подготовить показ покупателю',setupHint:'Настройки расчёта видит только сотрудник. После начала показа они будут закрыты.',name:'Имя покупателя',phone:'Телефон покупателя',markup:'Минимальная наценка от закупки, %',category:'Закупочная категория',begin:'Начать показ',cancel:'Отмена',mode:'Режим покупателя',exit:'Завершить показ',search:'Модель, название или артикул',all:'Все категории',cart:'Корзина предложения',catalog:'Каталог',selected:'Выбранные товары',sourceCart:'Из рабочей корзины',sourceProduct:'Выбранный товар',sourceBundle:'Состав комплекта',source:'Источник',price:'Цена покупателю, ֏',qty:'Количество',add:'Добавить в предложение',added:'В предложении',remove:'Убрать',empty:'Выберите товары в каталоге.',noResults:'Товары не найдены.',available:'Доступно',clarify:'Наличие уточняется',unpriced:'Цена недоступна',form:'Сформировать предложение',total:'Итого',checking:'Проверяю цену…',priceError:'Эта цена недоступна. Увеличьте сумму и повторите проверку.',invalid:'Укажите целую положительную цену и количество от 1 до 9999.',loading:'Загрузка…',failed:'Действие не выполнено. Проверьте соединение и повторите.',notReady:'Режим ещё не доступен на действующем сервере. Требуется согласованное обновление.',pending:'Дождитесь проверки изменённых цен.',proposal:'Предложение покупателю',download:'Скачать Excel',downloadSent:'Запрос на скачивание Excel отправлен браузеру.',downloadHint:'При завершении Excel скачается автоматически, если вы ещё не запросили скачивание.',finish:'Завершить и перенести в рабочую корзину',transferring:'Сохраняю товары в рабочую корзину…',syncError:'Не удалось синхронизировать рабочую корзину. Повторите завершение; выбранные товары сохранены в предложении.',confirmExit:'Завершить показ без формирования предложения? Товары не будут перенесены в рабочую корзину.',profit:'Расчётная прибыль по предложению',profitHint:'Товары перенесены в рабочую корзину. Заказ ещё не оформлен.',done:'Продолжить работу',noneAvailable:'Выбранные товары больше не доступны. Можно выбрать другие в каталоге.',details:'Характеристики',noDetails:'Для этого товара дополнительные характеристики пока не получены.',close:'Назад',mandatory:'Имя, телефон и минимальная наценка обязательны.',clientPhone:'Телефон',count:'товаров',changed:'После изменения цены проверьте предложение ещё раз.',ownCatalog:'Сначала вернитесь в собственный каталог сотрудника. Режим показа не использует корзину другого зарегистрированного клиента.'},
  hy:{setup:'Պատրաստել գնորդի ցուցադրումը',setupHint:'Հաշվարկի կարգավորումները տեսնում է միայն աշխատակիցը։ Ցուցադրումը սկսելուց հետո դրանք կփակվեն։',name:'Գնորդի անունը',phone:'Գնորդի հեռախոսահամարը',markup:'Նվազագույն հավելագինը գնման գնից, %',category:'Գնման գնային կատեգորիա',begin:'Սկսել ցուցադրումը',cancel:'Չեղարկել',mode:'Գնորդի ռեժիմ',exit:'Ավարտել ցուցադրումը',search:'Մոդել, անվանում կամ արտիկուլ',all:'Բոլոր կատեգորիաները',cart:'Առաջարկի զամբյուղ',catalog:'Կատալոգ',selected:'Ընտրված ապրանքներ',sourceCart:'Աշխատանքային զամբյուղից',sourceProduct:'Ընտրված ապրանքը',sourceBundle:'Հավաքածուի կազմը',source:'Աղբյուր',price:'Գնորդի գին, ֏',qty:'Քանակ',add:'Ավելացնել առաջարկին',added:'Առաջարկում է',remove:'Հեռացնել',empty:'Ընտրեք ապրանքներ կատալոգից։',noResults:'Ապրանքներ չեն գտնվել։',available:'Հասանելի է',clarify:'Առկայությունը ճշտվում է',unpriced:'Գինը հասանելի չէ',form:'Կազմել առաջարկ',total:'Ընդամենը',checking:'Ստուգում եմ գինը…',priceError:'Այս գինը հասանելի չէ։ Ավելացրեք գումարը և կրկին ստուգեք։',invalid:'Նշեք դրական ամբողջ գին և 1-ից 9999 քանակ։',loading:'Բեռնվում է…',failed:'Գործողությունը չկատարվեց։ Ստուգեք կապը և կրկին փորձեք։',notReady:'Ռեժիմը դեռ հասանելի չէ գործող սերվերում։ Անհրաժեշտ է համաձայնեցված թարմացում։',pending:'Սպասեք փոփոխված գների ստուգմանը։',proposal:'Առաջարկ գնորդին',download:'Ներբեռնել Excel',downloadSent:'Excel-ի ներբեռնման հարցումն ուղարկված է բրաուզերին։',downloadHint:'Ավարտելիս Excel-ը կներբեռնվի ինքնաշխատ, եթե դեռ չեք ներբեռնել։',finish:'Ավարտել և փոխանցել աշխատանքային զամբյուղ',transferring:'Պահպանում եմ աշխատանքային զամբյուղում…',syncError:'Չհաջողվեց համաժամացնել աշխատանքային զամբյուղը։ Կրկին ավարտեք․ ընտրված ապրանքները պահպանված են առաջարկում։',confirmExit:'Ավարտե՞լ ցուցադրումը առանց առաջարկի։ Ապրանքները չեն փոխանցվի աշխատանքային զամբյուղ։',profit:'Առաջարկի հաշվարկային շահույթը',profitHint:'Ապրանքները փոխանցված են աշխատանքային զամբյուղ։ Պատվերը դեռ չի ձևակերպվել։',done:'Շարունակել աշխատանքը',noneAvailable:'Ընտրված ապրանքներն այլևս հասանելի չեն։ Կարող եք ընտրել այլ ապրանքներ կատալոգից։',details:'Բնութագրերը',noDetails:'Այս ապրանքի լրացուցիչ բնութագրերը դեռ չեն ստացվել։',close:'Հետ',mandatory:'Անունը, հեռախոսահամարը և նվազագույն հավելագինը պարտադիր են։',clientPhone:'Հեռախոս',count:'ապրանք',changed:'Գինը փոփոխելուց հետո կրկին ստուգեք առաջարկը։'}
 };
 const locale=()=>window.ZZWS_I18N?.language==='ru'?'ru':'hy',t=k=>copy[locale()][k]||k;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;el.dataset.i18nSkip='true';return el;};
 const button=(key,action,cls='buyer-button')=>{const b=node('button',t(key),cls);b.type='button';b.onclick=action;return b;};
 const money=value=>Number(value||0).toLocaleString(locale()==='ru'?'ru-RU':'hy-AM')+' ֏';
 const identity=()=>typeof serverIdentity!=='undefined'?serverIdentity:null;
 let turn=0,state=null,profitDialog=null;
 const valid=s=>state===s&&s.turn===turn&&identity()?.id===s.owner&&sessionStorage.getItem('zzws_session_v3')===s.token;
 const active=()=>!!state;
 const endpoint=action=>'dealer/buyer-offers/'+action;
 async function request(s,action,data={}){
  const result=await ZZWS.json(endpoint(action),{method:'POST',body:JSON.stringify({id:s.id,...data})});
  if(!valid(s))throw Object.assign(Error('Stale buyer mode'),{staleBuyerMode:true});return result;
 }
 function message(s,text,error=false){if(!valid(s))return;s.status.textContent=text;s.status.classList.toggle('buyer-error',error);}
 function fail(s,error){if(!valid(s)||error?.staleBuyerMode||error?.staleSession)return;message(s,error?.status===404?t('notReady'):t('failed'),true);}
 function field(text,input){const label=node('label',null,'buyer-field');label.append(node('span',text),input);return label;}
 function number(value,kind){const input=node('input');input.type='number';input.inputMode='numeric';input.step='1';input.min='1';input.max=kind==='qty'?'9999':'10000000000';input.value=value??'';return input;}
 function dialog(title,cls=''){
  const d=node('dialog',null,'buyer-mode '+cls),head=node('header',null,'buyer-header'),heading=node('h2',title);heading.id='buyerModeTitle'+(++turn);d.setAttribute('aria-labelledby',heading.id);head.append(heading);d.append(head);document.body.append(d);d.addEventListener('cancel',e=>e.preventDefault());return {d,head};
 }
 function closeState(s){
  if(state!==s)return;
  ++turn;state=null;
  s.observer?.disconnect();
  for(const extra of s.extras||[])extra.remove();
  s.dialog?.close();s.dialog?.remove();document.body.classList.remove('zzws-buyer-privacy');
  for(const [element,old]of s.visibility||[])if(element.isConnected){element.inert=old.inert;element.hidden=old.hidden;if(element.style){if(old.display)element.style.setProperty('display',old.display,old.priority);else element.style.removeProperty('display');}}
  if(s.paused){s.paused=false;const resumed=window.ZZWS_MEMORY?.resumeAfterBuyerMode?.();resumed?.catch?.(()=>{});}
  if(s.origin?.isConnected)s.origin.focus();
 }
 function reset(){if(state)closeState(state);profitDialog?.remove();profitDialog=null;}
 function rows(s){return [...s.selected.values()].map(row=>({articul:row.product.articul,qty:row.qty,salePrice:row.salePrice}));}
 function canForm(s){return s.selected.size>0&&[...s.selected.values()].every(row=>row.valid&&!row.pending)&&!s.busy;}
 function updateTotals(s){
  if(!valid(s))return;
  for(const row of s.drafts?.values()||[])if(row.addButton)row.addButton.disabled=!row.valid||row.pending||s.finalizeUncertain||s.busy;
  const values=[...s.selected.values()],total=values.reduce((sum,row)=>sum+(Number(row.salePrice)||0)*(Number(row.qty)||0),0);
  s.cartButton.textContent=t('cart')+' · '+values.length;s.summary.textContent=t('total')+' — '+money(total);s.formButton.disabled=!canForm(s);
  if(s.phase==='browse')s.exitButton.disabled=!!s.busy||!!s.finalizeUncertain;
  if(s.compareButton){s.compareButton.textContent=(locale()==='ru'?'Сравнить':'Համեմատել')+' · '+s.compared.size;s.compareButton.disabled=s.compared.size<2||!!s.busy;}
 }
 async function checkRow(s,row,output){
  const serial=++row.serial;row.valid=false;row.pending=true;row.error='';if(row.retryButton)row.retryButton.hidden=true;output.textContent=t('checking');updateTotals(s);
  if(!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>9999||!Number.isSafeInteger(row.salePrice)||row.salePrice<1||row.salePrice>1e10){row.pending=false;row.error=t('invalid');output.textContent=row.error;output.classList.add('buyer-error');updateTotals(s);return false;}
  try{
   const checked=await request(s,'quote',{lines:[{articul:row.product.articul,qty:row.qty,salePrice:row.salePrice}]});
   if(!valid(s)||serial!==row.serial)return false;
   const found=checked.lines?.find(line=>line.articul===row.product.articul);if(!found||Number(found.salePrice)!==row.salePrice||Number(found.qty)!==row.qty)throw Error('Invalid quote');
   row.valid=true;row.pending=false;row.lastValidSalePrice=row.salePrice;row.lastValidQty=row.qty;row.error='';output.textContent='';output.classList.remove('buyer-error');updateTotals(s);return true;
  }catch(error){if(!valid(s)||serial!==row.serial)return false;row.pending=false;row.error=error.status===409||error.status===400?t('priceError'):t('failed');if(error.status===409||error.status===400){row.salePrice=row.lastValidSalePrice;row.qty=row.lastValidQty;if(row.priceInput)row.priceInput.value=row.salePrice;if(row.qtyInput)row.qtyInput.value=row.qty;}if(row.retryButton)row.retryButton.hidden=false;output.textContent=row.error;output.classList.add('buyer-error');updateTotals(s);return false;}
 }
 function sanitizeProduct(p){
  if(!p||typeof p.articul!=='string'||!p.articul||typeof p.name!=='string')return null;
  return {articul:p.articul,name:p.name,brand:typeof p.brand==='string'?p.brand:'',category:typeof p.category==='string'?p.category:'',retail:typeof p.retail==='number'&&Number.isFinite(p.retail)?p.retail:null,salePrice:typeof p.salePrice==='number'&&Number.isSafeInteger(p.salePrice)&&p.salePrice>0?p.salePrice:null,stockAvailable:p.stockAvailable===true};
 }
 function productCard(s,p,inCart=false){
  const row=s.drafts.get(p.articul)||{product:p,qty:1,salePrice:p.salePrice,valid:!!p.salePrice,pending:false,serial:0,error:''};s.drafts.set(p.articul,row);
  const card=node('article',null,'buyer-product');card.dataset.buyerArticul=p.articul;
  const photo=node('div',null,'buyer-photo');if(typeof getProductImageHtml==='function')photo.innerHTML=getProductImageHtml(p.articul,p.name);
  card.append(photo,node('p',p.brand,'buyer-muted'),node('h3',p.name),node('p',p.articul,'buyer-sku'));
  const availability=node('p',p.stockAvailable?t('available'):t('clarify'),'buyer-availability');card.append(availability);
  const tools=node('div',null,'buyer-product-tools'),details=button('details',()=>showDetails(s,[p.articul]),'buyer-button buyer-secondary'),compare=button('details',()=>{if(s.compared.has(p.articul))s.compared.delete(p.articul);else if(s.compared.size<4)s.compared.add(p.articul);else{message(s,locale()==='ru'?'Для сравнения выберите не более четырёх товаров.':'Համեմատության համար ընտրեք առավելագույնը չորս ապրանք։',true);return;}render(s);},'buyer-button buyer-secondary');compare.textContent=(s.compared.has(p.articul)?'✓ ':'')+(locale()==='ru'?'Сравнить':'Համեմատել');compare.setAttribute('aria-pressed',String(s.compared.has(p.articul)));tools.append(details,compare);card.append(tools);
  const price=number(row.salePrice,'price'),qty=number(row.qty,'qty');price.setAttribute('aria-label',t('price'));qty.setAttribute('aria-label',t('qty'));
  row.priceInput=price;row.qtyInput=qty;row.lastValidSalePrice??=row.salePrice;row.lastValidQty??=row.qty;
  price.dataset.buyerSale=p.articul;qty.dataset.buyerQty=p.articul;const controls=node('div',null,'buyer-product-fields'),hint=node('p',row.error,'buyer-row-status');hint.setAttribute('role','status');
  row.output=hint;const add=button(s.selected.has(p.articul)?'added':'add',()=>{if(!valid(s)||!row.valid||row.pending||s.finalizeUncertain||s.busy)return;if(!s.selected.has(p.articul)&&s.selected.size>=500){message(s,locale()==='ru'?'В одном предложении допускается не более 500 товаров.':'Մեկ առաջարկում թույլատրվում է առավելագույնը 500 ապրանք։',true);return;}s.selected.set(p.articul,row);render(s);},'buyer-button buyer-primary');row.addButton=add;add.disabled=!row.valid||row.pending||s.finalizeUncertain||s.busy;price.disabled=qty.disabled=!!s.finalizeUncertain||!!s.busy;
  const changed=()=>{++row.serial;row.pending=false;row.salePrice=Number(price.value);row.qty=Number(qty.value);row.valid=false;add.disabled=true;hint.textContent=t('changed');updateTotals(s);};
  price.oninput=qty.oninput=changed;
  const checked=async()=>{add.disabled=true;await checkRow(s,row,hint);if(valid(s)&&card.isConnected)add.disabled=!row.valid||row.pending;};price.onchange=qty.onchange=checked;
  price.onblur=qty.onblur=()=>{if(valid(s)&&!row.valid&&!row.pending&&!s.busy&&!s.finalizeUncertain)checked();};
  const retry=button('checking',checked,'buyer-button buyer-secondary');retry.textContent=locale()==='ru'?'Проверить цену снова':'Կրկին ստուգել գինը';retry.hidden=!row.error;row.retryButton=retry;
  controls.append(field(t('price'),price),field(t('qty'),qty));card.append(controls,hint,retry);
  if(inCart){const remove=button('remove',()=>{if(s.finalizeUncertain||s.busy)return;s.selected.delete(p.articul);render(s);},'buyer-button buyer-secondary');remove.disabled=!!s.finalizeUncertain||!!s.busy;card.append(remove);}else card.append(add);
  return card;
 }
 function render(s){
  if(!valid(s)||s.phase!=='browse')return;
  const query=s.search.value.trim().toLocaleLowerCase(),category=s.category.value;
  let products=s.tab==='cart'?[...s.selected.values()].map(row=>row.product):s.products.filter(p=>(!category||p.category===category)&&(!query||(p.articul+' '+p.name+' '+p.brand).toLocaleLowerCase().includes(query)));
  s.grid.replaceChildren();s.catalogButton.setAttribute('aria-pressed',String(s.tab==='catalog'));s.cartButton.setAttribute('aria-pressed',String(s.tab==='cart'));s.filters.hidden=s.tab==='cart';
  if(!products.length)s.grid.append(node('p',s.tab==='cart'?t('empty'):t('noResults'),'buyer-empty'));
  for(const p of products.slice(0,s.tab==='cart'?500:s.limit))s.grid.append(productCard(s,p,s.tab==='cart'));
  if(s.tab==='catalog'&&products.length>s.limit){const more=button('catalog',()=>{s.limit+=40;render(s);},'buyer-button buyer-more');more.textContent=locale()==='ru'?'Показать ещё':'Ցույց տալ ավելին';s.grid.append(more);}
  updateTotals(s);
 }
 async function showDetails(s,ids){
  if(!valid(s)||!ids.length||ids.length>4||s.phase!=='browse')return;
  s.detailDialog?.close();s.detailDialog?.remove();const origin=document.activeElement,d=node('dialog',null,'buyer-mode buyer-public-details'),head=node('header',null,'buyer-header'),title=node('h2',ids.length===1?t('details'):(locale()==='ru'?'Сравнение товаров':'Ապրանքների համեմատություն')),body=node('div',null,'buyer-body');title.id='buyerPublicDetailsTitle';d.setAttribute('aria-labelledby',title.id);
  const close=()=>{d.close();d.remove();s.extras=s.extras.filter(value=>value!==d);if(s.detailDialog===d)s.detailDialog=null;if(origin?.isConnected)origin.focus();};head.append(title,button('close',close,'buyer-button buyer-secondary'));body.append(node('p',t('loading')));d.append(head,body);s.dialog.append(d);s.extras.push(d);s.detailDialog=d;d.addEventListener('cancel',event=>{event.preventDefault();close();});d.showModal();
  try{
   const data=await request(s,'details',{articuls:ids});if(!valid(s)||s.detailDialog!==d)return;
   const items=ids.map(id=>(data.items||[]).find(item=>item?.articul===id));if(items.some(item=>!item))throw Error('Unavailable details');body.replaceChildren();
   const specs=item=>(Array.isArray(item.specifications)?item.specifications:[]).filter(value=>value&&typeof value.name==='string'&&typeof value.value==='string').slice(0,200);
   if(ids.length===1){const info=items[0],p=s.products.find(value=>value.articul===ids[0]);body.append(node('h3',p?.name||info.name||ids[0]),node('p',ids[0],'buyer-muted'));const table=node('table',null,'buyer-spec-table');for(const spec of specs(info)){const row=node('tr');row.append(node('th',spec.name),node('td',spec.value));table.append(row);}if(table.children.length)body.append(table);else body.append(node('p',t('noDetails'),'buyer-muted'));}
   else{const wrap=node('div',null,'buyer-compare-scroll'),table=node('table',null,'buyer-spec-table buyer-compare-table'),header=node('tr');header.append(node('th',t('details')));for(const id of ids){const p=s.products.find(value=>value.articul===id),cell=node('th');cell.append(node('strong',p?.name||id),node('p',id,'buyer-muted'));table.append(header);header.append(cell);}const keys=[...new Set(items.flatMap(item=>specs(item).map(spec=>spec.name)))];for(const name of keys){const row=node('tr');row.append(node('th',name));for(const item of items)row.append(node('td',specs(item).find(spec=>spec.name===name)?.value||'—'));table.append(row);}if(!keys.length)body.append(node('p',t('noDetails'),'buyer-muted'));wrap.append(table);body.append(wrap);}
  }catch(error){if(valid(s)&&s.detailDialog===d)body.replaceChildren(node('p',t('failed'),'buyer-error'));}
 }
 async function form(s){
  if(!valid(s)||!canForm(s)){message(s,t('pending'),true);return;}
  s.busy=true;render(s);updateTotals(s);message(s,t('checking'));
  try{
   const input=s.finalizeUncertain?s.finalizeInput:rows(s);
   if(!s.finalizeUncertain){const checked=await request(s,'quote',{lines:input});if(!Array.isArray(checked.lines)||checked.lines.length!==input.length)throw Error('Invalid quote');}
   s.finalizeRequest||=crypto.randomUUID();s.finalizeInput=input;s.finalizeIssued=true;const offer=await request(s,'finalize',{requestId:s.finalizeRequest,lines:input});
   if(!offer||!Array.isArray(offer.lines)||!offer.id)throw Error('Invalid offer');
   s.offer=offer;s.phase='offer';s.downloadRequested=false;s.busy=false;renderOffer(s);
  }catch(error){if(valid(s)){s.busy=false;if(s.finalizeIssued&&!error.status){s.finalizeUncertain=true;render(s);}else if(error.status===400||error.status===409){s.finalizeIssued=false;s.finalizeRequest=null;s.finalizeInput=null;}render(s);message(s,error.status===400||error.status===409?t('priceError'):error.status===404?t('notReady'):t('failed'),true);updateTotals(s);}}
 }
 const offerNumber=offer=>/^ZZWS-\d{6,}$/.test(offer?.number||'')?offer.number:'';
 function renderOffer(s){
  if(!valid(s))return;
  s.dialog.classList.add('buyer-mode-offer');s.headTitle.textContent=t('proposal')+(offerNumber(s.offer)?' · № '+offerNumber(s.offer):'');s.body.replaceChildren();s.exitButton.hidden=true;
  const buyer=s.offer.buyer||s.buyer,identityBox=node('section',null,'buyer-offer-identity');identityBox.append(node('h3',buyer.name||''),node('p',t('clientPhone')+': '+(buyer.phone||'')));
  const finalized=new Date(s.offer.finalizedAt||s.offer.createdAt);if(Number.isFinite(finalized.valueOf()))identityBox.append(node('p',new Intl.DateTimeFormat(locale()==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(finalized)+' ('+(locale()==='ru'?'Ереван':'Երևան')+')'));s.body.append(identityBox);
  const list=node('div',null,'buyer-offer-lines');for(const line of s.offer.lines){const item=node('article',null,'buyer-offer-line');item.append(node('div',line.name||line.articul),node('small',line.articul),node('span',String(line.qty)+' × '+money(line.salePrice)),node('strong',money(Number(line.qty)*Number(line.salePrice))));list.append(item);}s.body.append(list,node('p',t('total')+' — '+money(s.offer.total),'buyer-offer-total'));
  const actions=node('div',null,'buyer-offer-actions');s.downloadButton=button('download',()=>download(s).catch(e=>fail(s,e)),'buyer-button buyer-secondary');s.finishButton=button('finish',()=>finish(s),'buyer-button buyer-primary');s.status=node('p',t('downloadHint'),'buyer-status');s.status.setAttribute('role','status');actions.append(s.downloadButton,s.finishButton);s.body.append(actions,s.status);
 }
 async function download(s){
  if(!valid(s)||!s.offer)return false;
  if(s.downloading)return s.downloading;
  s.downloadButton.disabled=true;
  const task=(async()=>{
   const response=await ZZWS.request(endpoint('export'),{method:'POST',body:JSON.stringify({id:s.offer.id})});
   if(!valid(s))return false;if(!response.ok)throw Object.assign(Error('Export failed'),{status:response.status});
   const blob=await response.blob();if(!valid(s))return false;
   if(!blob.size)throw Error('Empty export');
   const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='ZIGZAG-Offer'+(offerNumber(s.offer)?'-'+offerNumber(s.offer):'')+'.xlsx';a.hidden=true;s.dialog.append(a);
   try{a.click();s.downloadRequested=true;message(s,t('downloadSent'));}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
   return true;
  })();s.downloading=task;
  try{return await task;}finally{if(s.downloading===task)s.downloading=null;if(valid(s))s.downloadButton.disabled=!!s.finishing;}
 }
 async function finish(s){
  if(!valid(s)||!s.offer||s.finishing)return;
  s.finishing=true;s.finishButton.disabled=s.downloadButton.disabled=true;
  try{
   if(!s.downloadRequested&&!await download(s))return;
   if(!valid(s))return;message(s,t('transferring'));
   if(window.ZZWS_MEMORY?.flush&&await window.ZZWS_MEMORY.flush()===false)throw Object.assign(Error('Cart sync failed'),{sync:true});
   if(!valid(s))return;
   if(typeof window.ZZWS_BUYER_HANDOFF!=='function')throw Object.assign(Error('Cart adoption unavailable'),{sync:true});
   s.handoffRequest||=crypto.randomUUID();const result=await request(s,'handoff',{id:s.offer.id,requestId:s.handoffRequest});
   const profit=result.expectedProfit;if(typeof profit!=='number'||!Number.isFinite(profit)||profit<0)throw Error('Invalid profit');
   await window.ZZWS_BUYER_HANDOFF(result);if(!valid(s))return;
   closeState(s);showProfit(profit);
  }catch(error){if(valid(s))message(s,error.sync?t('syncError'):error.status===409?t('syncError'):t('failed'),true);}
  finally{if(valid(s)){s.finishing=false;s.finishButton.disabled=s.downloadButton.disabled=false;}}
 }
 function showProfit(profit){
  const {d,head}=dialog(t('profit'),'buyer-profit');profitDialog=d;const amount=node('strong',money(profit),'buyer-profit-amount'),hint=node('p',t('profitHint')),done=button('done',()=>{d.close();d.remove();if(profitDialog===d)profitDialog=null;},'buyer-button buyer-primary');head.append(done);d.append(amount,hint);d.showModal();done.focus();
 }
 function enter(s,data){
  s.id=data.id;s.buyer=data.buyer;s.phase='browse';s.products=[];s.drafts=new Map();s.selected=new Map();s.tab='catalog';s.limit=40;s.compared=new Set();
  s.body.replaceChildren();s.dialog.classList.remove('buyer-setup');s.dialog.classList.add('buyer-presentation');s.headTitle.textContent=t('mode');s.exitButton.textContent=t('exit');s.exitButton.hidden=false;
  s.buyerCaption=node('p',s.buyer.name+' · '+s.buyer.phone,'buyer-buyer-caption');s.head.append(s.buyerCaption);
  s.visibility=new Map();const hide=element=>{if(element===s.dialog)return;if(!s.visibility.has(element))s.visibility.set(element,{inert:element.inert,hidden:element.hidden,display:element.style?.getPropertyValue('display')||'',priority:element.style?.getPropertyPriority('display')||''});if(!element.inert)element.inert=true;if(!element.hidden)element.hidden=true;if(element.style?.getPropertyValue('display')!=='none'||element.style?.getPropertyPriority('display')!=='important')element.style?.setProperty('display','none','important');};
  for(const element of document.body.children)hide(element);if(typeof MutationObserver!=='undefined'){s.observer=new MutationObserver(records=>{for(const record of records){if(record.type==='attributes'&&record.target?.parentElement===document.body)hide(record.target);for(const element of record.addedNodes||[])if(element?.nodeType===1&&element.parentElement===document.body)hide(element);}});s.observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','style','open']});}document.body.classList.add('zzws-buyer-privacy');
  const tabs=node('nav',null,'buyer-tabs');s.catalogButton=button('catalog',()=>{s.tab='catalog';render(s);});s.cartButton=button('cart',()=>{s.tab='cart';render(s);});s.compareButton=button('details',()=>showDetails(s,[...s.compared]));tabs.append(s.catalogButton,s.cartButton,s.compareButton);
  s.filters=node('div',null,'buyer-filters');s.search=node('input');s.search.type='search';s.search.placeholder=t('search');s.search.setAttribute('aria-label',t('search'));s.category=node('select');s.category.setAttribute('aria-label',t('all'));const all=node('option',t('all'));all.value='';s.category.append(all);s.filters.append(s.search,s.category);
  const sourceLabels={catalog:'catalog',selection:'selected',cart:'sourceCart',product:'sourceProduct',bundle:'sourceBundle'};s.source=node('p',(locale()==='ru'?'Начальный список':'Սկզբնական ցանկը')+': '+t(sourceLabels[s.options.source]||'catalog')+(s.options.ids.length?' · '+s.options.ids.length:''),'buyer-source');
  s.grid=node('div',null,'buyer-grid');s.status=node('p',t('loading'),'buyer-status');s.status.setAttribute('role','status');s.summary=node('strong',null,'buyer-summary');s.formButton=button('form',()=>form(s),'buyer-button buyer-primary');s.formButton.disabled=true;const footer=node('footer',null,'buyer-footer');footer.append(s.summary,s.formButton);s.body.append(tabs,s.source,s.filters,s.status,s.grid,footer);s.search.oninput=s.category.onchange=()=>{s.limit=40;render(s);};
 }
 async function loadCatalog(s){
  const data=await request(s,'catalog');s.products=(Array.isArray(data.products)?data.products:[]).map(sanitizeProduct).filter(Boolean);
  for(const value of [...new Set(s.products.map(p=>p.category).filter(Boolean))].sort()){const option=node('option',value);option.value=value;s.category.append(option);}
  const wanted=new Set(Array.isArray(s.options.ids)?s.options.ids:[]);for(const p of s.products)if(wanted.has(p.articul)){const count=s.options.quantities?.[p.articul]??1,qty=Number.isInteger(count)&&count>0&&count<=9999?count:1;const row={product:p,qty,salePrice:p.salePrice,valid:!!p.salePrice,pending:false,serial:0,error:''};const saved=s.options.salePrices?.[p.articul];if(Number.isSafeInteger(saved)&&saved>0){try{const checked=await request(s,'quote',{lines:[{articul:p.articul,qty,salePrice:saved}]});if(checked.lines?.[0]?.salePrice===saved)row.salePrice=saved;}catch(error){if(!valid(s))throw error;row.error=t('changed');}}s.drafts.set(p.articul,row);s.selected.set(p.articul,row);}
  message(s,wanted.size&&!s.selected.size?t('noneAvailable'):'');if(s.selected.size)s.tab='cart';render(s);
 }
 function open(options={}){
  if(!identity()?.id)return;
  if(window.ZZWS_ASSISTED?.active?.()||window.ZZWS_CATALOG_VIEW?.active?.()){alert(locale()==='ru'?t('ownCatalog'):'Նախ վերադարձեք աշխատակցի սեփական կատալոգ։');return;}
  if(state){state.dialog.focus();return;}
  const {d,head}=dialog(t('setup'),'buyer-setup'),body=node('div',null,'buyer-body'),status=node('p',null,'buyer-status');status.setAttribute('role','status');
  const s={dialog:d,head,headTitle:head.querySelector('h2'),body,status,turn,owner:identity().id,token:sessionStorage.getItem('zzws_session_v3'),origin:document.activeElement,phase:'setup',options:{source:options.source||'catalog',ids:Array.isArray(options.ids)?[...new Set(options.ids)].filter(id=>typeof id==='string').slice(0,500):[],quantities:options.quantities||{},salePrices:options.salePrices||{}},extras:[],inert:[]};state=s;
  const exit=button('cancel',()=>{if(!valid(s)||s.busy)return;if(s.phase==='setup'||confirm(t('confirmExit')))closeState(s);},'buyer-button buyer-secondary');s.exitButton=exit;head.append(exit);d.append(body);
  const form=node('form',null,'buyer-setup-form'),name=node('input'),phone=node('input'),markup=node('input'),category=node('select');name.required=true;name.maxLength=100;name.autocomplete='name';phone.type='tel';phone.required=true;phone.maxLength=40;phone.autocomplete='tel';markup.type='number';markup.inputMode='decimal';markup.required=true;markup.min='0';markup.max='1000';markup.step='0.01';markup.value='15';
  if(window.ZZWS_PRICE_CATEGORIES)ZZWS_PRICE_CATEGORIES.populate(category,{selected:typeof adminOrderPriceMode!=='undefined'?adminOrderPriceMode:'Dealers'});else for(const [id,label]of [['Dealers','Մշտական Գորրընկեր'],['KP','Խոշոր Գործընկեր']]){const option=node('option',label);option.value=id;category.append(option);}
  if(identity().role!=='admin'){category.value=identity().sheet||'Dealers';category.disabled=true;}
  const sourceChoice=node('select'),sources=new Map([['catalog',{source:'catalog',ids:[],quantities:{},salePrices:{}}]]);
  if(typeof cart!=='undefined'&&cart&&Object.keys(cart).length)sources.set('cart',{source:'cart',ids:Object.keys(cart),quantities:Object.fromEntries(Object.entries(cart).map(([id,row])=>[id,row.qty])),salePrices:{}});
  if(s.options.ids.length)sources.set('initial',{...s.options});
  for(const [id,value]of sources){const key=value.source==='cart'?'sourceCart':value.source==='product'?'sourceProduct':value.source==='bundle'?'sourceBundle':value.source==='catalog'?'catalog':'selected';const option=node('option',t(key)+(value.ids.length?' · '+value.ids.length:''));option.value=id;sourceChoice.append(option);}sourceChoice.value=s.options.ids.length?'initial':'catalog';
  const begin=button('begin',null,'buyer-button buyer-primary');begin.type='submit';begin.disabled=true;form.append(node('p',t('setupHint'),'buyer-muted'),field(t('name'),name),field(t('phone'),phone),field(t('markup'),markup),field(t('category'),category),field(t('source'),sourceChoice),status,begin);body.append(form);
  form.onsubmit=async event=>{event.preventDefault();if(s.busy||!valid(s)||!form.reportValidity())return;if(!name.value.trim()){message(s,t('mandatory'),true);return;}if(!/^\+?[\d ()-]+$/.test(phone.value.trim())||phone.value.replace(/\D/g,'').length<8){message(s,locale()==='ru'?'Укажите корректный телефон покупателя.':'Նշեք գնորդի ճիշտ հեռախոսահամարը։',true);return;}s.busy=true;begin.disabled=exit.disabled=true;message(s,t('loading'));
   try{
    s.options={...sources.get(sourceChoice.value)};
    if(typeof window.ZZWS_MEMORY?.pauseForBuyerMode!=='function'||await window.ZZWS_MEMORY.pauseForBuyerMode()===false)throw Object.assign(Error('Cart sync failed'),{sync:true});s.paused=true;
    const data=await request(s,'start',{buyerName:name.value.trim(),buyerPhone:phone.value.trim(),markupPercent:Number(markup.value),priceCategory:category.value,source:s.options.source});
    if(!data.id||!data.buyer?.name||!data.buyer?.phone)throw Error('Invalid buyer session');enter(s,data);await loadCatalog(s);
   }catch(error){if(valid(s)&&s.phase==='setup'&&s.paused){s.paused=false;window.ZZWS_MEMORY?.resumeAfterBuyerMode?.();}if(error.sync)message(s,t('syncError'),true);else fail(s,error);}
   finally{if(valid(s)){s.busy=false;begin.disabled=exit.disabled=false;if(s.phase==='browse')render(s);}}
  };
  d.showModal();name.focus();
  request(s,'options').then(data=>{if(!valid(s)||s.phase!=='setup')return;category.replaceChildren();for(const row of data.priceCategories||[]){if(typeof row.id!=='string'||typeof row.label!=='string')continue;const option=node('option',row.label);option.value=row.id;category.append(option);}category.value=data.defaultPriceCategory||category.options[0]?.value||'';begin.disabled=!category.value;message(s,category.value?'':t('notReady'),!category.value);}).catch(error=>fail(s,error));return d;
 }
 window.ZZWS_BUYER_MODE=Object.freeze({open,reset,active});
 window.addEventListener('zzws:workspace-generation',reset);
 window.addEventListener('beforeunload',event=>{if(state&&state.phase!=='setup'){event.preventDefault();event.returnValue='';}});
})();
