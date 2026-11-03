/* API 79 filters before its 100-row limit. A finished page merges two filtered
   requests with one shared number cursor; unsupported statuses never reach API. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){root.ZZWS_ADMIN_ORDER_GROUPS=api;api.mount(root);}
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const current=['unfinished','new','confirmed','in_progress','completed','approval_pending'],finished=['finished','received','rejected'],allowed=new Set([...current,...finished]);
 const labels={
  ru:{unfinished:'Текущие',finished:'Завершённые',all:'Все',new:'Новые',confirmed:'Подтверждены',in_progress:'Оформлены',completed:'Доставлены — ждём получения',approval_pending:'Ждут согласования',received:'Получены',rejected:'Отклонены',group:'Группа заказов',status:'Статус заказа',hint:'Доставленные заказы остаются текущими до подтверждения получения. Полученные и отклонённые находятся в завершённых.'},
  hy:{unfinished:'Ընթացիկ',finished:'Ավարտված',all:'Բոլորը',new:'Նոր',confirmed:'Հաստատված',in_progress:'Ձևակերպված',completed:'Առաքված — սպասում են ստացմանը',approval_pending:'Սպասում են հաստատմանը',received:'Ստացված',rejected:'Մերժված',group:'Պատվերների խումբ',status:'Պատվերի կարգավիճակ',hint:'Առաքված պատվերները մնում են ընթացիկ մինչև ստացման հաստատումը։ Ստացված և մերժված պատվերները գտնվում են ավարտվածներում։'}
 };
 let win=null,views=[];
 const normalize=value=>allowed.has(value)?value:'unfinished';
 function groupForOrder(order){return order?.received_at||['received','rejected'].includes(order?.status)?'finished':'unfinished';}
 function matches(order,value){
  const status=normalize(value);
  if(status==='finished')return ['received','rejected'].includes(order.status);
  if(status==='unfinished')return ['new','confirmed','in_progress','completed'].includes(order.status)&&!order.received_at;
  if(status==='approval_pending')return ['new','confirmed','in_progress'].includes(order.status)&&!order.received_at&&order.approval?.state==='pending';
  return order.status===status;
 }
 function merge(orders){
  const unique=new Map();
  for(const order of orders){const previous=unique.get(order.id);if(!previous||Number(order.revision||0)>=Number(previous.revision||0))unique.set(order.id,order);}
  return [...unique.values()].sort((a,b)=>Number(b.number)-Number(a.number));
 }
 async function fetchPage(path,request){
  const [route,query='']=path.split('?'),params=new URLSearchParams(query);
  if(route!=='admin/orders')throw new Error('Order groups only load the admin orders list.');
  if(params.get('status')&&!allowed.has(params.get('status')))throw new Error('Unsupported order status.');
  if(params.get('status')!=='finished'){
   const data=await request(path);return {...data,hasMore:data.orders.length===100};
  }
  const data=await Promise.all(['received','rejected'].map(status=>{const next=new URLSearchParams(params);next.set('status',status);return request(route+'?'+next);}));
  const orders=merge(data.flatMap(page=>page.orders));return {orders:orders.slice(0,100),hasMore:orders.length>=100};
 }
 async function fetchWindow(path,request,targetCount=100){
  const [route,query='']=path.split('?'),params=new URLSearchParams(query),target=Math.max(100,Number(targetCount)||100);
  let orders=[],hasMore=false;
  do{
   const page=await fetchPage(route+'?'+params,request);orders=merge([...orders,...page.orders]);hasMore=page.hasMore;
   if(!hasMore||orders.length>=target)break;
   const before=Number(params.get('before')||Infinity),next=Number(page.orders.at(-1)?.number);
   if(!Number.isSafeInteger(next)||next>=before)throw new Error('The orders cursor did not advance.');
   params.set('before',String(next));
  }while(true);
  return {orders,hasMore};
 }
 function repaint(){
  if(!win)return;const text=labels[win.ZZWS_I18N?.language==='ru'?'ru':'hy'];
  for(const view of views){
   const value=normalize(view.select.value),group=finished.includes(value)?'finished':'unfinished';
   view.groups.setAttribute('aria-label',text.group);view.statuses.setAttribute('aria-label',text.status);view.hint.textContent=text.hint;
   for(const button of view.groups.children){const active=button.dataset.orderGroup===group;button.textContent=text[button.dataset.orderGroup];button.setAttribute('aria-pressed',String(active));button.dataset.actionTone=active?'primary':'secondary';}
   for(const button of view.statuses.children){const status=button.dataset.orderStatus,active=status===value;button.hidden=!(group==='finished'?finished:current).includes(status);button.textContent=['unfinished','finished'].includes(status)?text.all:text[status];button.setAttribute('aria-pressed',String(active));button.dataset.actionTone=active?'primary':'secondary';}
  }
 }
 function setFilter(value,{reload=false,view}={}){
  const status=normalize(value);for(const entry of views)entry.select.value=status;repaint();
  if(reload){const source=views.find(entry=>entry.name===view)||views.find(entry=>!entry.section.hidden)||views[0];source?.select.dispatchEvent(new win.Event('change',{bubbles:true}));}
  return status;
 }
 function sync(view){const source=views.find(entry=>entry.name===view);return setFilter(source?.select.value||'unfinished');}
 function mount(window){
  if(win)return;win=window;const doc=win.document;
  for(const [name,id,toolbar] of [['orders','orderStatusFilter','.admin-orders-toolbar'],['manager','managerStatusFilter','.manager-toolbar']]){
   const select=doc.getElementById(id),section=doc.getElementById(name);if(!select||!section)continue;
   const panel=doc.createElement('div');panel.className='order-groups';panel.dataset.i18nSkip='true';
   const groups=doc.createElement('div'),statuses=doc.createElement('div'),hint=doc.createElement('p');groups.className='order-group-switch';statuses.className='order-status-chips';groups.setAttribute('role','group');statuses.setAttribute('role','group');hint.className='help order-group-hint';
   for(const group of ['unfinished','finished']){const button=doc.createElement('button');button.type='button';button.dataset.orderGroup=group;button.onclick=()=>setFilter(group,{reload:true,view:name});groups.append(button);}
   for(const status of [...current,...finished]){const button=doc.createElement('button');button.type='button';button.dataset.orderStatus=status;button.onclick=()=>setFilter(status,{reload:true,view:name});statuses.append(button);}
   panel.append(groups,statuses,hint);section.querySelector(toolbar)?.before(panel);select.closest('label').hidden=true;
   views.push({name,select,section,groups,statuses,hint});
   select.addEventListener('change',()=>setFilter(select.value));
  }
  win.addEventListener('zzws:languagechange',repaint);sync('orders');
 }
 return Object.freeze({mount,setFilter,sync,groupForOrder,matches,merge,fetchPage,fetchWindow});
});
