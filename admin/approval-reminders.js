(() => {
 'use strict';
 const CHECK_MS=15000, LATER_MS=300000;
 const viberTools=window.ZZWS_APPROVAL_VIBER,site=new URL('../',document.currentScript.src).href;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
 const t=text=>window.ZZWS_I18N?.t(text)||text;
 const key=o=>o.id+':'+o.proposalId+':'+o.deferRequestId;
 const date=value=>new Date(value).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan'});
 const paused=o=>Date.parse(o.snoozedUntil||'')>Date.now();
 const panel=node('aside');panel.id='adminApprovalReminders';panel.hidden=true;panel.setAttribute('aria-label','Համաձայնության հիշեցումներ');document.getElementById('workspace').prepend(panel);
 let identity=null,epoch=0,timer=null,polling=false,orders=[],dialog=null,active=null,postponed=new Map();
 function close(){const old=dialog;dialog=null;active=null;old?.close();old?.remove();}
 function saveLater(o){postponed.set(key(o),Date.now()+LATER_MS);try{sessionStorage.setItem('zzws_admin_approval_later_'+identity.id,JSON.stringify([...postponed]));}catch{}close();}
 function notice(o){return o.customer.client+' · №'+o.number+' · '+o.minutes+' '+t('րոպե');}
 function renderPanel(){
  panel.replaceChildren();
  if(orders.length)panel.append(node('h2','Հաճախորդի մտածելու ժամանակն ավարտվել է'));
  for(const o of orders){const row=node('div');row.className='approval-reminder-row';row.append(node('p',notice(o)),button('Հիշեցնել Viber-ով',()=>open(o)));if(paused(o))row.append(node('p','Հիշեցումը հետաձգված է մինչև՝ '+date(o.snoozedUntil)));panel.append(row);}
  panel.hidden=!orders.length;
 }
 const blocked=()=>document.hidden||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]');
 function showDue(){if(!identity||dialog||blocked())return;const next=orders.find(o=>!paused(o)&&(postponed.get(key(o))||0)<=Date.now());if(next)open(next);}
 function prepare(o){return ZZWS.json('admin/orders/approval-reminder',{method:'POST',body:JSON.stringify({orderId:o.id,revision:o.revision,proposalId:o.proposalId,deferRequestId:o.deferRequestId})});}
 async function open(o){
  if(!identity||dialog)return;
  const ticket=epoch,box=node('dialog');dialog=box;active=o;box.id='adminApprovalReminderDialog';box.className='admin-approval-reminder-dialog';box.setAttribute('aria-labelledby','adminApprovalReminderTitle');
  const title=node('h2','Հաճախորդի մտածելու ժամանակն ավարտվել է');title.id='adminApprovalReminderTitle';
  const info=node('p',notice(o)),status=node('p','Տվյալները բեռնվում են…'),content=node('div'),actions=node('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.className='approval-reminder-actions';
  const later=button('Հիշեցնել 5 րոպեից',()=>saveLater(o)),orderButton=button('Բացել պատվերը',async()=>{saveLater(o);try{await selectAdminTab('orders');await ZZWS_ADMIN_ORDERS.openNotice(o.id);}catch(e){if(ticket===epoch)alert(ZZWS.message(e));}});
  const custom=node('fieldset'),legend=node('legend','Կամայական հետաձգում'),whenLabel=node('label','Կրկին հիշեցնել՝'),when=node('input'),zone=node('small','Երևանի ժամանակով՝ UTC+4'),clientLabel=node('label'),client=node('input'),hint=node('p','Առանց նշման հաճախորդի հիշեցման ժամկետը չի փոխվի։'),apply=button('Հետաձգել մինչև ընտրված ժամը',async()=>{
   const stamp=Date.parse(when.value+':00+04:00');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when.value)||!Number.isFinite(stamp)||stamp<=Date.now()){status.textContent='Ընտրեք ապագա ամսաթիվ և ժամ';return;}
   await persistUntil(new Date(stamp).toISOString(),client.checked);
  }),customButton=button('Ընտրել ամսաթիվ և ժամ',()=>{custom.hidden=!custom.hidden;if(!custom.hidden)when.focus();});let busy=false,attempt=null;
  async function persistUntil(until,includeClient){
   if(busy)return;const fingerprint=until+'|'+includeClient;if(!attempt||attempt.fingerprint!==fingerprint)attempt={fingerprint,id:crypto.randomUUID()};
   busy=true;for(const b of [later,orderButton,customButton,when,client,apply])b.disabled=true;status.textContent='Հետաձգումը պահպանվում է…';
   try{await ZZWS.json('admin/orders/approval-reminder/snooze',{method:'POST',body:JSON.stringify({orderId:o.id,revision:o.revision,proposalId:o.proposalId,deferRequestId:o.deferRequestId,until,includeClient,requestId:attempt.id})});if(ticket!==epoch||dialog!==box)return;postponed.delete(key(o));try{sessionStorage.setItem('zzws_admin_approval_later_'+identity.id,JSON.stringify([...postponed]));}catch{}close();await refresh();}
   catch(e){if(ticket===epoch&&dialog===box){status.textContent=ZZWS.message(e);if([400,403,409].includes(e.status))attempt=null;if(e.status===409)refresh();}}
   finally{busy=false;for(const b of [later,orderButton,customButton,when,client,apply])b.disabled=false;}
  }
  later.onclick=()=>persistUntil(new Date(Date.now()+LATER_MS).toISOString(),false);
  custom.id='approvalCustomSnooze';custom.className='approval-custom-snooze';custom.hidden=true;when.type='datetime-local';when.step='60';when.id='approvalSnoozeUntil';when.value=new Date((paused(o)?Date.parse(o.snoozedUntil):Date.now()+3600000)+14400000).toISOString().slice(0,16);whenLabel.htmlFor=when.id;whenLabel.append(when);client.type='checkbox';client.id='approvalSnoozeClient';clientLabel.className='approval-snooze-client';clientLabel.append(client,node('span','Նույն ժամկետով հետաձգել նաև հաճախորդի ծանուցումը'));custom.append(legend,whenLabel,zone,clientLabel,hint,apply);
  actions.append(orderButton,later,customButton);box.append(title,info,content,status,actions,custom);box.oncancel=e=>{e.preventDefault();if(!busy)saveLater(o);};document.body.append(box);box.showModal();later.focus();
  try{
   const data=await prepare(o);if(ticket!==epoch||dialog!==box)return;
   const select=node('select'),phoneLabel=node('label','Հաճախորդի կոնտակտը'),text=node('textarea'),textLabel=node('label','Հիշեցման տեքստը'),viber=node('a','Բացել Viber-ը և ընտրել ստացողին'),hint=node('p','Viber-ը ստացողին ինքնաշխատ չի ընտրում։ Պատճենեք հաղորդագրությունը, բացեք Viber-ը և ընտրեք նշված համարով հաճախորդին։ Ստուգեք ամբողջ տեքստը և ուղարկեք ինքներդ։'),longText=node('p','Viber-ը կարող է կրճատել 200 նիշից երկար տեքստը։ Տեղադրեք պատճենված ամբողջ հաղորդագրությունը։'),launchHint=node('p','Եթե Viber-ը չի բացվում, բացեք այն ձեռքով, ընտրեք հաճախորդին և տեղադրեք պատճենված տեքստը։');
   select.id='approvalReminderPhone';phoneLabel.htmlFor=select.id;phoneLabel.append(select);text.id='approvalReminderText';text.rows=5;text.maxLength=2000;text.value=viberTools.message(data,site);textLabel.htmlFor=text.id;textLabel.append(text);viber.id='approvalReminderViber';viber.className='approval-viber-link';
   const copyStatus=node('p');copyStatus.id='approvalReminderCopyStatus';copyStatus.setAttribute('role','status');copyStatus.setAttribute('aria-live','polite');
   async function copy(value,success,field){
    try{
     if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
     await navigator.clipboard.writeText(value);
     if(ticket===epoch&&dialog===box)copyStatus.textContent=success;
    }catch{
     if(ticket!==epoch||dialog!==box)return;
     if(field){field.focus();field.select();}
     copyStatus.textContent='Չհաջողվեց պատճենել։ Նշեք տեքստը կամ համարը և պատճենեք ձեռքով։';
    }
   }
   const copyText=button('Պատճենել հաղորդագրությունը',()=>copy(text.value,'Հաղորդագրությունը պատճենված է։ Այն դեռ ուղարկված չէ։',text)),copyPhone=button('Պատճենել համարը',()=>copy(select.value,'Հեռախոսահամարը պատճենված է։'));
   copyText.id='approvalReminderCopyText';copyPhone.id='approvalReminderCopyPhone';
   const contacts=Array.isArray(data.contacts)?data.contacts:(data.phoneNumbers||[]).map(phone=>({name:data.customer,phone}));
   for(const contact of contacts){const number=viberTools.phone(contact.phone);if(!number)continue;const option=node('option',contact.name+' — '+number);option.value=number;select.append(option);}
   function link(){
    const href=viberTools.shareLink(select.value,text.value);
    if(href)viber.href=href;else viber.removeAttribute('href');
    viber.setAttribute('aria-disabled',String(!href));copyText.disabled=!href;copyPhone.disabled=!select.value;longText.hidden=text.value.length<=200;copyStatus.textContent='';
   }
   link();select.onchange=link;text.oninput=link;
   viber.onclick=e=>{if(!viber.hasAttribute('href'))e.preventDefault();};
   content.append(phoneLabel,textLabel,hint,copyText,copyPhone,copyStatus,longText,viber,launchHint);
   select.disabled=!select.options.length;
   status.textContent=select.options.length?'':'Հաճախորդի քարտում հեռախոսահամար չկա։ Լրացրեք այն և վերաբացեք ծանուցումը։';
  }catch(e){if(ticket===epoch&&dialog===box){status.textContent=ZZWS.message(e);if(e.status===409)refresh();}}
 }
 async function refresh(){
  if(!identity||document.hidden||polling)return;
  const ticket=epoch;polling=true;
  try{
   const data=await ZZWS.json('admin/orders/approval-reminders');if(ticket!==epoch)return;
   orders=Array.isArray(data.orders)?data.orders:[];
   if(active&&!orders.some(o=>key(o)===key(active)&&o.revision===active.revision&&(!paused(o)||o.snoozedUntil===active.snoozedUntil)))close();
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
