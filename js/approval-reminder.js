(() => {
 const REPEAT_MS=60000,CHECK_MS=15000;
 let owner=null,timer=null,pending=[],polling=false,generation=0,lastShown=null,lastCheck=null,dialog=null,popupOpener=null;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const reviewing=()=>!![...document.querySelectorAll('.order-approval[data-approval-state="pending"]')].find(e=>e.getClientRects().length&&e.offsetParent!==null);
 const blocked=()=>document.hidden||reviewing()||!!document.querySelector('dialog[open]')||!!document.querySelector('#orderModal:not(.hidden)');
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;if(popupOpener?.isConnected)popupOpener.focus({preventScroll:true});popupOpener=null;}}
 function later(){lastShown=Date.now();close();}
 function show(){
  const due=pending.filter(o=>o.reminderDue!==false);if(!owner||!due.length||dialog||blocked()||lastShown!==null&&Date.now()-lastShown<REPEAT_MS)return;
  lastShown=Date.now();const next=due[0],box=node('dialog',null,'approval-reminder-dialog'),icon=node('div','!','approval-reminder-icon'),title=node('h2','Պատվերը սպասում է Ձեր համաձայնությանը'),text=node('p','Ադմինիստրատորը փոխել է պատվերը։ Ստուգեք փոփոխությունները և հաստատեք կամ մերժեք դրանք։'),numbers=node('p','Պատվեր №'+next.number,'approval-reminder-orders'),actions=node('div',null,'approval-reminder-actions'),open=node('button','Բացել պատվերը'),defer=node('button','Հիշեցնել նշված ժամանակից հետո'),minutesLabel=node('label','Հիշեցնել քանի րոպեից՝'),minutes=node('input'),error=node('p');minutes.type='number';minutes.min='1';minutes.max='60';minutes.step='1';minutes.value='1';minutes.setAttribute('aria-label','Րոպեներ՝ 1-ից 60');minutes.id='approvalSnoozeMinutes';minutesLabel.htmlFor=minutes.id;minutesLabel.append(minutes);error.setAttribute('role','status');minutes.oninput=()=>{error.textContent='';};
  box.id='approvalReminderDialog';box.dataset.proposalId=next.proposalId;title.id='approvalReminderTitle';text.id='approvalReminderDescription';box.setAttribute('aria-labelledby',title.id);box.setAttribute('aria-describedby',text.id);box.setAttribute('aria-modal','true');icon.setAttribute('aria-hidden','true');open.type=defer.type='button';open.className='approval-reminder-open';defer.className='approval-reminder-later';
  open.onclick=()=>{later();window.ZZWS_ORDERS?.openApproval(next.id).catch(e=>alert(ZZWS.message(e)));};defer.onclick=async()=>{
   const value=Number(minutes.value);if(!Number.isInteger(value)||value<1||value>60){error.textContent='Ընտրեք 1-ից 60 րոպե';return;}
   const who=owner,body={orderId:next.id,revision:next.revision,proposalId:next.proposalId,minutes:value},key='zzws_approval_defer_'+next.id+'_'+next.proposalId,fingerprint=JSON.stringify(body);let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
   if(saved&&saved.fingerprint!==fingerprint){error.textContent='Նախորդ պատասխանի արդյունքը դեռ անհայտ է։ Թարմացրեք պատվերը։';return;}
   if(!saved)saved={fingerprint,requestId:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(saved));open.disabled=defer.disabled=minutes.disabled=true;
   try{await ZZWS.json('orders/approval-defer',{method:'POST',body:JSON.stringify({...body,requestId:saved.requestId})});sessionStorage.removeItem(key);if(owner===who){later();await refresh(true);}}
   catch(e){if([400,403,409].includes(e.status))sessionStorage.removeItem(key);if(owner===who){error.textContent=ZZWS.message(e);if(e.status===409){later();await refresh(true);}}}
   finally{open.disabled=defer.disabled=minutes.disabled=false;}
  };box.oncancel=e=>{e.preventDefault();if(!defer.disabled)later();};actions.append(open,minutesLabel,node('small','Ընտրեք 1-ից 60 րոպե'),node('small','Ադմինիստրատորը ծանուցում կստանա Ձեր խնդրած ժամանակի մասին։'),defer,error);box.append(icon,title,text,numbers,actions);document.body.append(box);dialog=box;popupOpener=document.activeElement;box.showModal();open.focus();
 }
 async function refresh(force=false){
  if(!owner||document.hidden)return;
  if(polling)return;
  if(!force&&lastCheck!==null&&Date.now()-lastCheck<CHECK_MS){show();return;}
  const who=owner,epoch=generation;polling=true;
  try{const result=await ZZWS.json('orders/approval-pending');if(owner!==who||epoch!==generation)return;const before=pending.map(o=>o.proposalId).join('|');pending=Array.isArray(result.orders)?result.orders:[];lastCheck=Date.now();if(dialog&&!pending.some(o=>o.proposalId===dialog.dataset.proposalId&&o.reminderDue!==false)){close();lastShown=null;}if(!pending.some(o=>o.reminderDue!==false)){lastShown=null;close();}else{if(before&&before!==pending.map(o=>o.proposalId).join('|')){lastShown=null;close();}show();}}
  catch(e){if(owner===who&&e.status===401)stop();}
  finally{if(epoch===generation)polling=false;}
 }
 function start(user){stop();if(user.role!=='client')return;owner=user.id;timer=setInterval(refresh,CHECK_MS);refresh(true);}
 function stop(){++generation;owner=null;pending=[];polling=false;lastShown=null;lastCheck=null;if(timer)clearInterval(timer);timer=null;close();}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
 document.addEventListener('zzws:approval-response',()=>refresh(true));
 window.ZZWS_APPROVAL_REMINDER={start,stop,refresh,REPEAT_MS};
})();
