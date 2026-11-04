import {checkedPriceCategory} from './price-categories.mjs';
import {orderExportData} from './order-export.mjs';
import {boundedMultipart} from './body-reader.mjs';
import {proposalCartProducts} from './proposal-cart.mjs';
import {clientOrderExportRoute} from './client-order-export.mjs';
import {viberContacts} from './contacts.mjs';
import {customerCodeKey} from './client-accounts.mjs';
import {priceVersionLabel} from './workbook-layout.mjs';
import {orderPublic} from './order-public.mjs';
import {projectOrderHistory} from './order-history.mjs';
import {currentOffer,offerStamp,offerDTO} from './special-offers.mjs';
import {effectiveControls} from './catalog-controls.mjs';
import {storefrontSettings,storefrontDTO,storefrontRanking} from './storefront.mjs';
import {statuses,normalizeLines,totalOf,changesBetween,parseConfirmation,parsePastedConfirmation} from './orders.mjs';
import {deliveryId,ownedDeliverySnapshot} from './delivery-variants.mjs';
import {buildOrderContext,calculationRetry} from './order-context.mjs';
export const awaitingCustomerApproval=q=>q.eq('approval->>state','pending').is('received_at',null).in('status',['new','confirmed','in_progress']);
export async function orderRoutes(c){
 const {path,req,user,service,table,query,body,json:rawJson,file,current,project,rowsFromBuffer,draft,fail}=c;
 const clientExport=await clientOrderExportRoute(c);if(clientExport)return clientExport;
 const json=(data,status)=>rawJson(orderPublic(data),status);
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error){if(calculationRetry(r.error))throw Object.assign(Error('Հաշվարկը պետք է թարմացվի'),{code:r.error.code});if(r.error.code==='PT429')fail(409,'Նոր պատվերի համար նախ հաստատեք բոլոր չստացված պատվերների ստացումը');if(r.error.code==='PT403')fail(403,'Հասանելիությունն արգելված է');if(r.error.code==='PT400')fail(400,name==='zzws_snooze_approval_reminder'?'Ընտրեք ապագա ամսաթիվ և ժամ':'Ստուգեք պատվերի և հաշվարկի տվյալները');if(r.error.code==='PT409')fail(409,name==='zzws_submit_order_v3'?'Հաճախորդի տվյալները փոխվել են։ Թարմացրեք էջը և կրկին ընտրեք առաքումը։ Զամբյուղը պահպանված է։':'Պատվերն արդեն փոխվել է կամ նախադիտման ժամկետը լրացել է։ Վերաբացեք պատվերը');if(r.error.code==='PT404')fail(404,'Պատվերը չի գտնվել');console.error('Order operation',r.error.code);fail(500,'Չհաջողվեց պահպանել պատվերը');}return r.data;};
 const checked=async action=>{for(let attempt=0;attempt<3;attempt++){try{return await action();}catch(e){if(!calculationRetry(e))throw e;if(attempt===2)fail(409,'Գնացուցակը փոխվում է։ Կրկին ստուգեք գները և ուղարկեք պատվերը։ Տվյալները պահպանված են։');}}};
 const order=async(id,admin=false)=>{let q=table('orders').select('*').eq('id',id);if(!admin)q=user.clientRole==='manager'?q.eq('customer_id',user.customerId):q.eq('user_id',user.id);const row=await query(q.maybeSingle());if(!row)fail(404,'Պատվերը չի գտնվել');return row;};
 const snoozes=async rows=>rows.length?await query(table('approval_reminder_snoozes').select('order_id,proposal_id,defer_request_id,order_revision,snoozed_until').eq('recipient_id',user.id).in('order_id',rows.map(o=>o.id))):[];
 const snoozedUntil=(o,rows)=>rows.find(s=>s.order_id===o.id&&s.proposal_id===o.approval.id&&s.defer_request_id===o.approval.deferRequestId&&s.order_revision===o.revision)?.snoozed_until||null;
 const historyFor=async(o,events)=>projectOrderHistory(o,await query(table('order_activity').select('id,order_id,order_number,revision,event_type,actor,source,snapshot,changes,occurred_at').eq('order_id',o.id).order('revision',{ascending:false}).limit(101)),events);
 if(path==='orders/approval-pending'&&req.method==='GET'){
  if(user.role!=='client')fail(403,'Հասանելիությունն արգելված է');
  const rows=await query(table('orders').select('id,number,revision,approval').eq('user_id',user.id).eq('approval->>state','pending').order('updated',{ascending:true}).limit(500));
  const paused=await snoozes(rows);
  return json({serverTime:new Date().toISOString(),orders:rows.map(o=>{const until=snoozedUntil(o,paused),after=until&&Date.parse(until)>Date.parse(o.approval.remindAfter||0)?until:o.approval.remindAfter||null;return {id:o.id,number:o.number,revision:o.revision,proposalId:o.approval.id,remindAfter:after,reminderDue:!after||Date.parse(after)<=Date.now()};})});
 }
 if(path==='orders/approval-defer'&&req.method==='POST'){
  const p=await body(req),allowed=['orderId','revision','proposalId','minutes','requestId'];
  if(user.role!=='client')fail(403,'Միայն հաճախորդը կարող է հաստատել փոփոխությունները');
  if(Object.keys(p).some(k=>!allowed.includes(k))||!deliveryId(p.orderId)||!deliveryId(p.proposalId)||!deliveryId(p.requestId)||!Number.isSafeInteger(p.revision)||!Number.isSafeInteger(p.minutes)||p.minutes<1||p.minutes>60)fail(400,'Ընտրեք 1-ից 60 րոպե');
  return json(await rpc('zzws_defer_order_approval',{p_user:user.id,p_order:p.orderId,p_revision:p.revision,p_proposal:p.proposalId,p_minutes:p.minutes,p_request:p.requestId}));
 }
 if(path==='orders/approval'&&req.method==='POST'){
  const p=await body(req),allowed=['orderId','revision','proposalId','decision','declinedArticuls','requestId'];
  if(user.role!=='client')fail(403,'Միայն հաճախորդը կարող է հաստատել փոփոխությունները');
  if(Object.keys(p).some(k=>!allowed.includes(k))||!deliveryId(p.orderId)||!deliveryId(p.proposalId)||!deliveryId(p.requestId)||!Number.isSafeInteger(p.revision)||!['accept','reject'].includes(p.decision)||!Array.isArray(p.declinedArticuls)||p.declinedArticuls.length>500||p.declinedArticuls.some(v=>typeof v!=='string')||new Set(p.declinedArticuls).size!==p.declinedArticuls.length)fail(400,'Ստուգեք համաձայնության պատասխանը');
  const o=await order(p.orderId),offer=o.approval;if(offer?.id!==p.proposalId)fail(409,'Առաջարկն արդեն փոխվել է։ Վերաբացեք պատվերը');
  const selected=(offer.lines||[]).filter(l=>!p.declinedArticuls.includes(l.articul));
  return json(await rpc('zzws_respond_order_approval',{p_user:user.id,p_order:o.id,p_revision:p.revision,p_proposal:p.proposalId,p_decision:p.decision,p_declined:p.declinedArticuls,p_request:p.requestId,p_total:p.decision==='accept'?totalOf(selected):0}));
 }
 if(path==='orders/quote'&&req.method==='POST'){
  const p=await body(req);if(!Array.isArray(p.articuls)||p.articuls.length>500||p.articuls.some(a=>typeof a!=='string'||!a||a.length>100))fail(400,'Ստուգեք զամբյուղի արտիկուլները');
  const wanted=new Set(p.articuls),v=await current(),products=project(v.products.filter(p=>wanted.has(p.articul)),user,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses});
  const refs=new Map((Array.isArray(p.proposalRefs)?p.proposalRefs:[]).filter(r=>r&&typeof r.articul==='string'&&typeof r.proposalHash==='string').map(r=>[r.articul,r.proposalHash]));const grants=(await proposalCartProducts(c,wanted)).filter(g=>refs.get(g.articul)===g.proposalHash),merged=[...new Map([...products,...grants].map(p=>[p.articul,p])).values()];
  if([...refs].some(([sku,hash])=>!grants.some(g=>g.articul===sku&&g.proposalHash===hash)))fail(409,'Առաջարկի ժամկետը լրացել է կամ այն հասանելի չէ։ Թարմացրեք զամբյուղը');
  return json({products:merged,unavailable:[...wanted].filter(a=>!merged.some(p=>p.articul===a))});
 }
 if(path==='orders'&&req.method==='POST'){
  const p=await body(req);if(!deliveryId(p.requestId))fail(400,'Ուղարկման սխալ նույնացուցիչ');
  const existing=await query(table('orders').select('*').eq('user_id',user.id).eq('request_id',p.requestId).maybeSingle());if(existing)return json(existing);
  const owned=ownedDeliverySnapshot(user,{...p.delivery,variantId:p.deliveryVariantId},p.profileRevision);
  return json(await checked(async()=>{
   const v=await current(),priceMode=user.role==='admin'?checkedPriceCategory(p.priceMode,v.rules):'WS',ordinary=project(v.products,user,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses}),grants=(await proposalCartProducts(c,new Set(Array.isArray(p.lines)?p.lines.map(l=>l?.articul):[]))).filter(g=>Array.isArray(p.lines)&&p.lines.some(l=>l.articul===g.articul&&l.proposalHash===g.proposalHash)),products=[...new Map([...ordinary,...grants].map(p=>[p.articul,p])).values()],lines=normalizeLines(p.lines,products,[],false,priceMode);if(!lines.length)fail(400,'Զամբյուղը դատարկ է');
   if(p.lines.some(l=>l.proposalHash&&!grants.some(g=>g.articul===l.articul&&g.proposalHash===l.proposalHash)))fail(409,'Առաջարկի ժամկետը լրացել է կամ այն հասանելի չէ։ Թարմացրեք զամբյուղը');
   if(lines.some((line,i)=>Number(p.lines[i].unitPrice)!==line.unitPrice))fail(409,'Գները փոխվել են։ Թարմացրեք զամբյուղը և ստուգեք գումարը մինչև ուղարկելը');
   const context=buildOrderContext({catalog:v,user,lines,priceMode,proposalProducts:grants});
   return rpc('zzws_submit_order_v3',{p_user:user.id,p_request:p.requestId,p_delivery_variant:owned.variantId,p_profile_revision:p.profileRevision,p_delivery:owned.delivery,p_lines:lines,p_total:totalOf(lines),p_context:context});
  }));
 }
 if(path==='orders'&&req.method==='GET'){
  const params=new URL(req.url).searchParams,before=params.get('before');let q=table('orders').select('*');q=user.clientRole==='manager'?q.eq('customer_id',user.customerId):q.eq('user_id',user.id);q=q.order('number',{ascending:false}).limit(50);
  if(params.get('receiptPending')==='true')q=q.is('received_at',null).in('status',['new','confirmed','in_progress','completed']);
  const search=String(params.get('search')||'').trim();if(search.length>100||/[^\p{L}\p{N} ._-]/u.test(search))fail(400,'Մուտքագրեք պատվերի համարը կամ ճշգրիտ արտիկուլը');
  if(search){const exact='lines.cs.'+JSON.stringify([{articul:search}]);q=q.or(/^\d{1,15}$/.test(search)?'number.eq.'+search+','+exact:exact);}
  for(const [param,method]of [['from','gte'],['to','lt']]){const date=params.get(param);if(date){const stamp=new Date(date+'T00:00:00+04:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(stamp.valueOf())||new Date(stamp.valueOf()+14400000).toISOString().slice(0,10)!==date)fail(400,'Ստուգեք ամսաթիվը');q=q[method]('created',new Date(stamp.valueOf()+(param==='to'?86400000:0)).toISOString());}}
  if(before&&/^\d+$/.test(before))q=q.lt('number',before);return json({orders:await query(q)});
 }
 if(path==='orders/notifications'&&req.method==='GET'){
  const events=await query(table('order_events').select('id,order_id,revision,detail,created').eq('user_id',user.id).is('read_at',null).order('created',{ascending:false}).limit(50));
  return json({events:events.map(e=>({...e,detail:{...e.detail,changesCount:e.detail.changes?.length||0,changes:(e.detail.changes||[]).slice(0,12)}}))});
 }
 if(path==='orders/detail'&&req.method==='POST'){
  const p=await body(req),o=await order(p.id);const events=await query(table('order_events').select('id,detail,created,revision').eq('order_id',o.id).eq('user_id',o.user_id).order('revision',{ascending:false}).limit(101));return json({order:{...o,...await historyFor(o,events)},events:events.slice(0,10)});
 }
 if(path==='orders/read'&&req.method==='POST'){
  const p=await body(req),o=await order(p.orderId);if(!Number.isSafeInteger(p.revision)||p.revision<1||p.revision>o.revision)fail(400,'Ստուգեք դիտված պատվերի տարբերակը');await query(table('order_events').update({read_at:new Date().toISOString()}).eq('user_id',user.id).eq('order_id',p.orderId).lte('revision',p.revision).is('read_at',null));return json({ok:true});
 }
 if(!path.startsWith('admin/orders'))return null;
 if(user.role!=='admin')fail(403,'Հասանելիությունն արգելված է');
 if(path==='admin/orders/approval-reminders'&&req.method==='GET'){
  if(!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
  const now=new Date(),rows=await query(table('orders').select('id,number,revision,customer,approval').is('received_at',null).in('status',['new','confirmed','in_progress']).eq('approval->>state','pending').gt('approval->>reviewRequestedMinutes','0').lte('approval->>remindAfter',now.toISOString()).order('approval->>remindAfter',{ascending:true}).limit(100));
  const paused=await snoozes(rows);
  return json({serverTime:now.toISOString(),orders:rows.filter(o=>Date.parse(o.approval.remindAfter)<=now.valueOf()).map(o=>({id:o.id,number:o.number,revision:o.revision,customer:{client:o.customer?.client||'',customerCode:o.customer?.customerCode||''},proposalId:o.approval.id,deferRequestId:o.approval.deferRequestId,minutes:o.approval.reviewRequestedMinutes,remindAfter:o.approval.remindAfter,snoozedUntil:snoozedUntil(o,paused)}))});
 }
 if(path==='admin/orders/approval-reminder/snooze'&&req.method==='POST'){
  if(!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
  const p=await body(req),allowed=['orderId','revision','proposalId','deferRequestId','until','includeClient','requestId'];
  if(Object.keys(p).some(k=>!allowed.includes(k))||!deliveryId(p.orderId)||!deliveryId(p.proposalId)||!deliveryId(p.deferRequestId)||!deliveryId(p.requestId)||!Number.isSafeInteger(p.revision)||typeof p.includeClient!=='boolean'||typeof p.until!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.until)||!Number.isFinite(Date.parse(p.until))||new Date(p.until).toISOString()!==p.until)fail(400,'Ընտրեք հիշեցման ճիշտ ամսաթիվը և ժամը');
  return json(await rpc('zzws_snooze_approval_reminder',{p_actor:user.id,p_order:p.orderId,p_revision:p.revision,p_proposal:p.proposalId,p_defer:p.deferRequestId,p_until:p.until,p_client:p.includeClient,p_request:p.requestId}));
 }
 if(path==='admin/orders/approval-reminder'&&req.method==='POST'){
  if(!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
  const p=await body(req);if(!deliveryId(p.orderId)||!deliveryId(p.proposalId)||!deliveryId(p.deferRequestId)||!Number.isSafeInteger(p.revision))fail(400,'Ստուգեք պատվերի և հաշվարկի տվյալները');
  const o=await order(p.orderId,true),a=o.approval;
  if(a?.state!=='pending'||o.received_at||!['new','confirmed','in_progress'].includes(o.status)||a.id!==p.proposalId||a.deferRequestId!==p.deferRequestId||o.revision!==p.revision||!a.reviewRequestedMinutes||!(Date.parse(a.remindAfter)<=Date.now()))fail(409,'Պատվերն արդեն փոխվել է։ Թարմացրեք ծանուցումը');
  const customer=await query(table('users').select('profile,active,person,customer_id').eq('id',o.user_id).maybeSingle());
  if(!customer?.active||customer.profile.role!=='client')fail(409,'Հաճախորդը հասանելի չէ');
  const contacts=customer.person?.phone?[{name:[customer.person.firstName,customer.person.lastName].filter(Boolean).join(' '),phone:customer.person.phone}]:viberContacts(customer.profile);
  const manager=customer.customer_id?await query(table('users').select('person,profile').eq('id',customer.customer_id).maybeSingle()):customer;
  return json({orderId:o.id,number:o.number,customer:customer.profile.client,contacts,phoneNumbers:contacts.map(c=>c.phone),managerPhone:manager?.person?.phone||manager?.profile.managerPhone||user.managerPhone||''});
 }
 const customerProfile=async id=>{
  if(!deliveryId(id))fail(400,'Ընտրեք հաճախորդ');const row=await query(table('users').select('*').eq('id',id).eq('active',true).maybeSingle());
  if(!row||row.profile.role!=='client')fail(403,'Ընտրեք գործող հաճախորդ');if(row.customer_id)fail(403,'Ընտրեք հաճախորդի հիմնական քարտը');return {...row.profile,id:row.id,customerCode:row.profile.customerCode||'',profileRevision:row.profile_revision};
 };
 const customerInfo=profile=>({id:profile.id,customerCode:profile.customerCode||'',client:profile.client,profileRevision:profile.profileRevision,rowsList:profile.rowsList,role:'client',allowResale:profile.allowResale===true});
 if(['admin/orders/customers','admin/orders/customer-quote','admin/orders/create','admin/orders/customer-catalog','admin/orders/customer-catalog/version','admin/orders/customer-catalog/export'].includes(path)&&!user.permissions?.includes('orders:write'))fail(403,'Պատվեր ստեղծելու իրավունքը բացակայում է');
 if(path==='admin/orders/customers'&&req.method==='GET'){
  const search=String(new URL(req.url).searchParams.get('search')||'').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,100);
  let q=table('users').select('id,profile').eq('active',true).is('customer_id',null).eq('profile->>role','client').order('profile->>customerCode').limit(50);
  if(search)q=q.or('profile->>customerCode.ilike.*'+search+'*,profile->>client.ilike.*'+search+'*');
  const rows=await query(q),key=customerCodeKey(search);let exact=null;
  if(search){let match=table('users').select('id,profile').eq('active',true).is('customer_id',null).eq('profile->>role','client');match=/^[0-9]{6}$/.test(key)?match.or('profile->>customerCode.ilike.'+key+'*'):match.eq('profile->>customerCode',search);const matches=await query(match.limit(2));if(matches.length===1&&customerCodeKey(matches[0].profile.customerCode)===key)exact=matches[0];}
  const choices=exact?[exact,...rows.filter(r=>r.id!==exact.id)].slice(0,50):rows;return json({customers:choices.map(r=>({id:r.id,customerCode:r.profile.customerCode||'',client:r.profile.client}))});
 }
 if(['admin/orders/customer-catalog','admin/orders/customer-catalog/version','admin/orders/customer-catalog/export'].includes(path)&&req.method==='GET'){
  const profile=await customerProfile(new URL(req.url).searchParams.get('customerId')),v=await current();
  const memory=await query(table('user_memory').select('data').eq('user_id',profile.id).maybeSingle());
  const hidden=memory?.data?.preferences?.hiddenColumns,hiddenColumns=Array.isArray(hidden)?hidden.filter(key=>['brand','stockStatus','retail','marginVal','resaleWholesale'].includes(key)):[];
  const offer=await currentOffer(table,query),version=v.id+':'+v.rulesRevision+':'+v.warehouseRevision+':'+profile.profileRevision+':'+JSON.stringify(hiddenColumns)+':offer:'+offerStamp(offer),updated=new Date(v.created).toLocaleDateString('en-GB',{timeZone:'Asia/Yerevan'});
  if(path.endsWith('/version'))return json({version,updated});
  const products=project(v.products,profile,v.rules,{mainWarehouses:v.mainWarehouses,newDays:storefrontSettings(v.catalogControls).newDays});
  if(path.endsWith('/export'))return file([['Ստացող',profile.client,'Տարբերակ',priceVersionLabel(v.created)],['Արտիկուլ','Բրենդ','Կատեգորիա','Անվանում','Մանրածախ','Ձեր գինը','Առկայություն',...(profile.allowResale?['Վերավաճառքի մեծածախ գին']:[])],...products.map(p=>[p.articul,p.brand,p.category,p.name,p.retail,p.wholesale,p.stockStatus,...(profile.allowResale?[p.resaleWholesale]:[])])],'PriceList.xlsx');
  const controls=effectiveControls(v.catalogControls,profile.customerId||profile.id);
  const banners=await storefrontRanking(service,query,products,v.catalogControls,profile.id,v.catalogControls?.popularityRules?.days||90);
  return json({customer:customerInfo(profile),hiddenColumns,products,version,updated,controls,storefront:storefrontDTO(products,banners,v.catalogControls),specialOffer:controls.promo?offerDTO(offer,products):null});
 }
 if(path==='admin/orders/customer-quote'&&req.method==='POST'){
  const p=await body(req),profile=await customerProfile(p.customerId);if(!Array.isArray(p.articuls)||p.articuls.length>500||p.articuls.some(a=>typeof a!=='string'||!a||a.length>100))fail(400,'Ստուգեք արտիկուլները');
  const wanted=new Set(p.articuls),v=await current(),products=project(v.products.filter(product=>wanted.has(product.articul)),profile,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses});return json({customer:customerInfo(profile),products,unavailable:[...wanted].filter(a=>!products.some(p=>p.articul===a))});
 }
 if(path==='admin/orders/create'&&req.method==='POST'){
  const p=await body(req);if(!deliveryId(p.requestId)||!deliveryId(p.customerId))fail(400,'Ուղարկման սխալ նույնացուցիչ');
  const existing=await query(table('orders').select('*').eq('user_id',p.customerId).eq('request_id',p.requestId).maybeSingle());if(existing){if(existing.created_by?.id!==user.id)fail(409,'Ուղարկման նույնացուցիչն արդեն օգտագործվել է');return json(existing);}
  const profile=await customerProfile(p.customerId),owned=ownedDeliverySnapshot(profile,{...p.delivery,variantId:p.deliveryVariantId},p.profileRevision);
  return json(await checked(async()=>{const v=await current(),products=project(v.products,profile,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses}),lines=normalizeLines(p.lines,products);if(!lines.length)fail(400,'Զամբյուղը դատարկ է');if(lines.some((line,i)=>Number(p.lines[i].unitPrice)!==line.unitPrice))fail(409,'Հաճախորդի գները փոխվել են։ Թարմացրեք հաշվարկը և կրկին ստուգեք պատվերը');const context=buildOrderContext({catalog:v,user:profile,lines});return rpc('zzws_submit_customer_order',{p_actor:user.id,p_user:profile.id,p_request:p.requestId,p_delivery_variant:owned.variantId,p_profile_revision:p.profileRevision,p_delivery:owned.delivery,p_lines:lines,p_total:totalOf(lines),p_context:context});}));
 }
 if(path==='admin/orders/summary'&&req.method==='GET')return json(await rpc('zzws_admin_order_summary',{p_user:user.id}));
 if(path==='admin/orders/read'&&req.method==='POST'){const p=await body(req);if(!Number.isSafeInteger(p.revision)||typeof p.id!=='string')fail(400,'Ստուգեք պատվերի դիտված տարբերակը');await rpc('zzws_mark_admin_order_read',{p_user:user.id,p_order:p.id,p_revision:p.revision});return json({ok:true});}
 if(path==='admin/orders/status'&&req.method==='POST'){
  const p=await body(req);if(!Object.hasOwn(statuses,p.status)||p.status==='received'||!Number.isSafeInteger(p.revision))fail(400,'Ստուգեք պատվերի կարգավիճակն ու տարբերակը');
  const o=await order(p.id,true);if(o.approval?.state==='pending')fail(409,'Սպասեք հաճախորդի համաձայնությանը');if(o.received_at||['received','completed','rejected'].includes(o.status))fail(409,'Փակված պատվերի համար նախ նշեք պատճառը և փոխեք կարգավիճակը հատուկ կոճակով');
  const comment=Object.hasOwn(p,'comment')?String(p.comment).trim().slice(0,2000):o.comment;
  return json(await rpc('zzws_update_order_v3',{p_order:o.id,p_revision:p.revision,p_lines:o.lines,p_status:p.status,p_comment:comment,p_total:Number(o.total),p_detail:{number:o.number,changes:[],source:'status'},p_actor:user.id,p_context:null}));
 }
 if(path==='admin/orders/events'&&req.method==='GET'){
  const params=new URL(req.url).searchParams,before=params.get('before'),id=params.get('orderId');
  if(before&&(!/^\d{1,19}$/.test(before)||BigInt(before)>9223372036854775807n))fail(400,'Սխալ էջի նույնացուցիչ');
  if(id&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))fail(400,'Սխալ պատվերի նույնացուցիչ');
  let q=table('order_activity').select('*').order('sequence',{ascending:false}).limit(101);
  if(before)q=q.lt('sequence',before);if(id)q=q.eq('order_id',id);
  const rows=await query(q),events=rows.slice(0,100),history=projectOrderHistory(id?{id}:null,rows);return json({events,next:events.length===100?String(events.at(-1).sequence):null,...history});
 }
 if(path==='admin/orders'&&req.method==='GET'){
  const params=new URL(req.url).searchParams,status=params.get('status'),before=params.get('before');let q=table('orders').select('*').order('number',{ascending:false}).limit(100);if(status&&statuses[status])q=q.eq('status',status);
  if(status==='approval_pending')q=awaitingCustomerApproval(q);
  if(status==='unfinished')q=q.in('status',['new','confirmed','in_progress','completed']).is('received_at',null);
  const search=String(params.get('search')||'').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,100);if(search){const terms=['customer->>client.ilike.*'+search+'*','customer->>customerCode.ilike.*'+search+'*','delivery->>organization.ilike.*'+search+'*'];if(/^\d+$/.test(search)&&search.length<16)terms.push('number.eq.'+search);q=q.or(terms.join(','));}
  for(const [param,column] of [['from','gte'],['to','lt']]){const date=params.get(param);if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){const stamp=new Date(date+'T00:00:00+04:00');if(!Number.isNaN(stamp.valueOf()))q=q[column]('created',new Date(stamp.valueOf()+(param==='to'?86400000:0)).toISOString());}}
  if(before&&/^\d+$/.test(before))q=q.lt('number',before);
  const orders=await query(q),reads=orders.length?await query(table('admin_order_reads').select('order_id,revision').eq('user_id',user.id).in('order_id',orders.map(o=>o.id))):[];
  const readById=new Map(reads.map(row=>[row.order_id,row.revision]));
  return json({orders:orders.map(o=>{const adminReadRevision=readById.get(o.id)||0;return {...o,adminReadRevision,unread:adminReadRevision<o.revision};})});
 }
 if(path==='admin/orders/template'&&req.method==='GET')return file([['Արտիկուլ','Քանակ','Գին'],['014676',1,'']],'Final-order-template.xlsx');
 if(path==='admin/orders/detail'&&req.method==='POST'){const p=await body(req),o=await order(p.id,true),events=await query(table('order_events').select('detail,created,revision').eq('order_id',o.id).order('revision',{ascending:false}).limit(101));return json({...o,...await historyFor(o,events),events:events.slice(0,50)});}
 if(['admin/orders/export','admin/orders/export-preview'].includes(path)&&req.method==='POST'){
  const p=await body(req),o=await order(p.id,true);if(o.approval?.state==='pending'&&path==='admin/orders/export')fail(409,'Սպասեք հաճախորդի համաձայնությանը');if(p.revision!==undefined&&p.revision!==o.revision)fail(409,'Պատվերը փոխվել է։ Վերաբացեք արտահանվող կազմը');const data=orderExportData(o);
  return path.endsWith('/export-preview')?json(data):file(data.rows,'Order-'+o.number+'.xlsx',data.columns);
 }
 const prepare=async(o,raw,source=null)=>{
  const customer=o.user_id?await query(table('users').select('*').eq('id',o.user_id).maybeSingle()):null;
  const customerUser=customer?{...customer.profile,id:customer.id,profileRevision:customer.profile_revision}:null;
  const v=await current(),products=customer?project(v.products,customerUser,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses}):[],lines=normalizeLines(raw,products,o.lines,true);
  if(!source)return {lines};
  const previous=await query(table('order_calculation_contexts').select('context').eq('order_id',o.id).order('order_revision',{ascending:false}).limit(1).maybeSingle());
  return {lines,context:buildOrderContext({catalog:v,user:customerUser,lines,previousOrder:o,previousContext:previous?.context||null,source})};
 };
 if(path==='admin/orders/preview'&&req.method==='POST'){
  let orderId,revision,parsed,filename;
  if((req.headers.get('content-type')||'').includes('application/json')){const p=await body(req);orderId=p.orderId;revision=p.revision;parsed=parsePastedConfirmation(p.text);filename='Տեղադրված աղյուսակ';}
  else{const form=await boundedMultipart(req),upload=form.get('file');orderId=form.get('orderId');revision=Number(form.get('revision'));if(!(upload instanceof File)||!upload.name.toLowerCase().endsWith('.xlsx'))fail(400,'Ընտրեք XLSX');parsed=parseConfirmation(rowsFromBuffer(await upload.arrayBuffer()));filename=upload.name.slice(0,300);}
  const o=await order(orderId,true);if(revision!==o.revision)fail(409,'Պատվերն արդեն փոխվել է։ Վերաբացեք այն');
  const {lines}=await prepare(o,parsed.lines),changes=changesBetween(o.lines,lines);
  const d=await query(table('drafts').insert({actor:user.id,kind:'order',payload:{orderId:o.id,revision:o.revision,lines,changes,filename,metadata:parsed.metadata,delivery:parsed.delivery}}).select('id').single());
  return json({draft:d.id,lines,changes,total:totalOf(lines),orderNumber:o.number,orderId:o.id,revision:o.revision,metadata:parsed.metadata,delivery:parsed.delivery});
 }
 if(req.method==='POST'&&['admin/orders/update','admin/orders/apply'].includes(path)){
  const p=await body(req),d=path.endsWith('/apply')?await draft(p.draft,user.id,'order'):null;
  if(d&&(p.orderId!==d.payload.orderId||p.revision!==d.payload.revision))fail(409,'Նախադիտումը վերաբերում է այլ պատվերի կամ տարբերակի։ Կրկին ստուգեք ֆայլը');
  const o=await order(d?.payload.orderId||p.id,true),revision=d?.payload.revision??p.revision;
  if(o.received_at||['received','completed','rejected'].includes(o.status)||p.status==='received')fail(409,'Փակված պատվերի համար նախ նշեք պատճառը և փոխեք կարգավիճակը հատուկ կոճակով');
  if(revision!==o.revision)fail(409,'Պատվերն արդեն փոխվել է։ Վերաբացեք պատվերը');
  const status=d?'confirmed':p.status;if(!statuses[status])fail(400,'Անհայտ կարգավիճակ');
  if(d&&p.confirmCustomer!==true)fail(400,'Հաստատեք, որ աղյուսակը վերաբերում է ընտրված պատվերին');
  const delivery=d&&p.applyDelivery?{...o.delivery,...d.payload.delivery}:null;
  return json(await checked(async()=>{
   const raw=d?d.payload.lines:p.lines;
   let stable=null;try{stable=normalizeLines(raw,[],o.lines,true);}catch{}
   const unchanged=stable&&changesBetween(o.lines,stable).length===0;
   if(unchanged&&o.approval?.state==='pending')fail(409,'Սպասեք հաճախորդի համաձայնությանը');
   const prepared=unchanged?{lines:o.lines,context:null}:await prepare(o,raw,d?'confirmation':'manual');
   const {lines,context}=prepared;if(!lines.length&&status!=='rejected')fail(400,'Դատարկ պատվերը կարելի է միայն մերժել');
   const comment=String(p.comment||'').trim().slice(0,2000),changes=changesBetween(o.lines,lines);
   return rpc('zzws_update_order_v3',{p_order:o.id,p_revision:revision,p_lines:lines,p_status:status,p_comment:comment,p_total:unchanged?Number(o.total??totalOf(lines)):totalOf(lines),p_detail:{number:o.number,changes,source:d?'confirmation':'manual',deliveryChanged:!!delivery&&JSON.stringify(delivery)!==JSON.stringify(o.delivery)},p_actor:user.id,p_context:context,p_draft:d?.id||null,p_delivery:delivery,p_confirmation:d?{...d.payload.metadata,filename:d.payload.filename}:null});
  }));
 }
 return null;
}

