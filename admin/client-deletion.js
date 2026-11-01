(() => {
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const dialog=node('dialog'),form=node('form'),heading=node('h2','Ուշադրություն․ հաճախորդի ջնջում'),name=node('p'),warning=node('p','Հաճախորդը կհեռացվի ցանկից։ Գլխավոր մենեջերի և բոլոր աշխատակիցների մուտքը կփակվի, իսկ հրավերները կչեղարկվեն։ Պատվերների և հաշվետվությունների պատմությունը կպահպանվի։'),note=node('p','Ջնջումը հաստատելու համար ամեն անգամ մուտքագրեք ձեր ընթացիկ ադմինիստրատորի գաղտնաբառը։'),label=node('label','Ադմինիստրատորի ընթացիկ գաղտնաբառ'),password=node('input'),error=node('p'),actions=node('div'),cancel=node('button','Չեղարկել'),submit=node('button','Հաստատել հաճախորդի ջնջումը');
 dialog.id='clientDeletionDialog';dialog.className='client-deletion-dialog';dialog.setAttribute('aria-labelledby','clientDeletionHeading');dialog.setAttribute('aria-describedby','clientDeletionWarning');heading.id='clientDeletionHeading';name.id='clientDeletionName';warning.id='clientDeletionWarning';warning.setAttribute('role','alert');password.id='clientDeletionPassword';password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=256;label.htmlFor=password.id;error.id='clientDeletionError';error.setAttribute('role','alert');cancel.type='button';submit.type='submit';submit.id='confirmClientDeletion';submit.className='danger';submit.disabled=true;actions.className='client-deletion-actions';actions.append(cancel,submit);label.append(password);form.append(heading,name,warning,note,label,error,actions);dialog.append(form);document.body.append(dialog);
 let current=null,busy=false,serial=0;
 const reasonLabel=node('label','Հասանելիությունը փակելու պատճառ'),reason=node('textarea');reason.id='clientArchiveReason';reason.rows=3;reason.minLength=3;reason.maxLength=1000;reasonLabel.htmlFor=reason.id;reasonLabel.append(reason);label.before(reasonLabel);reasonLabel.hidden=true;
 const modes={
  delete:{heading:heading.textContent,warning:warning.textContent,note:note.textContent,submit:submit.textContent,path:'admin/users/delete'},
  archive:{heading:'Ուշադրություն․ հաճախորդի հասանելիության փակում',warning:'Հաճախորդը կտեղափոխվի արխիվ։ Գլխավոր մենեջերի և բոլոր աշխատակիցների մուտքը կփակվի, իսկ հրավերները կչեղարկվեն։ Պատվերները, առաքման տվյալները և հաշվետվությունները կպահպանվեն։',note:'Նշեք փակման պատճառը և հաստատեք գործողությունը ձեր ընթացիկ ադմինիստրատորի գաղտնաբառով։',submit:'Փակել հասանելիությունը և արխիվացնել',path:'admin/users/archive'},
  restore:{heading:'Հաճախորդի վերականգնում արխիվից',warning:'Հաճախորդը կվերադառնա աշխատանքային ցանկ։ Կվերականգնվեն մինչ արխիվացումը գործող հասանելիության կարգավորումները։ Նախկինում արգելափակված աշխատակիցները կմնան արգելափակված։ Չօգտագործված հրավերները պետք է տրամադրել նորից։',note:'Հաստատեք վերականգնումը ձեր ընթացիկ ադմինիստրատորի գաղտնաբառով։',submit:'Վերականգնել արխիվից',path:'admin/users/restore'}
 };
 const clear=()=>{password.value='';reason.value='';error.textContent='';current=null;submit.disabled=true;};
 const ready=()=>{submit.disabled=busy||!password.value||current?.mode==='archive'&&reason.value.trim().length<3;};
 password.oninput=reason.oninput=ready;cancel.onclick=()=>{clear();dialog.close();};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else clear();});dialog.addEventListener('close',()=>{if(!dialog.open)clear();});
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current||!password.value||current.mode==='archive'&&reason.value.trim().length<3)return;
  const target=current,ticket=serial;busy=true;submit.disabled=true;cancel.disabled=true;password.disabled=true;reason.disabled=true;error.textContent='';
  try{
   await api(modes[target.mode].path,{method:'POST',body:JSON.stringify({id:target.user.id,expectedProfileRevision:target.user.profileRevision,password:password.value,...(target.mode==='archive'?{reason:reason.value.trim()}:{})})});
   password.value='';if(ticket!==serial)return;clear();dialog.close();await target.done();
  }catch(e){password.value='';if(ticket===serial){if(dialog.open)error.textContent=ZZWS.message(e);else if(!e.staleSession)status(ZZWS.message(e),true);}}
  finally{busy=false;password.disabled=false;reason.disabled=false;cancel.disabled=false;ready();if(ticket===serial&&dialog.open)password.focus();}
 };
 function open(user,done,mode){if(busy)return;clear();serial++;current={user:structuredClone(user),done,mode};name.textContent=user.client+(user.customerCode?' ('+user.customerCode+')':'');name.dataset.i18nSkip='true';dialog.dataset.mode=mode;const text=modes[mode];heading.textContent=text.heading;warning.textContent=text.warning;note.textContent=text.note;submit.textContent=text.submit;reasonLabel.hidden=mode!=='archive';reason.required=mode==='archive';window.ZZWS_I18N?.refresh(dialog);dialog.showModal();(mode==='archive'?reason:password).focus();}
 window.ZZWS_CLIENT_DELETION={open(user,done){open(user,done,'delete');},archive(user,done){open(user,done,'archive');},restore(user,done){open(user,done,'restore');},reset(){serial++;if(dialog.open)dialog.close();clear();}};
})();
