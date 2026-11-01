import {statuses} from './orders.mjs';
import {deliveryId} from './delivery-variants.mjs';
const translations={
 hy:{summary:'Պատվերներ',lines:'Ապրանքներ',original:'Սկզբնական կազմ',proposals:'Չհամաձայնեցված առաջարկներ',number:'Պատվերի №',created:'Ստեղծվել է',updated:'Թարմացվել է',status:'Կարգավիճակ',revision:'Տարբերակ',total:'Պատվերի գումար, AMD',client:'Հաճախորդ',code:'Հաճախորդի կոդ',author:'Ուղարկել է',login:'Ուղարկողի մուտքանուն',organization:'Կազմակերպություն',contact:'Կոնտակտ',phone:'Հեռախոս',email:'Էլ․ փոստ',address:'Հասցե',method:'Առաքման եղանակ',date:'Առաքման օր',deadline:'Վճարման վերջնաժամկետ',customerComment:'Հաճախորդի մեկնաբանություն',adminComment:'Ադմինիստրատորի մեկնաբանություն',received:'Ստացվել է',approval:'Համաձայնեցում',pending:'Սպասում է համաձայնությանը',approved:'Համաձայնեցված',declined:'Հրաժարված',articul:'Արտիկուլ',name:'Անվանում',qty:'Քանակ',price:'Միավորի գին, AMD',amount:'Գումար, AMD',creator:'Լրացրել է ադմինիստրատոր',proposalId:'Առաջարկի նույնացուցիչ',exported:'Արտահանվել է',currency:'Արժույթ',scope:'Ընտրություն',all:'Բոլոր պատվերները',one:'Մեկ պատվեր',filtered:'Ընտրված պայմաններով',search:'Որոնում',from:'Սկսած',to:'Մինչև',receiptPending:'Միայն չփակված պատվերները',zone:'Ժամային գոտի',info:'Տեղեկություն',proposalNote:'Չհամաձայնեցված առաջարկները ընթացիկ պատվերի կազմ չեն։ Գումարները վերցված են պահպանված պատվերներից, ոչ ընթացիկ գնացուցակից։'},
 ru:{summary:'Заказы',lines:'Товары',original:'Первоначальный состав',proposals:'Предложения на согласование',number:'№ заказа',created:'Создан',updated:'Обновлён',status:'Статус',revision:'Версия',total:'Сумма заказа, AMD',client:'Клиент',code:'Код клиента',author:'Отправитель',login:'Логин отправителя',organization:'Организация',contact:'Контакт',phone:'Телефон',email:'Эл. почта',address:'Адрес',method:'Способ доставки',date:'Дата доставки',deadline:'Срок оплаты',customerComment:'Комментарий клиента',adminComment:'Комментарий администратора',received:'Получен',approval:'Согласование',pending:'Ожидает согласования',approved:'Согласовано',declined:'Отклонено',articul:'Артикул',name:'Наименование',qty:'Количество',price:'Цена за единицу, AMD',amount:'Сумма, AMD',creator:'Заполнил администратор',proposalId:'ID предложения',exported:'Выгружено',currency:'Валюта',scope:'Выборка',all:'Все заказы',one:'Один заказ',filtered:'По выбранным условиям',search:'Поиск',from:'С',to:'По',receiptPending:'Только незакрытые заказы',zone:'Часовой пояс',info:'Информация',proposalNote:'Предложения на согласование не являются текущим составом заказа. Суммы взяты из сохранённых заказов, а не из текущего прайс-листа.'}
};
const ruStatuses={new:'Новый',confirmed:'Подтверждён',in_progress:'Оформлен',completed:'Доставлен',rejected:'Отклонён',received:'Получен'};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
export function exportFilters(value={}){
 if(!object(value)||Object.keys(value).some(k=>!['search','from','to','receiptPending'].includes(k)))fail(400,'Ստուգեք արտահանման որոնման պայմանները');
 const filters={};
 for(const key of ['search','from','to'])if(value[key]!=null&&typeof value[key]!=='string')fail(400,'Ստուգեք արտահանման որոնման պայմանները');
 const search=String(value.search||'').trim();if(search.length>100||/[^\p{L}\p{N} ._-]/u.test(search))fail(400,'Մուտքագրեք պատվերի համարը կամ ճշգրիտ արտիկուլը');if(search)filters.search=search;
 for(const key of ['from','to'])if(value[key]){const date=value[key],stamp=new Date(date+'T00:00:00+04:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(stamp.valueOf())||new Date(stamp.valueOf()+14400000).toISOString().slice(0,10)!==date)fail(400,'Ստուգեք ամսաթիվը');filters[key]=date;}
 if(filters.from&&filters.to&&filters.from>filters.to)fail(400,'Սկզբի ամսաթիվը պետք է լինի մինչև ավարտը');
 if(value.receiptPending!=null&&typeof value.receiptPending!=='boolean')fail(400,'Ստուգեք արտահանման որոնման պայմանները');
 if(value.receiptPending)filters.receiptPending=true;
 return filters;
}
export function applyExportFilters(q,f){
 if(f.receiptPending)q=q.is('received_at',null).in('status',['new','confirmed','in_progress','completed']);
 if(f.search){const exact='lines.cs.'+JSON.stringify([{articul:f.search}]);q=q.or(/^\d{1,15}$/.test(f.search)?'number.eq.'+f.search+','+exact:exact);}
 if(f.from)q=q.gte('created',new Date(f.from+'T00:00:00+04:00').toISOString());
 if(f.to)q=q.lt('created',new Date(Date.parse(f.to+'T00:00:00+04:00')+86400000).toISOString());
 return q;
}
const authorName=value=>[value?.firstName,value?.lastName].filter(Boolean).join(' ')||value?.name||value?.login||'';
const safeText=v=>typeof v==='string'?v:typeof v==='number'?String(v):'';
const time=v=>v&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yerevan',dateStyle:'short',timeStyle:'medium'}).format(new Date(v)):'';
export function clientOrderWorkbook(orders,{locale='hy',filters={},single=false,now=new Date().toISOString()}={}){
 const t=translations[locale]||translations.hy,keys=['number','created','updated','status','revision','total','client','code','author','login','organization','contact','phone','email','address','method','date','deadline','customerComment','adminComment','received','approval','creator'];
 const status=s=>locale==='ru'?ruStatuses[s]||s:statuses[s]||s;
 const summary=[keys.map(k=>t[k])],lines=[[t.number,t.status,t.articul,t.name,t.qty,t.price,t.amount]],original=[[t.number,t.articul,t.name,t.qty,t.price,t.amount]],proposals=[[t.number,t.pending,t.proposalId,t.articul,t.name,t.qty,t.price,t.amount]];
 const lineRow=line=>[safeText(line.articul),safeText(line.name),Number(line.qty),Number(line.unitPrice),Math.round(Number(line.qty)*Number(line.unitPrice)*100)/100];
 for(const o of orders){
  const customer=o.customer||{},delivery=o.delivery||{},author=customer.author||{},creator=o.created_by||{},approval=o.approval||{};
  summary.push([Number(o.number),time(o.created),time(o.updated),status(o.status),Number(o.revision),Number(o.total),safeText(customer.client),safeText(customer.customerCode),authorName(author),safeText(author.login||customer.login),safeText(delivery.organization),safeText(delivery.contact),safeText(delivery.phone||author.phone),safeText(delivery.email||author.email),safeText(delivery.address),safeText(delivery.method),safeText(delivery.date),safeText(delivery.paymentDeadline),safeText(delivery.comment),safeText(o.comment),time(o.received_at),t[approval.state]||'',authorName(creator)]);
  for(const line of o.lines||[])lines.push([Number(o.number),status(o.status),...lineRow(line)]);
  for(const line of o.original_lines||o.lines||[])original.push([Number(o.number),...lineRow(line)]);
  if(approval.state==='pending')for(const line of approval.lines||[])proposals.push([Number(o.number),t.pending,safeText(approval.id),...lineRow(line)]);
 }
 const info=[[t.exported,time(now)],[t.zone,'Asia/Yerevan'],[t.currency,'AMD'],[t.scope,single?t.one:Object.keys(filters).length?t.filtered:t.all],...[...Object.entries(filters)].map(([key,value])=>[t[key]||key,typeof value==='boolean'?value:String(value)]),[t.info,t.proposalNote]];
 return {filename:single?'ZZWS-Order-'+orders[0].number+'.xlsx':'ZZWS-Orders.xlsx',sheets:[{name:t.summary,rows:summary,columns:keys.map(k=>({wch:['customerComment','adminComment','address'].includes(k)?44:['number','revision','total','code'].includes(k)?18:28}))},{name:t.lines,rows:lines,columns:[{wch:14},{wch:20},{wch:18},{wch:45},{wch:12},{wch:20},{wch:20}]},{name:t.original,rows:original,columns:[{wch:14},{wch:18},{wch:45},{wch:12},{wch:20},{wch:20}]},...(proposals.length>1?[{name:t.proposals,rows:proposals,columns:[{wch:14},{wch:28},{wch:38},{wch:18},{wch:45},{wch:12},{wch:20},{wch:20}]}]:[]),{name:t.info,rows:info,columns:[{wch:32},{wch:100}]}]};
}
export async function clientOrderExportRoute(c){
 if(c.path!=='orders/export'||c.req.method!=='POST')return null;
 if(c.user.role!=='client'||!c.user.id)c.fail(403,'Հասանելիությունն արգելված է');
 const p=await c.body(c.req);
 if(!object(p)||Object.keys(p).some(k=>!['id','filters','locale'].includes(k))||p.locale!=null&&!['ru','hy'].includes(p.locale)||p.id!=null&&!deliveryId(p.id)||p.filters!=null&&!object(p.filters)||p.id&&p.filters)c.fail(400,'Ստուգեք արտահանման պայմանները');
 const filters=exportFilters(p.filters||{}),own=()=>{
  let q=c.table('orders').select('id,number,revision,status,total,created,updated,received_at,customer,delivery,comment,created_by,lines,original_lines,approval');
  // Exactly the same scope as personal order history, re-applied on every page.
  if(c.user.clientRole==='manager'){
   if(!c.user.customerId)c.fail(403,'Հասանելիությունն արգելված է');q=q.eq('customer_id',c.user.customerId);
  }else q=q.eq('user_id',c.user.id);
  return q;
 };
 let orders=[];
 if(p.id){const o=await c.query(own().eq('id',p.id).maybeSingle());if(!o)c.fail(404,'Պատվերը չի գտնվել');orders=[o];}
 else{
  let before=null,count=0;
  for(;;){let q=applyExportFilters(own(),filters).order('number',{ascending:false}).limit(250);if(before!=null)q=q.lt('number',before);
   const page=await c.query(q);if(!Array.isArray(page))c.fail(500,'Չհաջողվեց պատրաստել արտահանումը');if(!page.length)break;
   for(const order of page){count+=(order.lines?.length||0)+(order.original_lines?.length||0)+(order.approval?.state==='pending'?order.approval.lines?.length||0:0);}
   if(orders.length+page.length>10000||count>100000)c.fail(413,'Տվյալների ծավալը մեծ է։ Ընտրեք ավելի կարճ ժամանակահատված և կրկին ներբեռնեք։');
   orders.push(...page);const next=Number(page.at(-1).number);if(!Number.isSafeInteger(next)||next<1||before!=null&&next>=before)c.fail(500,'Չհաջողվեց պատրաստել ամբողջական արտահանումը');before=next;
   // Do not infer end-of-history from an upstream REST row cap.
  }
 }
 const data=clientOrderWorkbook(orders,{locale:p.locale,filters,single:!!p.id});
 return c.file([],data.filename,[],data.sheets);
}
