// Read-only, bounded public projection of immutable order evidence.
// Presentation owns labels and collapsed/expanded state; no actor is read from
// a current user profile and internal snapshots/contact details never escape.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=500)=>typeof value==='string'&&value.trim()?value.slice(0,max):null;
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const primitive=value=>value==null?null:typeof value==='string'?value.slice(0,3000):typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)?value:null;
const row=value=>object(value)?{qty:number(value.qty),unitPrice:number(value.unitPrice)}:null;
function lineChanges(before,after){
 const index=values=>new Map((Array.isArray(values)?values:[]).filter(v=>object(v)&&text(v.articul,100)&&v.articul.length<=100).map(v=>[v.articul,v]));
 const old=index(before),next=index(after),changes=[];
 for(const articul of new Set([...old.keys(),...next.keys()])){
  const a=old.get(articul),b=next.get(articul),first=row(a),last=row(b);
  if(a&&b&&first.qty===last.qty&&first.unitPrice===last.unitPrice)continue;
  changes.push({articul,name:text(b?.name)||text(a?.name),kind:!a?'added':!b?'removed':'changed',before:first,after:last});
 }return changes.slice(0,500);
}
function legacyLines(changes){return (Array.isArray(changes)?changes:[]).filter(c=>object(c)&&text(c.articul,100)&&c.articul.length<=100&&['added','removed','changed'].includes(c.kind)).slice(0,500).map(c=>({articul:c.articul,name:text(c.name)||text(c.after?.name)||text(c.before?.name),kind:c.kind,before:row(c.before),after:row(c.after)}));}
function actorDTO(value,extra){
 if(!object(value))return null;
 const id=text(value.id,100),same=object(extra)&&id&&extra.id===id,source=same?{...value,...extra}:value;
 const role=text(source.role,40)||(['manager','employee'].includes(source.clientRole)?'client':null);
 const result={id,role,login:text(source.login,200),firstName:text(source.firstName,200),lastName:text(source.lastName,200),clientRole:['manager','employee'].includes(source.clientRole)?source.clientRole:null,actingForAuthor:source.actingForAuthor===true};
 return result.id||result.role||result.login||result.firstName||result.lastName?result:null;
}
function actionOf(activity,event,approval){
 const source=activity?.source,kind=event?.detail?.kind;
 if(activity?.event_type==='order.created')return 'created';
 if(source==='approval_requested'||kind==='approval_requested')return 'proposal';
 if(source==='approval_deferred'||kind==='approval_deferred')return 'deferred';
 if(source==='approval_response'&&['approved','declined'].includes(approval?.state))return approval.state==='approved'?'approved':'declined';
 if(kind==='approval_approved')return 'approved';if(kind==='approval_declined')return 'declined';
 if(source==='receipt'||activity?.event_type==='order.received'||kind==='receipt')return 'received';
 if(source==='closed_order_reopened'||kind==='closed_order_reopened')return 'reopened';
 if(activity?.changes?.status||event?.detail?.oldStatus&&event.detail.oldStatus!==event.detail.status)return 'status_changed';
 if(activity?.event_type==='order.updated'||Array.isArray(event?.detail?.changes)&&event.detail.changes.length)return 'updated';
 return 'unknown';
}
const safeFieldKeys={delivery:['method','date','address','organization','paymentDeadline'],confirmation:['method','date','paymentDeadline']};
function fieldChanges(changes){
 const result=[];
 const append=(key,before,after)=>{before=primitive(before);after=primitive(after);if(before!==after)result.push({key,before,after});};
 if(object(changes.comment))append('comment',changes.comment.before,changes.comment.after);
 for(const [key,names]of Object.entries(safeFieldKeys))if(object(changes[key]))for(const name of names)append(key+'.'+name,changes[key].before?.[name],changes[key].after?.[name]);
 return result;
}
function entryOf(order,activity,event){
 const snapshot=object(activity?.snapshot)?activity.snapshot:{},changes=object(activity?.changes)?activity.changes:{},detail=object(event?.detail)?event.detail:{},approval=object(snapshot.approval)?snapshot.approval:null;
 const action=actionOf(activity,event,approval),proposed=action==='proposal';
 let extra=action==='deferred'?approval?.deferredBy:action==='received'?snapshot.receipt?.actor:action==='approved'||action==='declined'?approval?.response?.actor:null;
 const original=activity?.actor||detail.actor;
 if(action==='created'&&original?.id&&snapshot.customer?.author?.id===original.id)extra=snapshot.customer.author;
 if(!extra&&detail.actor?.id===original?.id)extra=detail.actor;
 const actor=actorDTO(original,extra),statusBefore=text(changes.status?.before,60)||text(detail.oldStatus,60),statusAfter=object(changes.status)||statusBefore?text(changes.status?.after,60)||text(detail.status,60):action==='created'?text(snapshot.status,60):null;
 let lines=[];
 if(proposed&&Array.isArray(approval?.lines))lines=lineChanges(approval.beforeLines||snapshot.lines,approval.lines);
 else if(object(changes.lines))lines=lineChanges(changes.lines.before,changes.lines.after);
 else if(action==='created'&&Array.isArray(snapshot.lines))lines=lineChanges([],snapshot.lines);
 else lines=legacyLines(detail.changes);
 const declined=approval?.response?.declinedArticuls||detail.declinedArticuls,minutes=action==='deferred'?(number(approval?.reviewRequestedMinutes)??number(detail.minutes)):null;
 const revision=activity?.revision??event.revision,orderId=text(activity?.order_id,100)||text(event?.order_id,100)||text(order?.id,100);
 return {id:text(activity?.id,100)||text(event?.id,100)||'event:'+orderId+':'+revision,orderId,number:number(activity?.order_number)??number(snapshot.number)??number(order?.number),revision,
  at:text(activity?.occurred_at,100)||text(event?.created,100),action,source:text(activity?.source,100),actor,
  status:statusBefore!==statusAfter&&(statusBefore||statusAfter)?{before:statusBefore,after:statusAfter}:null,lines,proposed,
  declinedArticuls:Array.isArray(declined)?[...new Set(declined.filter(v=>typeof v==='string').map(v=>v.slice(0,100)))].slice(0,500):[],
  minutes:Number.isInteger(minutes)&&minutes>=1&&minutes<=60?minutes:null,fields:fieldChanges(changes)};
}
export function projectOrderHistory(order,activities=[],events=[],{limit=100}={}){
 limit=Number.isSafeInteger(limit)?Math.max(1,Math.min(100,limit)):100;const groups=new Map();
 const keyOf=value=>{if(!object(value)||!Number.isSafeInteger(value.revision)||value.revision<1)return null;const id=value.order_id||order?.id;if(order?.id&&id!==order.id)return null;return String(id||'')+':'+value.revision;};
 for(const activity of activities){const key=keyOf(activity);if(!key)continue;const group=groups.get(key)||{};group.activity=activity;groups.set(key,group);}
 for(const event of events){const key=keyOf(event);if(!key)continue;const group=groups.get(key)||{};if(!group.event||!group.event.detail?.kind)group.event=event;groups.set(key,group);}
 const rows=[...groups.values()].map(({activity,event})=>entryOf(order,activity,event)).sort((a,b)=>order?.id?b.revision-a.revision:(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||b.revision-a.revision);
 const history=rows.slice(0,limit);return {history,historyPage:{hasMore:rows.length>limit,beforeRevision:history.at(-1)?.revision??null}};
}
