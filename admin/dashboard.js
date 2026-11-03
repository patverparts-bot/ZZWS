(() => {
 'use strict';
 const el=id=>document.getElementById(id),node=(tag,text)=>{const element=document.createElement(tag);if(text!=null)element.textContent=text;return element;};
 window.ZZWS_ADMIN_HOME=window.ZZWS_OWNER_OVERVIEW;
 el('activateMfa').onclick=()=>{
  const dialog=node('dialog'),form=node('form'),label=node('label','Ընթացիկ գաղտնաբառ'),input=node('input'),submit=node('button','Ստեղծել QR կոդ'),close=node('button','Փակել'),error=node('p');submit.dataset.actionTone='primary';input.type='password';input.autocomplete='current-password';input.required=true;label.append(input);close.type='button';error.setAttribute('role','alert');form.append(node('h2','Երկփուլ պաշտպանություն'),node('p','Պահեք նույնականացնող հավելվածի մուտքը։ Մի փոխանցեք QR կոդը կամ գաղտնի բանալին այլ անձի։'),label,error,submit,close);dialog.append(form);document.body.append(dialog);dialog.showModal();close.onclick=()=>{dialog.close();dialog.remove();};form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const result=await ZZWS.json('admin/security/enroll',{method:'POST',body:JSON.stringify({password:input.value})});input.value='';dialog.close();dialog.remove();await completeSecureLogin(result);await enter();status('Երկփուլ պաշտպանությունն ակտիվացված է։');}catch(e){error.textContent=e.message;status(e.message,true);}finally{submit.disabled=false;}};
 };
 el('saveAdminScope').onclick=()=>run(async()=>{await ZZWS.json('admin/users/scope',{method:'POST',body:JSON.stringify({id:el('userForm').elements.id.value,scope:el('adminScope').value})});status('Իրավունքները պահպանված են։ Օգտատիրոջ աշխատաշրջաններն ավարտված են։');});
})();
