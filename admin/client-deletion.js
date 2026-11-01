(() => {
 'use strict';
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const dialog=node('dialog'),form=node('form'),heading=node('h2','Ուշադրություն․ հաճախորդի ջնջում'),name=node('p'),warning=node('p','Հաճախորդը կհեռացվի ցանկից։ Գլխավոր մենեջերի և բոլոր աշխատակիցների մուտքը կփակվի, իսկ հրավերները կչեղարկվեն։ Պատվերների և հաշվետվությունների պատմությունը կպահպանվի։'),note=node('p','Ջնջումը հաստատելու համար ամեն անգամ մուտքագրեք ձեր ընթացիկ ադմինիստրատորի գաղտնաբառը։'),label=node('label','Ադմինիստրատորի ընթացիկ գաղտնաբառ'),password=node('input'),error=node('p'),actions=node('div'),cancel=node('button','Չեղարկել'),submit=node('button','Հաստատել հաճախորդի ջնջումը');
 dialog.id='clientDeletionDialog';dialog.className='client-deletion-dialog';dialog.setAttribute('aria-labelledby','clientDeletionHeading');dialog.setAttribute('aria-describedby','clientDeletionWarning');heading.id='clientDeletionHeading';name.id='clientDeletionName';warning.id='clientDeletionWarning';warning.setAttribute('role','alert');password.id='clientDeletionPassword';password.type='password';password.autocomplete='current-password';password.required=true;password.maxLength=256;label.htmlFor=password.id;error.id='clientDeletionError';error.setAttribute('role','alert');cancel.type='button';submit.type='submit';submit.id='confirmClientDeletion';submit.className='danger';submit.disabled=true;actions.className='client-deletion-actions';actions.append(cancel,submit);label.append(password);form.append(heading,name,warning,note,label,error,actions);dialog.append(form);document.body.append(dialog);
 let current=null,busy=false,serial=0;
 const clear=()=>{password.value='';error.textContent='';current=null;submit.disabled=true;};
 password.oninput=()=>{submit.disabled=busy||!password.value;};cancel.onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',clear);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current||!password.value)return;
  const target=current,ticket=serial;busy=true;submit.disabled=true;cancel.disabled=true;password.disabled=true;error.textContent='';
  try{
   await api('admin/users/delete',{method:'POST',body:JSON.stringify({id:target.user.id,expectedProfileRevision:target.user.profileRevision,password:password.value})});
   password.value='';if(ticket!==serial)return;dialog.close();await target.done();
  }catch(e){password.value='';if(ticket===serial){if(dialog.open)error.textContent=ZZWS.message(e);else if(!e.staleSession)status(ZZWS.message(e),true);}}
  finally{busy=false;password.disabled=false;cancel.disabled=false;submit.disabled=!password.value;if(ticket===serial&&dialog.open)password.focus();}
 };
 window.ZZWS_CLIENT_DELETION={open(user,done){if(busy)return;clear();serial++;current={user:structuredClone(user),done};name.textContent=user.client+(user.customerCode?' ('+user.customerCode+')':'');window.ZZWS_I18N?.refresh(dialog);dialog.showModal();password.focus();},reset(){serial++;if(dialog.open)dialog.close();clear();}};
})();
