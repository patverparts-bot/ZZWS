/* Immutable event snapshots; short summaries expand to the recorded actor and exact changes. */
(() => {
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const statuses={new:'Նոր',confirmed:'Հաստատված',in_progress:'Ձևակերպված է',completed:'Առաքված է',received:'Ստացված է',rejected:'Մերժված'};
 const actions={created:'Պատվերը ստեղծված է',proposal:'Առաջարկվել են պատվերի փոփոխություններ',approved:'Հաճախորդը համաձայնեցրել է պատվերը',declined:'Հաճախորդը հրաժարվել է պատվերից',deferred:'Հաճախորդը ժամանակ է խնդրել դիտարկման համար',received:'Պատվերի ստացումը հաստատված է',reopened:'Պատվերը վերաբացված է',status_changed:'Պատվերի կարգավիճակը փոխված է',updated:'Պատվերի տվյալները թարմացված են',unknown:'Պատվերի պատմության գրառում'};
 const fields={comment:'Մեկնաբանություն',organization:'Կազմակերպություն',contact:'Կոնտակտ',address:'Հասցե',method:'Առաքման եղանակ',date:'Առաքման օր',phone:'Հեռախոս',email:'Էլ․ փոստ',paymentDeadline:'Վճարման վերջնաժամկետ'};
 const bounded=(value,max=300)=>String(value??'').slice(0,max),value=v=>v==null?'—':typeof v==='object'?bounded(JSON.stringify(v),1000):bounded(v,1000);
 const price=n=>Number.isFinite(Number(n))&&n!=null?Number(n).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM')+' ֏':'—';
 const composition=line=>line?value(line.qty)+' × '+price(line.unitPrice):'—';
 function timestamp(at){const parsed=new Date(typeof at==='number'&&at<1e12?at*1000:at);return at&&Number.isFinite(parsed.getTime())?parsed.toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan',dateStyle:'short',timeStyle:'short'}):'Ժամանակը չի պահպանվել';}
 function legacy(event){if(event.action)return event;const d=event.detail||{},k=d.kind||event.kind;return {id:event.id,revision:event.revision,at:event.created,action:({created:'created',approval_requested:'proposal',approval_approved:'approved',approval_declined:'declined',approval_deferred:'deferred',received:'received',reopened:'reopened'})[k]||(d.status?'status_changed':'unknown'),actor:null,status:d.status?{after:d.status}:null,lines:d.changes||[],proposed:k==='approval_requested',minutes:d.minutes};}
 function headline(entry){if(entry.action==='updated'&&entry.actor?.role==='admin')return 'Ադմինիստրատորը փոխել է պատվերը';if(entry.action==='proposal'&&entry.actor?.role==='admin')return 'Ադմինիստրատորն առաջարկել է փոփոխություններ';return actions[entry.action]||actions.unknown;}
 function render(entries=[]){
  const root=node('div',null,'order-timeline');
  for(const [index,source]of entries.entries()){
   const entry=legacy(source),row=node('details',null,'order-history-entry'),summary=node('summary'),body=node('div',null,'order-history-content');row.dataset.historyId=bounded(entry.id||entry.revision||index,100);summary.append(node('span',headline(entry)),node('time',timestamp(entry.at)));row.append(summary,body);
   const actor=entry.actor,identity=node('p',null,'order-history-actor'),name=actor?[actor.firstName,actor.lastName].filter(Boolean).join(' ').trim()||actor.login||'Անունը չի պահպանվել':'Մասնակիցը չի պահպանվել',person=node('strong',bounded(name));person.dataset.i18nSkip='true';identity.append(node('span','Գործողությունը կատարել է՝ '),person);
   if(actor){const role=actor.role==='admin'?'Ադմինիստրատոր':actor.clientRole==='employee'?'Աշխատակից':actor.clientRole==='manager'?'Ընկերության գլխավոր օգտատեր':actor.role==='client'?'Հաճախորդ':'';if(role)identity.append(node('span',' · '+role));}body.append(identity);if(actor?.actingForAuthor)body.append(node('p','Գործողությունը կատարել է ընկերության գլխավոր օգտատերը՝ աշխատակցի փոխարեն։'));
   if(entry.status)body.append(node('p','Կարգավիճակ՝ '+(statuses[entry.status.before]||'—')+' → '+(statuses[entry.status.after]||'—')));
   if(entry.proposed)body.append(node('p','Ստորև նշված փոփոխությունները առաջարկված են համաձայնեցման համար։'));
   for(const line of entry.lines||[]){const change=node('div',null,'order-history-line');change.append(node('strong',bounded(line.name||line.articul)),node('small',bounded(line.articul,100)));const label={added:'Ավելացվել է',removed:'Հեռացվել է',changed:'Փոխվել է'}[line.kind]||'Ապրանքի փոփոխություն';change.append(node('p',label+' · '+composition(line.before)+' → '+composition(line.after)));body.append(change);}
   if(entry.minutes!=null)body.append(node('p','Դիտարկման ժամանակ՝ '+value(entry.minutes)+' րոպե'));
   const removed=new Set((entry.lines||[]).filter(l=>l.kind==='removed').map(l=>l.articul)),declined=(entry.declinedArticuls||[]).filter(id=>!removed.has(id));if(declined.length)body.append(node('p','Մերժված ապրանքներ՝ '+declined.map(id=>bounded(id,100)).join(', ')));
   for(const field of entry.fields||[]){const key=String(field.key||'').split('.').at(-1),label=fields[key]||bounded(field.key,80)||'Պատվերի տվյալ';body.append(node('p',label+' · '+value(field.before)+' → '+value(field.after)));}
   root.append(row);
  }
  return root;
 }
 window.ZZWS_ORDER_TIMELINE={render};
})();
