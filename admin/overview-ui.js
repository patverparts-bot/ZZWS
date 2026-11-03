/* Owner overview: reads existing APIs and opens the shared order editor. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id),node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!=null)element.textContent=String(text);if(cls)element.className=cls;return element;};
 const words={
  ru:{title:'Обзор',intro:'Текущие задачи по заказам и состояние системы.',refresh:'Обновить',loading:'Обновляем данные…',updated:'Обновлено',partial:'Часть данных недоступна. Можно повторить обновление.',unavailable:'Данные недоступны',unread:'Не просмотрено мной',unreadHint:'Заказы и новые изменения',approval:'Ждут ответа клиента',approvalHint:'Включая отложенные напоминания',receipts:'Новые подтверждения получения',receiptsHint:'Ещё не просмотрены вами',unreadList:'Непросмотренные заказы',recentList:'Последние заказы',receiptList:'Подтверждения получения',recentFallback:'Показаны последние заказы. Отбор по личным отметкам просмотра временно недоступен.',listHint:'Показаны последние заказы, до 5. Полный список — в разделе «Заказы».',receiptHint:'Показаны последние подтверждения, до 5. Открытие заказа не заменяет просмотр подтверждения получения.',emptyUnread:'Непросмотренных заказов нет.',emptyOrders:'Заказов пока нет.',emptyReceipts:'Новых подтверждений получения нет.',listPartial:'Не удалось загрузить весь список для проверки. Показаны только найденные записи.',allOrders:'Открыть заказы',openOrder:'Открыть заказ',order:'Заказ',customer:'Клиент',changed:'Изменён',received:'Получение подтверждено',system:'Состояние системы',systemOk:'Последняя проверка успешна',systemAttention:'Требует внимания',systemStale:'Отчёт проверки устарел',systemUnknown:'Отчёта проверки пока нет',checked:'Проверено',noCheckDate:'Время проверки не указано',storedReport:'По сохранённому отчёту. Это не проверка в реальном времени.',systemLink:'Открыть проверку системы',price:'Действующий прайс',priceLink:'Открыть прайс',noPrice:'Версия не указана',accountVerified:'Вход подтверждён вторым фактором.',accountUnverified:'Активируйте двухэтапную защиту этого аккаунта.',ownerOnly:'Обзор доступен владельцу.',new:'Новый',confirmed:'Подтверждён',in_progress:'В работе',completed:'Доставлен',receivedStatus:'Получен',rejected:'Отклонён',awaiting:'Ждёт ответа клиента',unknownStatus:'Статус не указан'},
  hy:{title:'Ամփոփում',intro:'Պատվերների ընթացիկ աշխատանքներն ու համակարգի վիճակը։',refresh:'Թարմացնել',loading:'Տվյալները թարմացվում են…',updated:'Թարմացված է',partial:'Տվյալների մի մասը հասանելի չէ։ Կարող եք կրկին թարմացնել։',unavailable:'Տվյալները հասանելի չեն',unread:'Իմ կողմից չդիտված',unreadHint:'Պատվերներ և նոր փոփոխություններ',approval:'Սպասում են հաճախորդի պատասխանին',approvalHint:'Ներառյալ հետաձգված հիշեցումները',receipts:'Ստացման նոր հաստատումներ',receiptsHint:'Ձեր կողմից դեռ չդիտված',unreadList:'Չդիտված պատվերներ',recentList:'Վերջին պատվերները',receiptList:'Ստացման հաստատումներ',recentFallback:'Ցուցադրված են վերջին պատվերները։ Անձնական դիտման նշումներով ընտրությունը ժամանակավորապես հասանելի չէ։',listHint:'Ցուցադրված են մինչև 5 վերջին պատվերները։ Ամբողջ ցանկը՝ «Պատվերներ» բաժնում։',receiptHint:'Ցուցադրված են մինչև 5 վերջին հաստատումները։ Պատվերը բացելը չի փոխարինում ստացման հաստատումը դիտելուն։',emptyUnread:'Չդիտված պատվերներ չկան։',emptyOrders:'Պատվերներ դեռ չկան։',emptyReceipts:'Ստացման նոր հաստատումներ չկան։',listPartial:'Չհաջողվեց բեռնել ամբողջ ցանկը ստուգելու համար։ Ցուցադրված են միայն գտնված գրառումները։',allOrders:'Բացել պատվերները',openOrder:'Բացել պատվերը',order:'Պատվեր',customer:'Հաճախորդ',changed:'Փոխված է',received:'Ստացումը հաստատված է',system:'Համակարգի վիճակը',systemOk:'Վերջին ստուգումը հաջող է',systemAttention:'Ուշադրություն է պահանջվում',systemStale:'Ստուգման հաշվետվությունը հնացել է',systemUnknown:'Ստուգման հաշվետվություն դեռ չկա',checked:'Ստուգված է',noCheckDate:'Ստուգման ժամը նշված չէ',storedReport:'Ըստ պահպանված հաշվետվության։ Սա իրական ժամանակի ստուգում չէ։',systemLink:'Բացել համակարգի ստուգումը',price:'Գործող գնացուցակ',priceLink:'Բացել գնացուցակը',noPrice:'Տարբերակը նշված չէ',accountVerified:'Մուտքը հաստատված է երկրորդ գործոնով։',accountUnverified:'Ակտիվացրեք այս հաշվի երկփուլ պաշտպանությունը։',ownerOnly:'Ամփոփումը հասանելի է սեփականատիրոջը։',new:'Նոր',confirmed:'Հաստատված',in_progress:'Ձևակերպված է',completed:'Առաքված է',receivedStatus:'Ստացված է',rejected:'Մերժված',awaiting:'Սպասում է հաճախորդի պատասխանին',unknownStatus:'Կարգավիճակը նշված չէ'}
 };
 const lang=()=>window.ZZWS_I18N?.language==='ru'?'ru':'hy',copy=()=>words[lang()],locale=()=>lang()==='ru'?'ru-RU':'hy-AM';
 let current=null,epoch=0,snapshot=null,mode='unread',pending=null,unreadCache=null;
 const allowed=permission=>current?.permissions?.includes(permission)===true,owner=()=>current?.adminScope==='owner';
 const count=value=>(typeof value==='number'||typeof value==='string'&&/^[0-9]+$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
 const time=value=>{const date=new Date(value);return value&&Number.isFinite(date.valueOf())?date.toLocaleString(locale(),{timeZone:'Asia/Yerevan',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):null;};
 const result=settled=>settled.status==='fulfilled'?{ok:true,value:settled.value}:{ok:false,error:settled.reason};
 function action(text,callback,cls){const button=node('button',text,cls);button.type='button';button.dataset.actionTone='secondary';button.onclick=()=>runAction(callback);return button;}
 async function runAction(callback){const who=current?.id;try{await callback();}catch(error){if(current?.id!==who)return;if(error.status===401&&typeof showLogin==='function'){showLogin();return;}const root=el('ownerOverviewActionError');if(root){root.hidden=false;root.textContent=copy().unavailable;}}}
 function icon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',{unread:'M4 5h16v14H4z M4 6l8 6 8-6',approval:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',receipts:'M8 4h8v3H8z M8 5H5v16h14V5h-3 M8 14l3 3 5-6'}[kind]);svg.append(path);return svg;}
 function ensure(){
  const page=el('dashboard');if(!page)return null;page.classList.add('owner-overview');
  let heading=page.querySelector(':scope > h1');if(!heading){heading=node('h1');page.prepend(heading);}heading.dataset.i18nSkip='true';heading.textContent=copy().title;
  let intro=el('ownerOverviewIntro');if(!intro){intro=page.querySelector(':scope > p')||node('p');intro.id='ownerOverviewIntro';heading.after(intro);}intro.dataset.i18nSkip='true';intro.textContent=copy().intro;
  let toolbar=el('ownerOverviewToolbar');if(!toolbar){toolbar=node('div',null,'owner-overview-toolbar');toolbar.id='ownerOverviewToolbar';intro.after(toolbar);}
  let metrics=el('dashboardMetrics');if(!metrics){metrics=node('div');metrics.id='dashboardMetrics';toolbar.after(metrics);}metrics.dataset.i18nSkip='true';metrics.classList.add('owner-overview-metrics');
  let content=el('ownerOverviewContent');if(!content){content=node('div');content.id='ownerOverviewContent';metrics.after(content);}content.className='owner-overview-content';content.dataset.i18nSkip='true';
  let error=el('ownerOverviewActionError');if(!error){error=node('p',null,'owner-overview-error');error.id='ownerOverviewActionError';error.setAttribute('role','alert');error.hidden=true;content.after(error);}
  return {page,toolbar,metrics,content};
 }
 function personal(data){const protection=el('dashboardProtection');if(protection){protection.dataset.i18nSkip='true';protection.textContent=data.mfaVerified?copy().accountVerified:copy().accountUnverified;}const price=el('dashboardPrice');if(price){price.dataset.i18nSkip='true';price.textContent=copy().price+': '+(data.priceLabel||copy().noPrice);}}
 function landingTab(){if(owner())return 'dashboard';if(allowed('orders:read'))return 'manager';if(allowed('price:read'))return 'price';return 'accountSettings';}
 function setUser(user){
  reset();current=user;const permissions=user.permissions||[];
  const required={apkDownloads:'users',orderSettings:'users',manager:'orders:read',templates:'orders:read',warehouses:'rules',catalogControls:'rules',operations:'storage',orders:'orders:read',price:'price:read',users:'users',rules:'rules',storage:'storage',audit:'audit',email:'users',offers:'price:write'};
  for(const button of document.querySelectorAll('[data-tab]')){const tab=button.dataset.tab;button.hidden=['dashboard','mobileApp','systemDataReset','assistantHistory','proposalManagement'].includes(tab)?!owner():!!required[tab]&&!permissions.includes(required[tab]);}
  document.documentElement.dataset.orderRead=String(permissions.includes('orders:read'));document.documentElement.dataset.orderWrite=String(permissions.includes('orders:write'));document.documentElement.dataset.priceWrite=String(permissions.includes('price:write'));
  if(el('activateMfa'))el('activateMfa').hidden=false;
 }
 function reset(){
  ++epoch;current=null;snapshot=null;pending=null;unreadCache=null;mode='unread';
  for(const id of ['dashboardMetrics','ownerOverviewContent','ownerOverviewToolbar'])el(id)?.replaceChildren();
  const error=el('ownerOverviewActionError');if(error){error.textContent='';error.hidden=true;}
  if(el('dashboard'))el('dashboard').removeAttribute('aria-busy');
 }
 function can(tab){if(tab==='dashboard'||tab==='mobileApp')return owner();if(tab==='accountSettings')return current?.role==='admin';if(tab==='templates')return allowed('orders:read');if(tab==='orderSettings')return allowed('users');const button=document.querySelector('[data-tab="'+tab+'"]');return !!button&&!button.hidden;}
 async function loadAccount(){const who=current?.id,ticket=epoch,data=await ZZWS.json('admin/dashboard');if(current?.id===who&&epoch===ticket)personal(data);return data;}
 async function openApproval(){if(window.ZZWS_OVERVIEW_NAV?.openOrders)return window.ZZWS_OVERVIEW_NAV.openOrders({filter:'approval_pending'});for(const id of ['orderSearch','orderDatefrom','orderDateto'])if(el(id))el(id).value='';el('orderStatusFilter').value='approval_pending';await selectAdminTab('orders');}
 async function openOrder(id){if(!id)return;if(window.ZZWS_OVERVIEW_NAV?.openOrder)return window.ZZWS_OVERVIEW_NAV.openOrder(id);await selectAdminTab('manager');const order=await ZZWS_ADMIN_ORDERS.openNotice(id);if(order)window.ZZWS_ADMIN_WORKBENCH?.customer(order);}
 function readState(order){const revision=Number(order.revision);if(!Number.isSafeInteger(revision)||revision<1)return null;if(Object.hasOwn(order,'adminReadRevision'))return order.adminReadRevision==null||Number(order.adminReadRevision)<revision;if(typeof order.unread==='boolean')return order.unread;return null;}
 async function unreadOrders(first,summary,valid){
  if(!first.ok)return {ok:false,orders:[],available:false};
  const rows=Array.isArray(first.value.orders)?first.value.orders:[],total=summary.ok?count(summary.value.unreadCount):null;
  if(total===0)return {ok:true,orders:[],available:true};
  if(!rows.some(order=>readState(order)!==null))return {ok:true,orders:rows.slice(0,5),available:false};
  const key=summary.ok?String(summary.value.version)+':'+String(total):null;
  if(key&&unreadCache?.key===key)return unreadCache.value;
  const found=[],seen=new Set(),cursors=new Set();let page=rows,partial=false;
  while(valid()){
   for(const order of page)if(readState(order)===true&&!seen.has(order.id)){found.push(order);seen.add(order.id);if(found.length===5)break;}
   if(found.length===5||page.length<100||total!==null&&found.length>=total)break;
   const before=String(page.at(-1)?.number??'');if(!/^[0-9]+$/.test(before)||cursors.has(before)){partial=true;break;}cursors.add(before);
   try{const data=await ZZWS.json('admin/orders?'+new URLSearchParams({before}));if(!valid())return null;page=Array.isArray(data.orders)?data.orders:[];}catch(error){if(error.status===401)throw error;partial=true;break;}
  }
  if(total!==null&&found.length<Math.min(5,total))partial=true;
  const value={ok:true,orders:found,available:true,partial};if(key&&!partial&&valid())unreadCache={key,value};return value;
 }
 function summaryCard(kind,title,hint,value,callback){const button=node('button',null,'dashboard-metric owner-overview-metric');button.type='button';button.dataset.metric=kind;button.dataset.overviewMetric=kind;button.dataset.state=value===null?'unavailable':'ready';button.disabled=value===null;button.title=hint;const mark=node('span',null,'owner-overview-icon');mark.append(icon(kind==='approval_pending'?'approval':kind));button.append(mark,node('strong',value===null?'—':value.toLocaleString(locale()),'owner-overview-count'),node('span',title,'owner-overview-label'),node('small',value===null?copy().unavailable:hint,'owner-overview-hint'));if(kind!=='approval_pending')button.setAttribute('aria-pressed',String(mode===kind));button.onclick=()=>runAction(callback);return button;}
 function selectPanel(value){mode=value;render();const heading=el('ownerOverviewListTitle');heading?.focus({preventScroll:true});el('ownerOverviewList')?.scrollIntoView({block:'nearest'});}
 function status(order){return order.approval?.state==='pending'&&!order.received_at&&['new','confirmed','in_progress'].includes(order.status)?copy().awaiting:copy()[order.status==='received'?'receivedStatus':order.status]||copy().unknownStatus;}
 function orderRow(order,receipt=false){
  const item=node('li'),button=action('',()=>openOrder(receipt?order.order_id:order.id),'owner-overview-order');button.setAttribute('aria-label',copy().openOrder+' №'+order.number);button.removeAttribute('data-action-tone');button.dataset.overviewOrder=receipt?order.order_id:order.id;
  const identity=node('div',null,'owner-overview-order-identity');identity.append(node('strong','№'+order.number),node('span',order.customer?.client||copy().customer));const code=order.customer?.customerCode;if(code)identity.append(node('small',code,'owner-overview-customer-code'));
  const detail=node('div',null,'owner-overview-order-detail');detail.append(node('span',receipt?copy().received:status(order),'owner-overview-order-state'));
  const changed=time(receipt?order.created:order.updated||order.created);if(changed)detail.append(node('small',changed));if(!receipt&&Number.isFinite(Number(order.total)))detail.append(node('strong',Number(order.total).toLocaleString(locale())+' ֏','owner-overview-order-total'));
  button.append(identity,detail,node('span','›','owner-overview-order-arrow'));item.append(button);return item;
 }
 function renderList(root){
  const c=copy(),receipts=mode==='receipts',listData=receipts?snapshot?.notices:snapshot?.unread,available=!receipts&&listData?.available;
  const section=node('section',null,'owner-overview-panel owner-overview-list');section.id='ownerOverviewList';const heading=node('div',null,'owner-overview-panel-heading'),title=node('h2',receipts?c.receiptList:available?c.unreadList:c.recentList);title.id='ownerOverviewListTitle';title.tabIndex=-1;
  const all=action(c.allOrders,()=>window.ZZWS_OVERVIEW_NAV?.openOrders?ZZWS_OVERVIEW_NAV.openOrders({filter:'unfinished',view:'manager'}):selectAdminTab('manager'),'owner-overview-text-action');heading.append(title,all);section.append(heading);
  if(!listData?.ok){section.append(node('p',c.unavailable,'owner-overview-empty'));root.append(section);return;}
  const rows=receipts?(Array.isArray(listData.value.events)?listData.value.events:[]).slice(0,5):listData.orders;
  section.append(node('p',receipts?c.receiptHint:available?c.listHint:c.recentFallback,'owner-overview-note'));
  if(listData.partial)section.append(node('p',c.listPartial,'owner-overview-warning'));
  const list=node('ol',null,'owner-overview-order-list');list.id='ownerOverviewRows';for(const order of rows)list.append(orderRow(order,receipts));
  if(!rows.length)section.append(node('p',receipts?c.emptyReceipts:listData.partial?c.unavailable:available?c.emptyUnread:c.emptyOrders,'owner-overview-empty'));else section.append(list);root.append(section);
 }
 function renderSystem(root){
  const c=copy(),section=node('aside',null,'owner-overview-panel owner-overview-system');section.append(node('h2',c.system));
  const entry=snapshot?.operations,data=entry?.ok?entry.value:null,rawState=data&&['ok','attention','stale','unknown'].includes(data.status)?data.status:'unknown',state=!data?.report?'unknown':data.stale===true&&rawState!=='unknown'?'stale':rawState==='ok'&&!time(data.report.checkedAt)?'unknown':rawState,labels={ok:c.systemOk,attention:c.systemAttention,stale:c.systemStale,unknown:c.systemUnknown};
  const stateNode=node('p',entry?.ok?labels[state]:c.unavailable,'owner-overview-system-state');stateNode.id='overviewOperationsState';stateNode.dataset.state=entry?.ok?state:'unavailable';section.append(stateNode);
  const checked=time(data?.report?.checkedAt);section.append(node('p',checked?c.checked+': '+checked:c.noCheckDate,'owner-overview-note'),node('p',c.storedReport,'owner-overview-note'));
  if(can('operations'))section.append(action(c.systemLink,()=>selectAdminTab('operations'),'owner-overview-text-action'));
  const price=node('div',null,'owner-overview-price');price.append(node('h3',c.price),node('p',snapshot?.base.ok?snapshot.base.value.priceLabel||c.noPrice:c.unavailable));if(can('price'))price.append(action(c.priceLink,()=>selectAdminTab('price'),'owner-overview-text-action'));section.append(price);root.append(section);
 }
 function render(){
  const ui=ensure();if(!ui)return;const c=copy();ui.toolbar.dataset.i18nSkip='true';ui.toolbar.replaceChildren();const statusNode=node('p',pending?c.loading:snapshot?.loadedAt?c.updated+': '+time(snapshot.loadedAt):'', 'owner-overview-updated');statusNode.id='ownerOverviewStatus';statusNode.setAttribute('role','status');statusNode.setAttribute('aria-live','polite');const refresh=action(c.refresh,load,'owner-overview-refresh');refresh.id='ownerOverviewRefresh';refresh.disabled=!!pending;ui.toolbar.append(statusNode,refresh);ui.page.setAttribute('aria-busy',String(!!pending));
  if(!owner()){ui.metrics.replaceChildren();ui.content.replaceChildren(node('p',c.ownerOnly));return;}
  const base=snapshot?.base,summary=snapshot?.summary,notices=snapshot?.notices;
  ui.metrics.replaceChildren(summaryCard('unread',c.unread,c.unreadHint,summary?.ok?count(summary.value.unreadCount):null,()=>selectPanel('unread')),summaryCard('approval_pending',c.approval,c.approvalHint,base?.ok?count(base.value.counts?.approval_pending):null,openApproval),summaryCard('receipts',c.receipts,c.receiptsHint,notices?.ok?count(notices.value.unreadCount):null,()=>selectPanel('receipts')));
  ui.content.replaceChildren();if(!snapshot)return;if([snapshot.base,snapshot.summary,snapshot.notices,snapshot.recent,snapshot.operations].some(entry=>!entry.ok)){const warning=node('p',c.partial,'owner-overview-warning');warning.classList.add('owner-overview-wide');ui.content.append(warning);}renderList(ui.content);renderSystem(ui.content);
 }
 function load(){
  if(pending)return pending;const who=current?.id,ticket=epoch;if(!who)return Promise.resolve();if(!owner())return loadAccount();
  const valid=()=>current?.id===who&&epoch===ticket;let task;
  task=(async()=>{try{
   const settled=await Promise.allSettled(['admin/dashboard','admin/orders/summary','admin/orders/receipt-notifications','admin/orders','admin/operations'].map(path=>ZZWS.json(path)));if(!valid())return;
   const [base,summary,notices,recent,operations]=settled.map(result),unauthorized=[base,summary,notices,recent,operations].find(entry=>entry.error?.status===401);if(unauthorized)throw unauthorized.error;
   const unread=await unreadOrders(recent,summary,valid);if(!valid()||!unread)return;snapshot={base,summary,notices,recent,operations,unread,loadedAt:new Date().toISOString()};if(base.ok)personal(base.value);
  }finally{if(pending===task)pending=null;if(valid())render();}})();pending=task;render();return task;
 }
 window.addEventListener('zzws:languagechange',()=>{if(snapshot?.base.ok)personal(snapshot.base.value);render();});
 window.ZZWS_OWNER_OVERVIEW=Object.freeze({setUser,reset,load,can,landingTab,loadAccount,openApproval,openOrder});
})();
