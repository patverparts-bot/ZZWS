(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.requirePasswordSetup=user=>new Promise(resolve=>{
  const client=user.role==='client',setup=user.needsPasswordSetup,dialog=node('dialog'),form=node('form'),message=node('p'),submit=node('button',setup?'Ակտիվացնել հաշիվը':'Պահպանել տվյալները'),cancel=node('button','Ելք'),fields={};dialog.id='passwordSetup';dialog.className='account-registration';message.setAttribute('role','alert');cancel.type='button';
  form.append(node('h2',setup?'Անձնական հաշվի գրանցում':'Լրացրեք անձնական տվյալները'));
  if(client){
   form.append(node('p',user.client),node('p','Նշեք ճիշտ անունը, ազգանունը, հեռախոսահամարը և էլ․ փոստը։ Այդ տվյալներով կկապվենք ձեզ հետ, իսկ նշված էլ․ փոստով կստանաք վաճառքի հաշվետվությունները։ Մինչև ավարտելը ստուգեք տվյալները։'));
   for(const [key,title,type,autocomplete]of [['firstName','Անուն','text','given-name'],['lastName','Ազգանուն','text','family-name'],['phone','Հեռախոս','tel','tel'],['email','Էլ․ փոստ','email','email']]){const label=node('label',title),input=node('input');input.name=key;input.type=type;input.autocomplete=autocomplete;input.required=true;input.maxLength=key==='email'?254:key==='phone'?40:100;input.value=user.person?.[key]||'';label.append(input);form.append(label);fields[key]=input;}
   if(setup)form.append(node('p','Մուտքանունը՝ լատինատառ տառերով, թվերով, կետով, գծիկով կամ ընդգծումով։ Գաղտնաբառը՝ առնվազն 6 նիշ։'));
   const label=node('label','Անձնական մուտքանուն'),input=node('input');input.name='login';input.required=true;input.maxLength=80;input.pattern='[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}';input.autocomplete='username';input.value=user.login?.startsWith('pending.')?'':user.login||'';input.readOnly=!setup;label.append(input);form.append(label);fields.login=input;
  }
  if(setup)for(const [key,title]of [['password','Նոր գաղտնաբառ'],['confirm','Կրկնեք գաղտնաբառը']]){const label=node('label',title),input=node('input');input.name=key;input.type='password';input.autocomplete='new-password';input.required=true;input.minLength=6;input.maxLength=256;if(!client){input.pattern='[0-9]{6,256}';input.inputMode='numeric';}label.append(input);form.append(label);fields[key]=input;}
  form.append(message,submit,cancel);dialog.append(form);document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());
  cancel.onclick=async()=>{try{await ZZWS.json('logout',{method:'POST'});}catch{}ZZWS.clearSession();dialog.close();dialog.remove();resolve(null);};
  form.onsubmit=async e=>{e.preventDefault();if(setup&&fields.password.value!==fields.confirm.value){message.textContent='Գաղտնաբառերը չեն համընկնում';return;}submit.disabled=true;cancel.disabled=true;message.textContent='';try{const payload=Object.fromEntries(Object.entries(fields).filter(([k])=>k!=='confirm').map(([k,v])=>[k,v.value]));const result=await completeSecureLogin(await ZZWS.json(setup?'account/password':'account/profile',{method:'POST',body:JSON.stringify(payload)}));dialog.close();dialog.remove();resolve(result);}catch(error){message.textContent=error.message;}finally{submit.disabled=false;cancel.disabled=false;}};
  dialog.showModal();
 });
})();
