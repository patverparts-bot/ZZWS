(() => {
 'use strict';
 const CHECK_MS=15000, LATER_MS=300000;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
 const t=text=>window.ZZWS_I18N?.t(text)||text;
 const key=o=>o.id+':'+o.proposalId+':'+o.deferRequestId;
 const panel=node('aside');panel.id='adminApprovalReminders';panel.hidden=true;panel.setAttribute('aria-label','Համաձայնության հիշեցումներ');document.getElementById('workspace').prepend(panel);
 let identity=null,epoch=0,timer=null,polling=false,orders=[],dialog=null,active=null,postponed=new Map();
 function close(){const old=dialog;dialog=null;active=null;old?.close();old?.remove();}
 function saveLater(o){postponed.set(key(o),Date.now()+LATER_MS);try{sessionStorage.setItem('zzws_admin_approval_later_'+identity.id,JSON.stringify([...postponed]));}catch{}close();}
 function notice(o){return o.customer.client+' · №'+o.number+' · '+o.minutes+' '+t('րոպե');}
 function renderPanel(){
  panel.replaceChildren();
  if(orders.length)panel.append(node('h2','Հաճախորդի մտածելու ժամանակն ավարտվել է'));
  for(const o of orders){const row=node('div');row.className='approval-reminder-row';row.append(node('p',notice(o)),button('Հիշեցնել Viber-ով',()=>open(o)));panel.append(row);}
  panel.hidden=!orders.length;
 }
 const blocked=()=>document.hidden||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
 function showDue(){if(!identity||dialog||blocked())return;const next=orders.find(o=>(postponed.get(key(o))||0)<=Date.now());if(next)open(next);}
 function message(data){
  return t('Բարև Ձեզ։ Խնդրում ենք դիտարկել և պատասխանել պատվերի փոփոխություններին՝ №')+data.number+'.'+(data.managerPhone?'\n'+t('Մենեջերի հեռախոսը')+': '+data.managerPhone:'');
 }
 function prepare(o){return ZZWS.json('admin/orders/approval-reminder',{method:'POST',body:JSON.stringify({orderId:o.id,revision:o.revision,proposalId:o.proposalId,deferRequestId:o.deferRequestId})});}
 async function open(o){
  if(!identity||dialog)return;
  const ticket=epoch,box=node('dialog');dialog=box;active=o;box.id='adminApprovalReminderDialog';box.className='admin-approval-reminder-dialog';box.setAttribute('aria-labelledby','adminApprovalReminderTitle');
  const title=node('h2','Հաճախորդի մտածելու ժամանակն ավարտվել է');title.id='adminApprovalReminderTitle';
  const info=node('p',notice(o)),status=node('p','Տվյալները բեռնվում են…'),content=node('div'),actions=node('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.className='approval-reminder-actions';
  const later=button('Հիշեցնել 5 րոպեից',()=>saveLater(o)),orderButton=button('Բացել պատվերը',async()=>{saveLater(o);try{await selectAdminTab('orders');await ZZWS_ADMIN_ORDERS.openNotice(o.id);}catch(e){if(ticket===epoch)alert(ZZWS.message(e));}});
  actions.append(orderButton,later);box.append(title,info,content,status,actions);box.oncancel=e=>{e.preventDefault();saveLater(o);};document.body.append(box);box.showModal();later.focus();
  try{
   const data=await prepare(o);if(ticket!==epoch||dialog!==box)return;
   const select=node('select'),phoneLabel=node('label','Հաճախորդի կոնտակտը'),text=node('textarea'),textLabel=node('label','Հիշեցման տեքստը'),viber=node('a','Ուղարկել Viber-ով'),hint=node('p','Viber-ում ստուգեք ստացողին և հաղորդագրությունը, ապա սեղմեք «Ուղարկել»։');
   select.id='approvalReminderPhone';phoneLabel.htmlFor=select.id;phoneLabel.append(select);text.id='approvalReminderText';text.rows=5;text.maxLength=2000;text.value=message(data);textLabel.htmlFor=text.id;textLabel.append(text);viber.id='approvalReminderViber';viber.className='approval-viber-link';
   const contacts=Array.isArray(data.contacts)?data.contacts:(data.phoneNumbers||[]).map(phone=>({name:data.customer,phone}));
   for(const contact of contacts){const option=node('option',contact.name+' — '+contact.phone);option.value=contact.phone;select.append(option);}
   function link(){
    const valid=/^\+[1-9]\d{7,14}$/.test(select.value)&&text.value.trim()&&text.value.length<=2000;
    if(valid)viber.href='viber://chat?number='+encodeURIComponent(select.value)+'&draft='+encodeURIComponent(text.value);else viber.removeAttribute('href');
    viber.setAttribute('aria-disabled',String(!valid));
   }
   link();select.onchange=link;text.oninput=link;
   viber.onclick=e=>{if(!viber.hasAttribute('href'))e.preventDefault();};
   content.append(phoneLabel,textLabel,viber,hint);
   select.disabled=!contacts.length;
   status.textContent=contacts.length?'':'Հաճախորդի քարտում հեռախոսահամար չկա։ Լրացրեք այն և վերաբացեք ծանուցումը։';
  }catch(e){if(ticket===epoch&&dialog===box){status.textContent=ZZWS.message(e);if(e.status===409)refresh();}}
 }
 async function refresh(){
  if(!identity||document.hidden||polling)return;
  const ticket=epoch;polling=true;
  try{
   const data=await ZZWS.json('admin/orders/approval-reminders');if(ticket!==epoch)return;
   orders=Array.isArray(data.orders)?data.orders:[];
   if(active&&!orders.some(o=>key(o)===key(active)&&o.revision===active.revision))close();
   renderPanel();showDue();
  }catch(e){if(ticket===epoch&&e.status===401)reset();}
  finally{if(ticket===epoch)polling=false;}
 }
 function reset(){++epoch;identity=null;clearInterval(timer);timer=null;polling=false;orders=[];postponed.clear();close();renderPanel();}
 function start(user){reset();if(user.role!=='admin'||!user.permissions?.includes('orders:write'))return;identity=user;
  try{postponed=new Map(JSON.parse(sessionStorage.getItem('zzws_admin_approval_later_'+user.id)||'[]').filter(([k,v])=>typeof k==='string'&&Number.isFinite(v)&&v>Date.now()));}catch{}
  timer=setInterval(refresh,CHECK_MS);refresh();
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('focus',refresh);
 window.ZZWS_ADMIN_APPROVAL_REMINDERS={start,reset,refresh};
})();
