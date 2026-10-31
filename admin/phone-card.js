(() => {
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const card=node('fieldset'),clients=node('div'),inputs=[];card.id='userPhoneSettings';card.append(node('legend','Կոնտակտային անձինք'));
 const legacyInfo=node('p','Լրացրեք անունները և ստուգեք, որ յուրաքանչյուր տողի հեռախոսն ու էլ․ փոստը պատկանում են նույն անձին։');legacyInfo.className='help';legacyInfo.hidden=true;clients.append(legacyInfo);
 for(let i=0;i<5;i++){
  const row=node('div');row.className='person-contact-row';row.setAttribute('role','group');row.setAttribute('aria-label','Կոնտակտ '+(i+1));
  const fields={};
  for(const [key,title,id,type,max]of [['name','Կոնտակտի անունը','contactName','text',200],['phone','Հեռախոս','clientPhone','tel',40],['email','Էլ․ փոստ','clientEmail','text',5000]]){
   const label=node('label',title),input=node('input');input.id=id+(i+1);label.htmlFor=input.id;input.type=type;input.maxLength=max;input.autocomplete='off';input.placeholder=key==='phone'?'+374…':key==='email'?'name@example.am':'';input.dataset.contactField=key;label.append(input);row.append(label);fields[key]=input;
  }
  const update=()=>{fields.name.required=!!(fields.phone.value.trim()||fields.email.value.trim());};Object.values(fields).forEach(input=>input.addEventListener('input',update));fields.update=update;clients.append(row);inputs.push(fields);
 }
 const managerLabel=node('label','Մենեջերի հեռախոսը'),manager=node('input');manager.id='managerPhone';manager.type='tel';manager.maxLength=40;manager.autocomplete='off';manager.placeholder='+374…';managerLabel.append(manager);
 card.append(clients,managerLabel,node('p','Լրացրեք երկրի կոդով։ Ընդունվում են նաև հայկական տեղական համարներ։ Մենեջերի հեռախոսը կավելացվի հիշեցման տեքստում։'));document.getElementById('userForm').append(card);
 let role='client';
 window.ZZWS_PHONE_CARD={
  edit(user){inputs.forEach((fields,i)=>{const contact=user.contacts?.[i]||{name:'',phone:user.phoneNumbers?.[i]||'',email:user.emailRows?.[i]||''};for(const key of ['name','phone','email'])fields[key].value=contact[key]||'';fields.update();});manager.value=user.managerPhone||'';legacyInfo.hidden=!!user.contacts||!inputs.some(f=>f.phone.value||f.email.value);},
  role(value){role=value;clients.hidden=role!=='client';inputs.forEach(f=>{for(const key of ['name','phone','email'])f[key].disabled=role!=='client';});},
  payload(){return {...(role==='client'?{contacts:inputs.map(fields=>Object.fromEntries(['name','phone','email'].map(key=>[key,fields[key].value])))}:{}),managerPhone:manager.value};}
 };
})();
