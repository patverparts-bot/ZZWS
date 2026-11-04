/* Manual, account-bound refresh of the complete saved specification catalogue. */
(() => {
 'use strict';
 const host=document.getElementById('catalogControls'),workspace=document.getElementById('workspace');
 if(!host||!workspace)return;
 const endpoint='admin/product-specifications',node=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const panel=node('section','product-specifications-panel');panel.id='productSpecificationsPanel';panel.dataset.i18nSkip='true';panel.dataset.source='zigzag';panel.hidden=true;
 const heading=node('h2'),source=node('p','product-specifications-source'),intro=node('p'),last=node('p','product-specifications-last'),actions=node('div','product-specifications-actions');
 const start=node('button'),resume=node('button'),cancel=node('button'),reload=node('button');
 for(const [button,id,tone]of [[start,'Start','primary'],[resume,'Resume','primary'],[cancel,'Cancel','warning'],[reload,'Reload','secondary']]){button.type='button';button.id='productSpecifications'+id;button.dataset.actionTone=tone;actions.append(button);}
 const progress=node('progress'),counts=node('dl','product-specifications-counts'),message=node('p','product-specifications-status'),note=node('p','product-specifications-note'),errors=node('details','product-specifications-errors'),errorSummary=node('summary'),errorList=node('ul');
 progress.id='productSpecificationsProgress';message.id='productSpecificationsStatus';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.setAttribute('aria-atomic','true');errors.append(errorSummary,errorList);
 const countNodes={};for(const key of ['processed','total','refreshed','retained']){const pair=node('div'),label=node('dt'),value=node('dd');value.id='productSpecifications'+key[0].toUpperCase()+key.slice(1);pair.append(label,value);counts.append(pair);countNodes[key]={label,value};}
 panel.append(heading,source,intro,last,actions,progress,counts,message,note,errors);host.append(panel);
 let epoch=0,actor=null,snapshot=null,busy=null,controller=null,pumping=false,paused=false,wasVisible=false,localError='',notice='',needsStatus=false,forbidden=false,notified=null;
 const ru=()=>window.ZZWS_I18N?.language==='ru';
 const words={
  ru:{title:'Характеристики товаров',source:'Источник: zigzag.am',intro:'Обновляет сохранённые характеристики всего каталога, включая срок гарантии. Если свежие данные не подтверждены, сохраняются прежние значения.',start:'Обновить характеристики',resume:'Продолжить',cancel:'Остановить обновление',reload:'Обновить состояние',last:'Последняя проверка',never:'Ручное обновление ещё не выполнялось.',processed:'Проверено',total:'Всего',refreshed:'Обновлено',retained:'Сохранены прежние',loading:'Получаем состояние обновления…',starting:'Начинаем обновление характеристик…',running:'Проверяем характеристики товаров на zigzag.am…',paused:'Обновление можно продолжить с сохранённого места.',cancelling:'Останавливаем обновление…',completed:'Обновление завершено.',partial:'Обновление завершено. Для части товаров сохранены прежние характеристики.',cancelled:'Обновление остановлено. Уже обновлённые характеристики сохранены.',ready:'Обновление запускается только по этой кнопке.',keepOpen:'Во время обновления оставьте эту страницу открытой. Если закрыть её, после возвращения можно продолжить.',noData:'Сохранённых характеристик для обновления пока нет.',failure:'Не удалось получить ответ. Обновите состояние и продолжите.',unavailable:'Обновление характеристик пока недоступно на сервере.',denied:'Нет прав на обновление характеристик.',busy:'Этот этап уже выполняется. Обновите состояние перед продолжением.',errors:'Товары с сохранёнными прежними данными',errorDefault:'Свежие характеристики не подтверждены.',errorVariant:'Точная модель не совпала с источником.',errorMissing:'Товар или полные характеристики не найдены.',errorAccess:'Источник временно недоступен.',moreErrors:'Показаны последние 20 записей.'},
  hy:{title:'Ապրանքների բնութագրեր',source:'Աղբյուր՝ zigzag.am',intro:'Թարմացնում է ամբողջ կատալոգի պահպանված բնութագրերը, ներառյալ երաշխիքի ժամկետը։ Եթե նոր տվյալները չեն հաստատվում, պահպանվում են նախկին արժեքները։',start:'Թարմացնել բնութագրերը',resume:'Շարունակել',cancel:'Դադարեցնել թարմացումը',reload:'Թարմացնել վիճակը',last:'Վերջին ստուգումը',never:'Ձեռքով թարմացում դեռ չի կատարվել։',processed:'Ստուգված',total:'Ընդամենը',refreshed:'Թարմացված',retained:'Պահպանվել են նախկինը',loading:'Թարմացման վիճակը բեռնվում է…',starting:'Բնութագրերի թարմացումը սկսվում է…',running:'Ստուգվում են ապրանքների բնութագրերը zigzag.am-ում…',paused:'Կարող եք շարունակել թարմացումը պահպանված տեղից։',cancelling:'Թարմացումը դադարեցվում է…',completed:'Թարմացումն ավարտված է։',partial:'Թարմացումն ավարտված է։ Որոշ ապրանքների նախկին բնութագրերը պահպանվել են։',cancelled:'Թարմացումը դադարեցված է։ Արդեն թարմացված բնութագրերը պահպանվել են։',ready:'Թարմացումը սկսվում է միայն այս կոճակով։',keepOpen:'Թարմացման ընթացքում էջը բաց պահեք։ Եթե փակեք այն, վերադառնալուց հետո կարող եք շարունակել։',noData:'Թարմացնելու համար պահպանված բնութագրեր դեռ չկան։',failure:'Չհաջողվեց ստանալ պատասխանը։ Թարմացրեք վիճակը և շարունակեք։',unavailable:'Բնութագրերի թարմացումը սերվերում դեռ հասանելի չէ։',denied:'Բնութագրերը թարմացնելու իրավունք չկա։',busy:'Այս փուլն արդեն կատարվում է։ Շարունակելուց առաջ թարմացրեք վիճակը։',errors:'Ապրանքներ, որոնց նախկին տվյալները պահպանվել են',errorDefault:'Նոր բնութագրերը չեն հաստատվել։',errorVariant:'Ճշգրիտ մոդելը չի համընկել աղբյուրին։',errorMissing:'Ապրանքը կամ ամբողջական բնութագրերը չեն գտնվել։',errorAccess:'Աղբյուրը ժամանակավորապես անհասանելի է։',moreErrors:'Ցուցադրված են վերջին 20 գրառումները։'}
 };
 const text=()=>words[ru()?'ru':'hy'];
 const session=()=>{try{const user=window.ZZWS_HELP_USER,token=sessionStorage.getItem('zzws_session_v3');return user?.id&&token?user.id+'\u0000'+token:null;}catch{return null;}};
 const permitted=()=>window.ZZWS_HELP_USER?.role==='admin'&&window.ZZWS_HELP_USER?.adminScope==='owner'&&window.ZZWS_ADMIN_HOME?.can('catalogControls')===true&&!workspace.hidden&&!!session();
 const visible=()=>permitted()&&!host.hidden&&!document.hidden;
 const active=()=>snapshot?.job?.status==='running';
 const valid=(ticket,owner)=>ticket===epoch&&owner===actor&&owner===session()&&visible();
 const disabled=(button,value)=>{if(button.disabled!==value)button.disabled=value;};
 const date=value=>{const d=new Date(value);return value&&Number.isFinite(d.valueOf())?d.toLocaleString(ru()?'ru-RU':'hy-AM',{timeZone:'Asia/Yerevan'}):null;};
 function render(){
  const t=text(),job=snapshot?.job;heading.textContent=t.title;source.textContent=t.source;intro.textContent=t.intro;
  start.textContent=t.start;resume.textContent=t.resume;cancel.textContent=t.cancel;reload.textContent=t.reload;
  const checked=date(snapshot?.lastCheckedAt||job?.finishedAt);last.textContent=checked?t.last+': '+checked:t.never;
  start.hidden=!!active();resume.hidden=!active();cancel.hidden=!active();
  disabled(start,!!busy||pumping||!snapshot||needsStatus||forbidden||snapshot.availableCount===0);
  disabled(resume,!!busy||pumping||forbidden);disabled(cancel,busy==='cancel'||forbidden);disabled(reload,!!busy||pumping||forbidden);
  progress.hidden=!job||!job.total;progress.max=Math.max(1,job?.total||1);progress.value=job?.processed||0;progress.setAttribute('aria-label',t.processed);
  counts.hidden=!job;for(const key of Object.keys(countNodes)){countNodes[key].label.textContent=t[key];countNodes[key].value.textContent=String(job?.[key]||0);}
  let state=job?.status==='completed'?(job.retained?t.partial:t.completed):job?.status==='cancelled'?t.cancelled:active()?(pumping?t.running:t.paused):snapshot?.availableCount===0?t.noData:t.ready;
  if(busy==='load'&&!snapshot)state=t.loading;if(busy==='start')state=t.starting;if(busy==='cancel')state=t.cancelling;
  message.textContent=t[localError]||t[notice]||state;message.dataset.error=String(!!localError);panel.setAttribute('aria-busy',String(!!busy));
  note.hidden=!active();note.textContent=t.keepOpen;
  const entries=Array.isArray(job?.errors)?job.errors:[];errors.hidden=!entries.length;errorSummary.textContent=t.errors+' · '+entries.length;errorList.replaceChildren();
  for(const entry of entries.slice(-20)){const li=node('li'),code=String(entry.code||''),reason=/model|variant|mismatch/i.test(code)?t.errorVariant:/missing|not_found|no_spec|empty/i.test(code)?t.errorMissing:/http|upstream|timeout|denied|robots|fetch|unavailable/i.test(code)?t.errorAccess:t.errorDefault;li.textContent=String(entry.articul||'')+' — '+reason;errorList.append(li);}
  if(entries.length>20){const li=node('li');li.textContent=t.moreErrors;errorList.append(li);}
 }
 function stop(clear=false){
  epoch++;controller?.abort();controller=null;busy=null;pumping=false;paused=active();
  if(clear){actor=null;snapshot=null;paused=false;localError='';notice='';needsStatus=false;forbidden=false;notified=null;}
  render();
 }
 function accept(data){
  if(!data||typeof data!=='object'||!Object.hasOwn(data,'job'))throw Error('invalid_refresh_status');
  const job=data.job;
  if(job){
   if(typeof job.id!=='string'||!['running','completed','cancelled'].includes(job.status))throw Error('invalid_refresh_job');
   for(const key of ['total','processed','refreshed','retained'])if(!Number.isSafeInteger(job[key])||job[key]<0)throw Error('invalid_refresh_count');
   if(job.processed>job.total||job.refreshed+job.retained>job.processed)throw Error('invalid_refresh_count');
  }
  snapshot=data;panel.dataset.source=typeof data.source==='string'?data.source:'zigzag';needsStatus=false;localError='';notice='';
  if(!active()){pumping=false;paused=false;}
  if(job?.status==='completed'&&job.id!==notified){notified=job.id;window.dispatchEvent(new CustomEvent('zzws:product-specificationsupdated',{detail:{updatedAt:job.finishedAt||job.updatedAt}}));try{void Promise.resolve(window.ZZWS_PRODUCT_SPECIFICATIONS_LIVE?.refresh({force:true})).catch(()=>{});}catch{}}
 }
 async function request(action,kind){
  const ticket=epoch,owner=actor,control=new AbortController();controller=control;busy=kind;render();
  const timeout=setTimeout(()=>control.abort(),55000);
  try{
   const data=await api(endpoint,{...(action?{method:'POST',body:JSON.stringify(action)}:{}),signal:control.signal});
   if(!valid(ticket,owner))return null;accept(data);return data;
  }catch(error){if(!valid(ticket,owner))return null;throw error;}
  finally{clearTimeout(timeout);if(controller===control)controller=null;if(valid(ticket,owner)){busy=null;render();}}
 }
 function failed(error){
  pumping=false;paused=active();needsStatus=true;notice='';
  if(error?.status===401||error?.staleSession){stop(true);panel.hidden=true;return;}
  if(error?.status===403)forbidden=true;
  localError=error?.status===403?'denied':error?.status===404?'unavailable':'failure';render();
 }
 async function load(){
  if(!visible()||busy||pumping)return;actor=session();
  try{await request(null,'load');paused=active();render();}catch(error){failed(error);}
 }
 async function pump(){
  const ticket=epoch,owner=actor;pumping=true;paused=false;render();
  try{
   while(valid(ticket,owner)&&pumping&&active()){
    const data=await request({action:'step',jobId:snapshot.job.id},'step');if(!data||!valid(ticket,owner))return;
    if(data.busy){pumping=false;paused=active();notice='busy';render();return;}
    if(active())await new Promise(resolve=>setTimeout(resolve,200));
   }
  }catch(error){if(valid(ticket,owner))failed(error);}
  finally{if(valid(ticket,owner)){pumping=false;render();}}
 }
 start.onclick=async()=>{
  if(!visible()||busy||pumping||active()||!snapshot||needsStatus||forbidden||snapshot.availableCount===0)return;
  try{const data=await request({action:'start'},'start');if(data&&active())await pump();}catch(error){failed(error);}
 };
 resume.onclick=async()=>{
  if(!visible()||busy||pumping||!active()||forbidden)return;
  try{const data=await request(null,'load');if(data&&active())await pump();}catch(error){failed(error);}
 };
 cancel.onclick=async()=>{
  if(!visible()||!active()||busy==='cancel'||forbidden)return;stop();
  try{await request({action:'cancel',jobId:snapshot.job.id},'cancel');render();}catch(error){failed(error);}
 };
 reload.onclick=()=>{void load();};
 function sync(){
  const current=session();if(actor&&actor!==current)stop(true);
  panel.hidden=!permitted();const shown=visible();
  if(!shown){if(wasVisible||busy||pumping)stop();wasVisible=false;return;}
  if(!actor)actor=current;
  if(!wasVisible){wasVisible=true;void load();}else render();
 }
 const observer=new MutationObserver(sync);observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});observer.observe(host,{attributes:true,attributeFilter:['hidden']});const tab=document.querySelector('[data-tab="catalogControls"]');if(tab)observer.observe(tab,{attributes:true,attributeFilter:['hidden']});
 let paintQueued=false;new MutationObserver(()=>{if(paintQueued)return;paintQueued=true;queueMicrotask(()=>{paintQueued=false;render();});}).observe(actions,{subtree:true,attributes:true,attributeFilter:['disabled']});
 document.addEventListener('visibilitychange',sync);window.addEventListener('zzws:languagechange',render);
 window.ZZWS_ADMIN_PRODUCT_SPECIFICATIONS=Object.freeze({load,reset(){stop(true);wasVisible=false;panel.hidden=true;}});render();sync();
})();
