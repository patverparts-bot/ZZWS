(() => {
 const labels={pending:'Սպասում է հաճախորդի համաձայնությանը',approved:'Հաճախորդը համաձայնեցրել է',declined:'Հաճախորդը հրաժարվել է պատվերից'};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=v=>Number(v||0).toLocaleString(window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM')+' ֏';
 function label(order){const state=order?.approval?.state;return state==='approved'&&order.status!=='confirmed'?'':labels[state]||'';}
 function render(order,root,onChanged){
  const offer=order.approval;if(!offer?.id)return;
  const box=node('section',null,'order-approval');box.dataset.approvalId=offer.id;box.dataset.approvalState=offer.state;box.append(node('h3',labels[offer.state]||''));
  if(offer.state!=='pending'){
   const rejected=offer.response?.declinedArticuls||[];if(rejected.length)box.append(node('p','Հաճախորդի մերժած ապրանքները՝ '+rejected.join(', ')));
   root.append(box);return;
  }
  box.append(node('p','Ադմինիստրատորն առաջարկել է փոփոխություններ։ Ստուգեք քանակը, գինը և հեռացված ապրանքները։ Ցանկից կարող եք հանել ցանկացած ապրանք և հաստատել մնացածը կամ հրաժարվել ամբողջ պատվերից։'));
  const comparison=ZZWS_ORDER_COMPARE.render(offer.beforeLines||order.lines,offer.lines||[]);box.append(comparison);
  if(offer.comment)box.append(node('p',offer.comment));
  const choices=node('div',null,'approval-choices'),total=node('p'),actions=node('div',null,'approval-actions'),accept=node('button','Հաստատել ընտրված ապրանքները'),reject=node('button','Հրաժարվել ամբողջ պատվերից'),message=node('p');
  accept.type=reject.type='button';accept.dataset.approvalAccept='';reject.dataset.approvalReject='';reject.className='approval-reject';message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  let busy=false;const declined=new Set(),rows=offer.lines||[],session=sessionStorage.getItem('zzws_session_v3');
  const current=()=>box.isConnected&&sessionStorage.getItem('zzws_session_v3')===session;
  const selected=()=>rows.filter(r=>!declined.has(r.articul));
  function update(){total.textContent='Հաստատվող գումար՝ '+money(selected().reduce((s,r)=>s+r.qty*r.unitPrice,0));accept.disabled=busy||(rows.length>0&&!selected().length);reject.disabled=busy;for(const input of choices.querySelectorAll('input'))input.disabled=busy;}
  for(const row of rows){const line=node('label',null,'approval-choice'),input=node('input');input.type='checkbox';input.checked=true;input.dataset.approvalArticul=row.articul;input.onchange=()=>{if(input.checked)declined.delete(row.articul);else declined.add(row.articul);update();};line.append(input,node('span',''+row.articul+' · '+row.name+' · '+row.qty+' × '+money(row.unitPrice)));choices.append(line);}
  async function respond(decision){
   if(busy||!current())return;
   const question=decision==='reject'?'Հրաժարվե՞լ ամբողջ պատվերից։':'Հաստատե՞լ միայն ընտրված ապրանքները՝ նշված քանակներով և գներով։';if(!confirm(question))return;
   const payload={orderId:order.id,revision:order.revision,proposalId:offer.id,decision,declinedArticuls:decision==='reject'?[]:[...declined].sort()},key='zzws_approval_'+order.id+'_'+offer.id,fingerprint=JSON.stringify(payload);let saved;
   try{saved=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
   if(saved&&saved.fingerprint!==fingerprint){message.textContent='Նախորդ պատասխանի արդյունքը դեռ անհայտ է։ Թարմացրեք պատվերը։';return;}
   if(!saved)saved={fingerprint,requestId:crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(saved));busy=true;update();message.textContent='Պատասխանը ուղարկվում է…';
   try{await ZZWS.json('orders/approval',{method:'POST',body:JSON.stringify({...payload,requestId:saved.requestId})});sessionStorage.removeItem(key);document.dispatchEvent(new Event('zzws:approval-response'));if(current())await onChanged();}
   catch(e){if([400,403,409].includes(e.status))sessionStorage.removeItem(key);if(current())message.textContent=ZZWS.message(e);}
   finally{busy=false;if(current())update();}
  }
  accept.onclick=()=>respond('accept');reject.onclick=()=>respond('reject');actions.append(accept,reject);box.append(choices,total,actions,message);root.append(box);update();
 }
 window.ZZWS_ORDER_APPROVAL={label,render};
})();
