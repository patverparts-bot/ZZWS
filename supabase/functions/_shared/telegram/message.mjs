import {statuses} from '../../zzws-api/orders.mjs';
export const FORMAT_VERSION=1;
const labels={'order.created':'Պատվերը ստեղծվել է','order.updated':'Պատվերը փոփոխվել է','order.received':'Ստացումը հաստատվել է'};
const statusIcons={new:'🔴',confirmed:'🟡',in_progress:'🔵',completed:'🚚',rejected:'⛔',received:'✅'};
const clean=value=>{
 if(typeof value!=='string'||value.length>2000)throw new Error('invalid_display_field');
 return value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').trim();
};
const money=n=>new Intl.NumberFormat('hy-AM',{maximumFractionDigits:2}).format(n)+' ֏';
const validMoney=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e14;
// Deliberate allowlist. Never stringify an event, changes object, profile, delivery or line.
export function telegramMessages(event){
 const o=event?.snapshot,date=new Date(event?.occurred_at);
 if(event?.schema_version!==1||!Object.hasOwn(labels,event.event_type)||!o||!Array.isArray(o.lines)||o.lines.length>500||!validMoney(o.total)||!Object.hasOwn(statuses,o.status)||!Number.isFinite(date.valueOf()))throw new Error('invalid_event');
 if(!/^\d{1,19}$/.test(String(event.order_number)))throw new Error('invalid_order_number');
 const customer=clean(event.customer?.client||event.customer?.login||'—');
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yerevan',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date);
 const before=event.changes?.status?.before;
 const statusChanged=event.event_type==='order.updated'&&Object.hasOwn(statuses,before)&&before!==o.status;
 const title=event.source==='approval_deferred'?'⏳ ՀԱՃԱԽՈՐԴԸ ԺԱՄԱՆԱԿ Է ԽՆԴՐԵԼ':event.source==='approval_requested'?'⏳ ՍՊԱՍՈՒՄ Է ՀԱՃԱԽՈՐԴԻ ՀԱՄԱՁԱՅՆՈՒԹՅԱՆԸ':event.source==='approval_response'&&o.approval?.state==='approved'?'✅ ՀԱՃԱԽՈՐԴԸ ՀԱՄԱՁԱՅՆԵԼ Է':event.source==='closed_order_reopened'?'🚨 ՓԱԿՎԱԾ ՊԱՏՎԵՐԸ ՎԵՐԱԲԱՑՎԵԼ Է':event.event_type==='order.created'?'🔴 ՆՈՐ ՊԱՏՎԵՐ':event.event_type==='order.received'?'✅ ՍՏԱՑՈՒՄԸ ՀԱՍՏԱՏՎԱԾ Է':statusChanged?(o.status==='rejected'?'⛔ ՊԱՏՎԵՐԸ ՄԵՐԺՎԵԼ Է':'🔄 ԿԱՐԳԱՎԻՃԱԿԸ ՓՈԽՎԵԼ Է'):'📝 ՊԱՏՎԵՐԸ ՓՈՓՈԽՎԵԼ Է';
 const header=[title+' · №'+event.order_number,'━━━━━━━━━━━━━━━━━━','👤 Պատվիրատու՝ '+customer,'🕒 '+time+' (Երևան)',statusChanged?'🔄 '+statusIcons[before]+' '+statuses[before]+' → '+statusIcons[o.status]+' '+statuses[o.status]:'📌 '+statusIcons[o.status]+' '+statuses[o.status]];
 if(event.source==='approval_deferred'){const minutes=o.approval?.reviewRequestedMinutes;if(!Number.isSafeInteger(minutes)||minutes<1||minutes>60)throw Error('invalid_review_minutes');header.push('Հաճախորդը խնդրել է '+minutes+' րոպե պատվերը դիտարկելու համար։');}
 if(event.source==='closed_order_reopened')header.push('Փակված պատվերը վերաբացել է՝ '+clean(event.actor?.client||event.actor?.login||'—')+(event.actor?.login?' ('+clean(event.actor.login)+')':''),'Պատճառ՝ '+clean(o.comment||'—'));
 if(event.event_type==='order.created'&&event.actor?.role==='admin')header.push('Ստեղծվել է ադմինիստրատորի կողմից՝ '+clean(event.actor.client||event.actor.login||'—')+(event.actor.login?' ('+clean(event.actor.login)+')':''));
 if(event.event_type==='order.updated'){
  const changes=event.changes||{},changed=[];
  for(const [key,label] of [['lines','կազմ / քանակ / գներ'],['total','գումար'],['status','կարգավիճակ'],['delivery','առաքում'],['comment','մեկնաբանություն'],['confirmation','հաստատում']])if(Object.hasOwn(changes,key))changed.push(label);
  if(changed.length)header.push('Փոփոխություններ՝ '+changed.join(', '));
 }
 const body=[];
 for(const row of o.lines){
  if(!Number.isSafeInteger(row.qty)||row.qty<1||row.qty>9999||!validMoney(row.unitPrice)||!validMoney(row.qty*row.unitPrice))throw new Error('invalid_order_line');
  body.push(clean(row.articul)+' · '+clean(row.name)+' · '+row.qty+' × '+money(row.unitPrice)+' = '+money(Math.round(row.qty*row.unitPrice*100)/100));
 }
 if(!body.length)body.push('Ապրանքներ չկան');body.push('━━━━━━━━━━━━━━━━━━','💰 Ընդամենը՝ '+money(o.total));
 const heading=header.join('\n'),capacity=4000-heading.length-40;
 if(capacity<500)throw new Error('invalid_header');
 const chunks=[];let rest=body.join('\n');
 while(rest.length){let end=Math.min(rest.length,capacity);if(end<rest.length){const newline=rest.lastIndexOf('\n',end);if(newline>capacity/2)end=newline;if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;}
  chunks.push(rest.slice(0,end));rest=rest.slice(end);if(rest.startsWith('\n'))rest=rest.slice(1);
 }
 return chunks.map((chunk,i)=>heading+(chunks.length>1?'\nՄաս '+(i+1)+'/'+chunks.length:'')+'\n\n📦 ԱՊՐԱՆՔՆԵՐ\n'+chunk);
}
