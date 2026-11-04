(() => {
 'use strict';
 const form=document.getElementById('userForm'),el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 form.classList.add('organized-user-card');
 const anchor=form.querySelector('fieldset'),passwordLabel=form.elements.password.closest('label'),loginHelp=passwordLabel.nextElementSibling;
 function group(id,fields){const box=node('fieldset');box.id=id;box.className='user-card-group';box.append(node('legend'));for(const name of fields){const label=form.elements.namedItem(name)?.closest('label');if(label)box.append(label);}form.insertBefore(box,anchor);return box;}
 function caption(control,text){const label=control.closest('label'),first=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(first)first.textContent=text;}
 caption(form.elements.role,'Հաշվի տեսակ');caption(el('adminScope'),'Իրավունքների մակարդակ');
 group('userAccountGroup',['customerCode','client','role']);
 const commercial=group('userCommercialGroup',['allowResale']),assortment=el('userAccessEditor').closest('fieldset');
 commercial.querySelector('legend').after(el('clientPricingFields'));assortment.id='userAssortmentFields';commercial.append(assortment);
 const login=group('userLoginGroup',['login','active','password']);
 login.append(el('adminRoleSetupNote'),el('adminScopePanel'),el('passwordSetupState'),el('issueInvitation'),el('resetUserPassword'));
 if(loginHelp?.tagName==='P'){loginHelp.id='userLoginHelp';login.append(loginHelp);}
 passwordLabel.classList.add('user-password-field');
 const lifecycle=group('userLifecycleGroup',[]);lifecycle.append(el('archiveClient'),el('deleteClient'),el('deleteClientNote'));
 const actions=node('div');actions.className='user-card-actions';for(const b of [...form.children].filter(n=>n.tagName==='BUTTON'))actions.append(b);form.append(actions);

 const copy=node('details'),select=node('select'),apply=node('button','Կիրառել ընտրված հաճախորդի կարգավորումները');copy.id='copyClientSettings';copy.className='user-card-copy';
 copy.append(node('summary','Լրացնել հաճախորդի օրինակով'),select,node('p','Պատճենվում են միայն կատեգորիան և ապրանքների հասանելիությունը։ Անունը, մուտքանունը, կոնտակտները, գաղտնաբառը և աշխատակցի իրավունքները չեն պատճենվում։'),apply);
 apply.type='button';select.setAttribute('aria-label','Կարգավորումների օրինակ ծառայող հաճախորդ');commercial.querySelector('legend').after(copy);
 let choices=[],currentUser={},scheduled=false;
 apply.onclick=()=>{const source=choices.find(u=>u.id===select.value);if(!source)return;const value={role:'client',active:false};for(const key of ['sheet','brands','allBrands','allowResale','catalogAccess'])if(Object.hasOwn(source,key))value[key]=structuredClone(source[key]);editUser(value);el('userTitle').textContent='Նոր հաճախորդ · կարգավորումների օրինակ՝ '+source.client;};
 const delivery=el('deliveryVariants');
 for(const variant of delivery.querySelectorAll('.delivery-variant')){
  const number=variant.dataset.deliveryVariant;variant.querySelector('h3').textContent='Առաքման տարբերակ '+number;
  caption(form.elements.namedItem('address'+(number==='1'?'':number)),'Առաքման հասցե');caption(form.elements.namedItem('contact'+(number==='1'?'':number)),'Ստացող / հեռախոս');
 }
 const definitions=[
  ['userAccountGroup',staff=>staff?'Աշխատակցի տվյալներ':'Հաճախորդի տվյալներ'],
  ['userPhoneSettings',staff=>staff?'Աշխատակցի կոնտակտներ':'Ընկերության կոնտակտներ'],
  ['deliveryVariants',()=> 'Առաքման հասցեներ և ստացողներ'],
  ['userCommercialGroup',()=> 'Գներ և ապրանքների հասանելիություն'],
  ['clientMembers',()=> 'Գլխավոր մենեջեր և աշխատակիցներ'],
  ['userLoginGroup',staff=>staff?'Մուտք և աշխատակցի իրավունքներ':'Մուտք և հասանելիություն'],
  ['userEmailSettings',()=> 'Հաշվետվությունների պատասխանների հասցե'],
  ['adminChannelsPanel',()=> 'Բջջային մուտք և ծանուցումներ'],
  ['adminPollingPanel',()=> 'Պատվերների թարմացման միջակայք'],
  ['clientReceiptControlPanel',()=> 'Պատվերների ստացման վերահսկում'],
  ['userLifecycleGroup',()=> 'Արխիվացում և ջնջում']
 ];
 const records=new Map();
 function setHidden(element,value){if(element&&element.hidden!==value)element.hidden=value;}
 function register(id,title,staff){
  const box=el(id);if(!box)return null;let record=records.get(id);
  if(!record){let legend=box.querySelector(':scope > legend');if(!legend){legend=node('legend');box.prepend(legend);}const number=node('span'),label=node('span');number.dataset.cardNumber='true';number.dataset.i18nSkip='true';number.className='user-card-section-number';label.className='user-card-section-title';const help=[...legend.querySelectorAll(':scope > .context-help')];legend.replaceChildren(number,document.createTextNode(' '),label,...help);box.dataset.cardSection=id;record={box,number,label,title:null};records.set(id,record);}
  const value=title(staff);if(record.title!==value){record.title=value;record.label.textContent=value;}
  return record;
 }
 function refresh(){
  scheduled=false;const staff=form.elements.role.value==='admin',saved=!!currentUser.id;
  setHidden(copy,staff||saved);setHidden(delivery,staff);setHidden(commercial,staff);
  setHidden(el('clientMembers'),staff||!saved||currentUser.role!=='client'||currentUser.clientRole==='employee');
  setHidden(lifecycle,staff||!saved||(el('archiveClient').hidden&&el('deleteClient').hidden));
  const sections=definitions.map(([id,title])=>register(id,title,staff)).filter(Boolean),ordered=[el('userTitle'),form.elements.id,...sections.map(r=>r.box)],rest=[...form.children].filter(child=>!ordered.includes(child)&&child!==actions),expected=[...ordered,...rest,actions],actual=[...form.children];
  if(actual.length!==expected.length||expected.some((element,i)=>actual[i]!==element))form.replaceChildren(...expected);
  let index=0;for(const record of sections){const visible=!record.box.hidden,label=visible?String(++index)+'.':'';if(record.number.textContent!==label)record.number.textContent=label;}
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(refresh);}}
 form.elements.role.addEventListener('change',schedule);
 new MutationObserver(schedule).observe(form,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 window.ZZWS_CARD_LAYOUT={edit(user,users){currentUser=user;choices=users.filter(u=>u.role==='client'&&u.clientRole!=='employee');select.replaceChildren();for(const u of choices){const option=node('option',u.client+' — '+(u.customerCode||''));option.dataset.i18nSkip='true';option.value=u.id;select.append(option);}apply.disabled=!choices.length;refresh();},refresh:schedule};
 refresh();
})();
