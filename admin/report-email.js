(() => {
 const protect=(element,code)=>{window.ZZWS_I18N?.protectData?.(element,[code]);return element;};
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;},button=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;},request=(path,body)=>ZZWS.json(path,{method:'POST',body:body instanceof FormData?body:JSON.stringify(body)});
 const card=node('fieldset');card.id='userEmailSettings';card.append(node('legend','Էլ․ փոստ՝ հաշվետվությունների համար'));const replyLabel=node('label','Ադմինիստրատորի Reply-To հասցեն'),reply=node('input');reply.type='email';reply.maxLength=254;replyLabel.append(reply);card.append(replyLabel);document.getElementById('userForm').append(card);
 let dialog=null,active=false;
 function reset(){if(dialog){dialog.close();dialog.remove();dialog=null;}active=false;}
 window.ZZWS_REPORT_EMAIL={
  edit(user){reply.value=user.replyToEmail||'';},
  role(role){card.hidden=role!=='admin';},
  payload(){return {replyToEmail:reply.value};},reset,
  async open(order,done,lock,manual){
   reset();
   const d=node('dialog');dialog=d;d.className='report-email-dialog';
   const root=node('div'),error=node('p'),files=node('input'),candidate=node('select'),to=node('fieldset'),extra=node('input'),confirm=node('input'),preview=node('div'),summary=node('p'),cc=node('p'),replyInfo=node('p'),outcomes=node('div');
   files.type='file';files.multiple=true;confirm.type='checkbox';error.setAttribute('role','status');preview.className='report-email-comparison';outcomes.id='reportRecipientResults';outcomes.hidden=true;outcomes.setAttribute('aria-live','polite');
   const close=button('Փակել',()=>{if(!active)reset();}),verify=button('Ստուգել հաշվետվությունը',()=>inspect()),send=button('Ուղարկել հաշվետվությունը',()=>submit()),manualButton=button('Շարունակել ձեռքով',()=>continueManually());
   for(const [control,tone]of [[close,'secondary'],[verify,'secondary'],[send,'primary'],[manualButton,'warning']])control.dataset.actionTone=tone;
   manualButton.hidden=true;send.disabled=true;candidate.hidden=true;
   root.append(node('h2','Ուղարկել հաշվետվություն · №'+order.number),protect(node('p',order.customer.client+' · '+order.customer.customerCode),order.customer.customerCode),node('p','Կցեք բոլոր ֆայլերը։ Համեմատության համար ընտրեք վաճառքի հաշվետվությունը։ Ֆայլերը պահվում են միայն այս բաց պատուհանի հիշողությունում։'),files,summary,candidate,verify,preview,to,cc,replyInfo,outcomes);
   const extraLabel=node('label','Լրացուցիչ էլ․ փոստեր՝ ստորակետով կամ կետ-ստորակետով, ոչ պարտադիր');extraLabel.append(extra);
   const consent=node('label','Հաստատում եմ հաճախորդին և ստացողներին');consent.prepend(confirm);root.append(extraLabel,consent,error,send,manualButton,close);d.append(root);document.body.append(d);d.showModal();files.hidden=true;
   const chooseFiles=button('Ընտրել ֆայլը',()=>files.click());chooseFiles.dataset.actionTone='secondary';files.after(chooseFiles);d.addEventListener('cancel',e=>{if(active)e.preventDefault();else reset();});
   let options,includeDefaults=true;
   const warning=node('p');warning.id='reportDefaultsWarning';warning.setAttribute('role','status');warning.style.color='#b91c1c';
   const defaultsToggle=button('Չուղարկել',()=>{includeDefaults=!includeDefaults;renderDefaults();});defaultsToggle.id='reportDefaultsToggle';
   const defaultsBox=node('div');defaultsBox.className='report-defaults';cc.before(defaultsBox);defaultsBox.append(cc,warning,defaultsToggle);defaultsBox.after(node('p','Ընտրությունը գործում է միայն այս հաշվետվության համար։ Լրացուցիչ էլ․ փոստերը լրացվում են ստորակետով կամ կետ-ստորակետով․ դատարկ դաշտը ստացող չի ավելացնում։'));
   function renderDefaults(){cc.textContent=includeDefaults?(options?.defaultRecipientCount===0?'Լռելյայն պատճենի հասցեներ նշված չեն։ Կուղարկվի ընտրված ստացողներին և ձեռքով ավելացված հասցեներին։':'Հաշվետվությունը կուղարկվի նաև կարգավորումներում նշված լրացուցիչ հասցեներին։'):'Կարգավորումներում նշված հասցեներին ուղարկումն անջատված է։';const invalid=includeDefaults&&options?.invalidDefaultCount>0;warning.hidden=!invalid;warning.textContent=invalid?'Կարգավորումներում կան սխալ պատճենի հասցեներ։ Դրանք կնշվեն առանձին և չեն խանգարի մյուս ստացողներին ուղարկմանը։':'';defaultsToggle.textContent=includeDefaults?'Չուղարկել':'Ուղարկել';defaultsToggle.setAttribute('aria-pressed',String(!includeDefaults));}renderDefaults();
   let selectedFiles=[],proof=null,failures=0,jobId=null,priorJobId=null,statusPending=false,retryRejected=false,requestId=crypto.randomUUID(),lastDelivery=null;
   const choices=[];
   function renderDelivery(delivery){if(!delivery)return;lastDelivery=delivery;outcomes.hidden=false;outcomes.replaceChildren(node('h3','Ուղարկման արդյունքը՝ ըստ հասցեների'));
    const labels={pending:'Դեռ չի ուղարկվել',sending:'Ուղարկվում է…',accepted:'Փոստային սերվերն ընդունել է',retry:'Չի ընդունվել․ կարելի է կրկնել',failed:'Չի ընդունվել',uncertain:'Արդյունքն անհայտ է․ կրկնակի ուղարկումն արգելված է',invalid:'Սխալ հասցե'};
    for(const recipient of delivery.recipients){const row=node('div');row.dataset.recipientId=recipient.id;row.dataset.state=recipient.state;row.dataset.role=recipient.role;row.style.overflowWrap='anywhere';row.append(node('strong',recipient.address||'—'),node('p',recipient.role==='to'?'Հիմնական հասցե':recipient.role==='bcc'?'Թաքնված պատճենի հասցե':'Պատճենի հասցե'),node('p',labels[recipient.state]||recipient.state));outcomes.append(row);}
    outcomes.append(node('p','Սերվերի ընդունումը չի հաստատում մուտքային պանակ հասնելը։ Հետագա վերադարձը ստուգեք փոստարկղում։'));
   }
   try{options=await request('admin/orders/report-options',{orderId:order.id});}catch(e){error.textContent=ZZWS.message(e);return;}if(dialog!==d)return;
   to.append(node('legend','Հաշվետվության ստացողը'));
   if(options.recipient)to.append(node('p',options.recipient));
   else if(options.legacy){to.append(node('p','Հին պատվերի հեղինակը չի պահպանվել։ Ընտրեք ստացողին։'));options.rows.forEach((row,index)=>{if(!row)return;const label=node('label',row),check=node('input');check.type='checkbox';check.value=index;label.prepend(check);to.append(label);choices.push(check);});}
   else to.append(node('p','Պատվերի հեղինակի էլ․ փոստը բացակայում է։'));
   replyInfo.textContent='Reply-To՝ '+(options.replyTo||'Լրացրեք ադմինիստրատորի քարտում');
   if(options.delivery){priorJobId=options.delivery.jobId;requestId=options.requestId||requestId;renderDelivery(options.delivery);statusPending=options.delivery.state==='accepted';retryRejected=options.delivery.retryCount>0&&!options.delivery.pendingCount;failures=options.delivery.pendingCount||options.delivery.retryCount||statusPending?0:2;confirm.checked=true;
    if(options.deliveryChoice){includeDefaults=options.deliveryChoice.includeDefaults;extra.value=options.deliveryChoice.additionalCC||'';for(const choice of choices)choice.checked=options.deliveryChoice.selectedRows?.includes(Number(choice.value));}
    send.textContent=statusPending?'Ավարտել պատվերի թարմացումը':retryRejected?'Կրկնել միայն չընդունված հասցեներին':'Շարունակել մնացած հասցեներին';
   }
   renderDefaults();
   function form(){const f=new FormData();selectedFiles.forEach(file=>f.append('files',file));f.set('orderId',order.id);f.set('revision',order.revision);f.set('reportIndex',candidate.value);return f;}
   function busy(value){active=value;lock(value);for(const input of d.querySelectorAll('input,select,button'))input.disabled=value;send.disabled=value||!proof||failures>=2;close.disabled=value;manualButton.hidden=failures<2||statusPending;manualButton.disabled=value||!proof;
    if(jobId)for(const control of [files,candidate,verify,chooseFiles])control.disabled=true;
    if(jobId||priorJobId)for(const control of [extra,confirm,defaultsToggle,...choices])control.disabled=true;
   }
   files.onchange=()=>{selectedFiles=[...files.files];proof=null;failures=lastDelivery&&!lastDelivery.pendingCount&&!lastDelivery.retryCount&&!statusPending?2:0;jobId=null;if(!priorJobId)requestId=crypto.randomUUID();send.disabled=true;preview.replaceChildren();candidate.replaceChildren();candidate.hidden=true;summary.textContent=selectedFiles.map(f=>f.name+' ('+Math.ceil(f.size/1024)+' KB)').join(' · ');};
   candidate.onchange=()=>{proof=null;send.disabled=true;preview.replaceChildren();};
   async function continueManually(){if(active||failures<2||statusPending||!proof||typeof manual!=='function')return;try{await manual({orderId:order.id,revision:order.revision,lines:structuredClone(proof.lines)});reset();}catch(e){error.textContent=ZZWS.message(e);}}
   async function inspect(){busy(true);error.textContent='';try{
    if(!candidate.options.length){const data=await request('admin/orders/report-inspect',form());if(!data.candidates.length)throw Error('Վաճառքի հաշվետվության համապատասխան ֆայլ չի գտնվել');candidate.append(...data.candidates.map(i=>{const o=node('option',data.files[i].name);o.value=i;return o;}));candidate.hidden=data.candidates.length===1;if(data.candidates.length>1){candidate.selectedIndex=-1;throw Error('Ընտրեք հաշվետվության ֆայլը և կրկին սեղմեք «Ստուգել»');}}
    if(candidate.selectedIndex<0)throw Error('Ընտրեք հաշվետվության ֆայլը');
    proof=await request('admin/orders/report-preview',form());preview.replaceChildren(node('h3','Ստուգման արդյունք'),node('p','Հաշվետվություն՝ '+proof.lines.length+' ապրանք · '+Number(proof.total).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'))+' ֏'));preview.append(ZZWS_ORDER_COMPARE.render(order.lines,proof.lines),ZZWS_ORDER_COMPARE.renderTotal({original_lines:order.lines,total:proof.total}),node('p','Փոփոխություններ՝ '+proof.changes.length+'։ Նամակի ընդունումը հաստատվելուց հետո պատվերի կազմը, քանակները, գները և գումարը կփոխվեն ըստ այս համեմատության։'));
   }catch(e){error.textContent=ZZWS.message(e);}finally{busy(false);}}
   function partial(result){renderDelivery(result.delivery);retryRejected=!!result.delivery?.retryCount&&!result.delivery?.pendingCount;failures=result.manual?2:0;send.textContent=result.continuePending?'Շարունակել մնացած հասցեներին':retryRejected?'Կրկնել միայն չընդունված հասցեներին':'Կրկին փորձել';error.textContent='Որոշ հասցեների ուղարկումը չի հաստատվել։ Ընդունված հասցեներին կրկին չի ուղարկվի։';}
   async function submit(){
    if(active||!proof)return;
    busy(true);error.textContent='Ուղարկվում է…';
    try{for(;;){const f=form();f.set('jobId',jobId||priorJobId||'');f.set('selectedRows',JSON.stringify(choices.filter(c=>c.checked).map(c=>Number(c.value))));f.set('additionalCC',extra.value);f.set('includeDefaults',String(includeDefaults));f.set('retryRejected',String(retryRejected));f.set('confirmCustomer',String(confirm.checked));f.set('requestId',requestId);f.set('proof',proof.proof);f.set('expiry',proof.expiry);
     const result=await request(statusPending?'admin/orders/report-complete':'admin/orders/report-send',f);if(dialog!==d)return;jobId=result.jobId||result.delivery?.jobId||jobId;renderDelivery(result.delivery);
     if(result.completed){active=false;lock(false);reset();await done();return;}
     if(result.statusPending){statusPending=true;send.textContent='Ավարտել պատվերի թարմացումը';error.textContent='Նամակն ընդունված է։ Ավարտեք կազմի, գումարի և կարգավիճակի թարմացումը՝ առանց նամակը կրկին ուղարկելու։';break;}
     if(result.busy){error.textContent='Ուղարկումը դեռ ընթացքի մեջ է։ Սպասեք և կրկին ստուգեք։';break;}
     if(result.delivery){if(result.continuePending){retryRejected=false;error.textContent='Ուղարկվում է մնացած հասցեներին…';continue;}partial(result);break;}
     failures=result.manual?2:1;send.textContent='Կրկին փորձել';error.textContent=failures<2?'Ուղարկումը չհաջողվեց։ Կարող եք կրկին փորձել։':'Երկրորդ փորձից հետո ուղարկումը չի հաստատվել։ Նախ ստուգեք՝ նամակն արդեն ուղարկվե՞լ է։ Այնուհետև ավարտեք պատվերը և անհրաժեշտության դեպքում ուղարկեք ֆայլերը ձեռքով։ Ստուգման արդյունքն ու ֆայլերը պահպանված են այս պատուհանում։';break;
    }}catch(e){try{const recovered=await request('admin/orders/report-status',{orderId:order.id,requestId,...(jobId||priorJobId?{jobId:jobId||priorJobId}:{})});if(dialog!==d)return;if(recovered.completed){active=false;lock(false);reset();await done();return;}if(recovered.jobId)jobId=recovered.jobId;renderDelivery(recovered.delivery);if(recovered.statusPending){statusPending=true;jobId=recovered.jobId;}else if(recovered.delivery)partial(recovered);else if(['failed','uncertain'].includes(recovered.state)||recovered.attempts>=2&&!recovered.busy)failures=2;else if(recovered.state==='retry')failures=1;}catch{}
     error.textContent=ZZWS.message(e)+'։ Պատուհանը և ստուգման արդյունքը պահպանված են։';send.textContent=statusPending?'Ավարտել պատվերի թարմացումը':lastDelivery?.pendingCount?'Շարունակել մնացած հասցեներին':retryRejected?'Կրկնել միայն չընդունված հասցեներին':'Կրկին փորձել';
    }finally{if(dialog===d)busy(false);}
   }
   busy(false);
  }
 };
 const senderInput=node('input');senderInput.type='email';senderInput.autocomplete='email';senderInput.id='reportSender';senderInput.maxLength=254;
 const senderLabel=node('label','Ուղարկողի էլ․ փոստ (From)');senderLabel.append(senderInput);
 const settings=node('fieldset'),settingInputs=[];settings.id='reportEmailSettings';settings.append(node('legend','Հաշվետվությունների էլ․ փոստի կարգավորումներ'),senderLabel,node('p','Հասցեները կարող եք պահպանել մինչև փոստային ծառայությունը միացնելը։ Reply-To-ն վերցվում է գործող ադմինիստրատորի քարտից։'));
 const connectionFields=node('fieldset');connectionFields.append(node('legend','Փոստային կապ'));
 const hostInput=node('input'),portInput=node('input'),securityInput=node('select'),domainInput=node('input'),usernameInput=node('input'),passwordInput=node('input'),passwordState=node('p');
 hostInput.id='reportMailHost';hostInput.type='text';hostInput.maxLength=253;hostInput.autocomplete='off';usernameInput.id='reportMailUsername';usernameInput.type='text';usernameInput.maxLength=320;usernameInput.autocomplete='off';passwordInput.id='reportMailPassword';passwordInput.type='password';passwordInput.maxLength=4096;passwordInput.autocomplete='new-password';portInput.id='reportMailPort';
 portInput.type='number';portInput.min='1';portInput.max='65535';portInput.step='1';portInput.required=true;portInput.inputMode='numeric';securityInput.id='reportMailSecurity';
 domainInput.id='reportMailDomain';domainInput.type='text';domainInput.maxLength=253;domainInput.autocomplete='off';usernameInput.placeholder='OWA մուտքանուն';
 for(const [value,text]of [['starttls','STARTTLS'],['tls','SSL/TLS']]){const option=node('option',text);option.value=value;securityInput.append(option);}
 for(const [text,input]of [['Փոստային սերվեր',hostInput],['Փոստային պորտ',portInput],['Կապի գաղտնագրում',securityInput],['Փոստի դոմեն',domainInput],['Փոստի մուտքանուն',usernameInput],['Փոստի գաղտնաբառ',passwordInput]]){const label=node('label',text);label.append(input);connectionFields.append(label);}
 connectionFields.append(node('p','Դոմենը կարող եք դատարկ թողնել, եթե ձեր փոստային ծառայությունը այն չի պահանջում։'));
 connectionFields.append(node('p','Սովորաբար՝ STARTTLS և 587 պորտ, կամ SSL/TLS և 465 պորտ։ Օգտագործեք ձեր փոստային ծառայության տվյալները։'));
 connectionFields.append(node('p','zigzag.am՝ mail.zigzag.am, 587, STARTTLS, դոմեն՝ zz։ Մուտքանունն ու գաղտնաբառը լրացրեք ձեռքով։'));
 const loginHelp=node('p','Օգտագործեք mail.zigzag.am/owa մուտքի նույն մուտքանունը։ Այն կարող է տարբերվել էլ․ փոստի հասցեի՝ @ նշանից առաջ գրված մասից։');loginHelp.id='reportMailUsernameHelp';usernameInput.setAttribute('aria-describedby',loginHelp.id);connectionFields.append(loginHelp);
 passwordState.id='reportMailPasswordStatus';connectionFields.append(passwordState);settings.append(connectionFields);
 for(let i=0;i<3;i++){const l=node('label',i===2?'Լռելյայն BCC (թաքնված պատճեն)':'Լռելյայն CC '+(i+1)),input=node('input');input.type='text';input.id='reportCC'+(i+1);input.maxLength=4096;l.append(input);settings.append(l);settingInputs.push(input);}
 settings.append(node('p','Առաջին երկու դաշտերը՝ CC, երրորդը՝ BCC (թաքնված պատճեն)։ Յուրաքանչյուր դաշտում հասցեները բաժանեք ստորակետով կամ կետ-ստորակետով։ Դատարկ դաշտերը չեն ուղարկվում։'));
 const state=node('p'),deliveryState=node('p');state.id='reportEmailSettingsStatus';state.setAttribute('role','status');state.setAttribute('aria-live','polite');deliveryState.id='reportEmailDeliveryStatus';deliveryState.hidden=true;
 let revision,settingsBusy=false,settingsDirty=false,settingsSession=null,connectionRevision,passwordSet=false,connectionDirty=false;
 const mailFields=[hostInput,portInput,securityInput,domainInput,usernameInput,passwordInput],fields=[senderInput,...settingInputs,...mailFields],saveButton=button('Պահպանել փոստի կարգավորումները',saveSettings),testButton=button('Ստուգել փոստային կապը',testConnection);saveButton.id='saveReportEmailSettings';testButton.id='testReportMailConnection';
 function settingsControls(){fields.forEach(input=>input.disabled=settingsBusy||!revision);restoreButton.disabled=settingsBusy||!revision;saveButton.disabled=settingsBusy||!revision||!settingsDirty;testButton.disabled=settingsBusy||settingsDirty||!passwordSet;}
 function settingsStatus(text,error=false){state.textContent=text;state.style.color=error?'#b91c1c':'';state.dataset.error=String(error);}
 const connectionDefaults=Object.freeze({host:'mail.zigzag.am',port:587,security:'starttls',domain:'zz'});
 function restoreConnectionDefaults(){hostInput.value=connectionDefaults.host;portInput.value=String(connectionDefaults.port);securityInput.value=connectionDefaults.security;domainInput.value=connectionDefaults.domain;usernameInput.value='';passwordInput.value='';}
 function applySettings(r){revision=r.revision;senderInput.value=r.from_email||r.effectiveFrom||'';settingInputs.forEach((v,i)=>v.value=r.cc[i]||'');const m=r.connection||{};connectionRevision=m.revision;hostInput.value=m.host||connectionDefaults.host;portInput.value=String(m.port||587);securityInput.value=m.security||(m.port===465?'tls':'starttls');const combined=m.username||'',separator=combined.search(/[\\/]/);domainInput.value=m.domain??(separator<0?(m.host?'':connectionDefaults.domain):combined.slice(0,separator));usernameInput.value=m.login??(separator<0?combined:combined.slice(separator+1));passwordSet=!!m.passwordSet;passwordInput.value='';passwordState.textContent=passwordSet?'Գաղտնաբառը պահպանված է։ Դատարկ թողնելու դեպքում այն չի փոխվի։':'Մուտքագրեք փոստի գաղտնաբառը՝ կապը միացնելու համար։';settingsDirty=false;connectionDirty=false;deliveryState.textContent=r.deliveryIssue||'';deliveryState.hidden=!r.deliveryIssue;}
 const restoreButton=button('Վերականգնել zigzag.am-ի կարգավորումները',()=>{restoreConnectionDefaults();usernameInput.dispatchEvent(new Event('input'));usernameInput.focus();});restoreButton.id='restoreZigzagConnection';connectionFields.prepend(restoreButton);
 usernameInput.addEventListener('input',()=>{if(hostInput.value.trim().toLowerCase()==='smtp.gmail.com'&&!domainInput.value.trim()&&usernameInput.value.trim())senderInput.value=usernameInput.value.trim();});
 function validateCopies(){const all=new Set(),probe=node('input');probe.type='email';for(const input of settingInputs){const addresses=input.value.split(/[,;]/).map(v=>v.trim()).filter(Boolean);let error=addresses.length>20?'Մեկ դաշտում թույլատրվում է մինչև 20 հասցե':'';for(const address of addresses){probe.value=address;if(!probe.checkValidity()||address.length>254)error='Նշեք ճիշտ էլ․ փոստի հասցե';all.add(address.toLowerCase());}input.setCustomValidity(error);}if(all.size>50)settingInputs[0].setCustomValidity('Թույլատրվում է ընդհանուր մինչև 50 ստացող');}
 fields.forEach(input=>input.addEventListener('input',()=>{settingsDirty=true;if(mailFields.includes(input))connectionDirty=true;if(settingInputs.includes(input))validateCopies();settingsStatus('Կան չպահպանված փոփոխություններ։');settingsControls();}));
 async function loadSettings(){
  if(settingsBusy)return;
  const session=sessionStorage.getItem('zzws_session_v3');if(settingsSession!==session){revision=null;settingsDirty=false;settingsSession=session;fields.forEach(input=>input.value='');deliveryState.hidden=true;}
  if(settingsDirty)return;
  settingsBusy=true;settingsControls();settingsStatus('Բեռնվում է…');
  try{applySettings(await ZZWS.json('admin/email-settings'));settingsStatus('Բեռնված են պատճենների ընդհանուր հասցեները');}catch(e){settingsStatus(ZZWS.message(e),true);}finally{settingsBusy=false;settingsControls();}
 }
 async function saveSettings(){
  validateCopies();
  if(settingsBusy||!revision||!settingsDirty||!fields.every(input=>input.reportValidity()))return;
  settingsBusy=true;settingsControls();settingsStatus('Պահպանվում է…');
  try{const payload={revision,cc:settingInputs.map(v=>v.value.trim()),fromEmail:senderInput.value.trim()};if(connectionDirty)payload.connection={revision:connectionRevision,host:hostInput.value.trim(),port:Number(portInput.value),security:securityInput.value,domain:domainInput.value.trim(),username:usernameInput.value.trim(),password:passwordInput.value};applySettings(await request('admin/email-settings',payload));settingsStatus('Հասցեները պահպանված են սերվերում։');}catch(e){settingsStatus('Չի պահպանվել։ '+ZZWS.message(e),true);}finally{settingsBusy=false;settingsControls();}
 }
 async function testConnection(){if(settingsBusy||settingsDirty||!passwordSet)return;settingsBusy=true;settingsControls();settingsStatus('Ստուգվում է փոստային կապը…');try{const r=await request('admin/email-settings',{action:'test'});settingsStatus(r.message);}catch(e){settingsStatus(ZZWS.message(e),true);}finally{settingsBusy=false;settingsControls();}}
 settings.append(saveButton,testButton,state,deliveryState);document.getElementById('email').append(settings);settingsControls();
 window.ZZWS_REPORT_EMAIL.loadSettings=()=>loadSettings();
 window.ZZWS_REPORT_EMAIL.clearCredentials=()=>{passwordInput.value='';};
})();
