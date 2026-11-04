(() => {
  // Search and filters belong to this catalogue opening, not synchronized account state.
  const sections=['cart','favorites','history','preferences','draft'];
  const suffix={cart:'cart',favorites:'favs',history:'history'};
  const fields=['organizationSelect','deliveryMethodInput','deliveryDateInput','deliveryAddressInput','contactPersonInput','orderCommentInput'];
  let owner=null,versions={},baseline={},pending={},timer=null,busy=false,ready=false,pollAt=0,suspended=false,clearedUntil=0,epoch=0,activeSession=null,inFlight=null;
  const current=(ticket=epoch,id=owner,session=activeSession)=>ticket===epoch&&id===owner&&id===serverIdentity?.id&&session===sessionStorage.getItem('zzws_session_v3');
  const copy=v=>JSON.parse(JSON.stringify(v));
  const sameValue=(a,b)=>{
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameValue(a[k],b[k]));
  };
  const key=()=>`zzws_pending_${owner}`;
  const cache=(section,fallback)=>{try{return JSON.parse(localStorage.getItem('zigzag_'+suffix[section]+'_'+userStorageId())||JSON.stringify(fallback));}catch{return fallback;}};
  const banner=(message,error=false)=>{let box=document.getElementById('memoryStatus');if(!box){box=document.createElement('p');box.id='memoryStatus';box.setAttribute('role','status');document.getElementById('welcomeMsg').after(box);}box.textContent=message;box.classList.toggle('sync-error',error);};
  const persist=()=>{if(!owner||!current())return;try{if(Object.keys(pending).length)localStorage.setItem(key(),JSON.stringify(pending));else localStorage.removeItem(key());}catch{banner('Չհաջողվեց պահպանել տեղային պատճենը։ Մի փակեք էջը մինչև համաժամացումը։',true);}};
  function read(){
    const draft={};for(const id of fields)draft[id]=document.getElementById(id)?.value||'';
    return {cart:copy(cart),favorites:[...favoritesSet],history:cache('history',[]),preferences:{theme:localStorage.getItem('zigzag_theme')||'light',filtersOpen:localStorage.getItem('zigzag_filters_open_'+userStorageId())||'false',priceMode:adminOrderPriceMode,hiddenColumns:JSON.parse(localStorage.getItem('zigzag_columns_'+userStorageId())||'[]'),dealerOffers:JSON.parse(localStorage.getItem('zigzag_dealer_offers_'+userStorageId())||'[]')},draft};
  }
  function apply(section,value,render=true){
    value=value??(['favorites','history'].includes(section)?[]:{});
    if(suffix[section])localStorage.setItem('zigzag_'+suffix[section]+'_'+userStorageId(),JSON.stringify(value));
    if(section==='cart'){cart=normalizeCart(value);if(render&&catalogLoaded){reconcileCart();updateOrderPanel();refreshAllActions();if(!document.getElementById('orderModal').classList.contains('hidden')){renderModalItems();savedList();}}}
    if(section==='favorites'){favoritesSet=new Set(value);if(render&&catalogLoaded)resetAndRender();}
    if(section==='history'&&render)renderOrderHistoryList();
    if(section==='preferences'){
      localStorage.setItem('zigzag_dealer_offers_'+userStorageId(),JSON.stringify(value.dealerOffers||[]));
      localStorage.setItem('zigzag_columns_'+userStorageId(),JSON.stringify(value.hiddenColumns||[]));window.ZZWS_COLUMNS?.render();
      const theme=value.theme==='dark'?'dark':'light';localStorage.setItem('zigzag_theme',theme);document.documentElement.classList.toggle('dark',theme==='dark');
      localStorage.setItem('zigzag_filters_open_'+userStorageId(),value.filtersOpen||'false');
      if(render)toggleMobileFilters(value.filtersOpen==='1');
      adminOrderPriceMode=isAdminUser()&&(value.priceMode==='KP'||/^cat_[a-z0-9_-]{1,60}$/.test(value.priceMode||''))?value.priceMode:'WS';localStorage.setItem('zigzag_admin_price_mode_'+userStorageId(),adminOrderPriceMode);
    }
    if(section==='draft'){for(const id of fields){const el=document.getElementById(id);if(!el)continue;if(id==='organizationSelect'){
      if(Object.hasOwn(value,id)){el.value=clientRowsData.some(row=>row.id===value[id])?value[id]:'';if(!el.value)banner('Պահպանված պատվերի համար կրկին ընտրեք առաքման տարբերակը։ Հասցեն և կոնտակտը պահպանված են։',true);}
      continue;
    }const row=selectedOrderContact();el.value=Object.hasOwn(value,id)?value[id]:id==='deliveryMethodInput'?'Առաքում':id==='deliveryAddressInput'?row?.address||'':id==='contactPersonInput'?row?.contact||'':'';}handleDeliveryMethodChange();checkDeliveryBadge();}
  }
  function capture(){
    if(!ready||suspended||!current())return;
    const values=read();
    for(const section of sections){
      if(JSON.stringify(values[section])===JSON.stringify(baseline[section]))continue;
      const version=pending[section]?.version??versions[section]??0;
      pending[section]={value:copy(values[section]),version,workspaceGeneration:ZZWS.generations?.().workspace||1};baseline[section]=copy(values[section]);
    }persist();
  }
  function acknowledge(section,item,version){
    versions[section]=version;
    if(sameValue(pending[section]?.value,item.value))delete pending[section];
    else if(pending[section])pending[section].version=version;
  }
  async function flushWork(ticket,activeOwner,session){
    const valid=()=>current(ticket,activeOwner,session)&&ready;
    if(!valid())return false;
    capture();busy=true;
    try{
      for(const section of sections){
        if(!pending[section])continue;
        const item=copy(pending[section]);
        try{
          const result=await ZZWS.json('me/state',{method:'POST',timeoutMs:15000,body:JSON.stringify({section,value:item.value,version:item.version})});
          if(!valid())return false;
          acknowledge(section,item,result.version);
        }catch(e){
          if(!valid())return false;
          if(e.status===409){
            if(e.data.cleared){delete pending[section];versions[section]=e.data.version;suspended=true;apply(section,e.data.value);baseline[section]=read()[section];suspended=false;clearedUntil=Date.now()+30000;persist();continue;}
            // An earlier request may have committed before reload or a lost response.
            if(sameValue(e.data.value,item.value)){acknowledge(section,item,e.data.version);persist();continue;}
            const label={cart:'զամբյուղ',favorites:'ընտրվածներ',history:'պատմություն',filters:'ֆիլտրեր',preferences:'կարգավորումներ',draft:'պատվերի տվյալներ'}[section];
            suspended=true;
            const keep=confirm('Այլ սարքում փոփոխվել են՝ '+label+'։ Լավ՝ այս սարքի տվյալներով փոխարինել սերվերի տվյալները։ Չեղարկել՝ բեռնել սերվերի տվյալները։');
            if(keep)pending[section].version=e.data.version;
            else{delete pending[section];versions[section]=e.data.version;apply(section,e.data.value);baseline[section]=read()[section];}
            suspended=false;
          }else throw e;
        }persist();
      }
      banner(Object.keys(pending).length?'Փոփոխությունները համաժամացվում են…':clearedUntil>Date.now()?'Ադմինիստրատորը մաքրել է տվյալները։ Դրանք թարմացվել են այս սարքում':'Տվյալները պահպանվել են սերվերում');
      if(!Object.keys(pending).length&&Date.now()-pollAt>15000&&!document.hidden){
        pollAt=Date.now();const state=await ZZWS.json('me/state',{timeoutMs:15000});
        if(!valid())return false;capture();
        suspended=true;
        for(const section of sections){if(!pending[section]&&(state.versions[section]||0)!==(versions[section]||0)){apply(section,state.data[section]);versions[section]=state.versions[section]||0;baseline[section]=read()[section];}}
        suspended=false;
      }
      return !Object.keys(pending).length;
    }catch(e){if(valid())banner('Փոփոխությունները սպասում են սերվեր ուղարկելուն՝ '+e.message,true);return false;}
    finally{if(valid()){busy=false;suspended=false;persist();}}
  }
  async function flush(){
    if(inFlight)return inFlight;
    if(!ready||!current())return false;
    const work=flushWork(epoch,owner,activeSession);inFlight=work;
    try{return await work;}finally{if(inFlight===work)inFlight=null;}
  }
  async function prepareLeave(){
    if(!owner||!ready||!current()){
      const id=window.ZZWS_ACCOUNT_CACHE?.owner();let journal={};try{journal=JSON.parse(localStorage.getItem('zzws_pending_'+id)||'{}');}catch{}
      return !Object.keys(journal).length||confirm(window.ZZWS_I18N?.language==='ru'?'Не удалось сохранить изменения. Выйти без сохранения?':'Չհաջողվեց պահպանել փոփոխությունները։ Դո՞ւրս գալ առանց պահպանելու։');
    }
    const ticket=epoch,id=owner,session=activeSession;capture();await flush();
    if(!current(ticket,id,session))return owner===id&&epoch===ticket&&(!Object.keys(pending).length||confirm(window.ZZWS_I18N?.language==='ru'?'Не удалось сохранить изменения. Выйти без сохранения?':'Չհաջողվեց պահպանել փոփոխությունները։ Դո՞ւրս գալ առանց պահպանելու։'));
    capture();if(Object.keys(pending).length)await flush();
    if(!current(ticket,id,session))return owner===id&&epoch===ticket&&(!Object.keys(pending).length||confirm(window.ZZWS_I18N?.language==='ru'?'Не удалось сохранить изменения. Выйти без сохранения?':'Չհաջողվեց պահպանել փոփոխությունները։ Դո՞ւրս գալ առանց պահպանելու։'));
    return !Object.keys(pending).length||confirm(window.ZZWS_I18N?.language==='ru'?'Не удалось сохранить изменения. Выйти без сохранения?':'Չհաջողվեց պահպանել փոփոխությունները։ Դո՞ւրս գալ առանց պահպանելու։');
  }
  async function start(user){
    stop();owner=user.id;activeSession=sessionStorage.getItem('zzws_session_v3');window.ZZWS_ACCOUNT_CACHE?.record(user.id);const ticket=epoch,session=activeSession;
    let state;try{state=await ZZWS.json('me/state');}catch(error){if(!current(ticket,user.id,session))return;throw error;}if(!current(ticket,user.id,session))return;versions=state.versions||{};
    try{pending=JSON.parse(localStorage.getItem(key())||'{}');}catch{pending={};}
    // A reset/restore tombstone supersedes only older local section journals.
    for(const section of sections)if(pending[section]&&(Number(state.cleared?.[section]||0)>Number(pending[section].version||0)||Number(ZZWS.generations?.().workspace||1)>Number(pending[section].workspaceGeneration||1)))delete pending[section];
    try{const generation=Number(ZZWS.generations?.().workspace||1),ownRequest='zzws_order_request_'+owner,prefix='zzws_assisted_request_'+owner+'_';for(const name of Object.keys(sessionStorage))if(name===ownRequest||name.startsWith(prefix)){const item=JSON.parse(sessionStorage.getItem(name)||'null');if(item&&generation>Number(item.workspaceGeneration||1))sessionStorage.removeItem(name);}}catch{}
    delete pending.filters;resetCatalogFiltersOnOpen();
    for(const id of fields){const el=document.getElementById(id);if(el)el.value='';}
    populateOrderModalFields();modalFieldsInitialized=true;
    for(const section of sections){
      let value=state.data[section]??(['favorites','history'].includes(section)?[]:{});
      if(pending[section])value=pending[section].value;
      apply(section,value,false);
    }
    baseline=read();ready=true;pollAt=Date.now();timer=setInterval(flush,1200);persist();
  }
  async function invalidateHistory(){
    const who=owner,ticket=epoch,session=activeSession;if(!who||!ready)return;const state=await ZZWS.json('me/state');if(!current(ticket,who,session)||!ready)return;
    const cleared=Number(state.cleared?.history||0);if(pending.history&&Number(pending.history.version||0)>=cleared)return;
    delete pending.history;versions.history=state.versions?.history||0;suspended=true;
    try{apply('history',state.data?.history||[],true);baseline.history=read().history;}finally{suspended=false;}
    persist();
  }
  function stop(){++epoch;ready=false;if(timer)clearInterval(timer);timer=null;owner=null;activeSession=null;inFlight=null;busy=false;suspended=false;pending={};versions={};baseline={};}
  async function savedList(){
    const root=document.getElementById('savedCartsList');if(!root)return;
    try{const data=await ZZWS.json('me/carts');root.replaceChildren();
      document.getElementById('savedCartsCount').textContent=`${data.carts.length} / 10`;
      if(!data.carts.length){const empty=document.createElement('p');empty.className='saved-empty';empty.textContent='Պահպանված զամբյուղներ դեռ չկան։ Ավելացրեք ապրանքներ և պահպանեք առաջին տարբերակը։';root.append(empty);}
      for(const row of data.carts){
        const box=document.createElement('article'),info=document.createElement('div'),title=document.createElement('h5'),meta=document.createElement('p'),actions=document.createElement('div');
        box.className='saved-cart-card';info.className='saved-cart-info';actions.className='saved-cart-actions';title.textContent=row.title;
        const count=Object.values(row.cart).reduce((n,item)=>n+(Number(item.qty)||0),0);
        meta.textContent=new Intl.DateTimeFormat((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'),{timeZone:'Asia/Yerevan',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.saved_at))+' · '+Object.keys(row.cart).length+' դիրք · '+count+' հատ';
        info.append(title,meta);box.append(info,actions);
        for(const [text,action] of [['Ավելացնել ընթացիկ զամբյուղին',async()=>{await ZZWS_PURCHASE_PLANS.preview(row.cart,row.title);}],['Բեռնել',async()=>{if(Object.keys(cart).length&&!confirm('Ընթացիկ զամբյուղը փոխարինե՞լ պահպանվածով։'))return;apply('cart',row.cart);apply('draft',row.draft);capture();await flush();renderModalItems();document.getElementById('savedCartsPanel').open=false;}],['Ջնջել',async()=>{if(!confirm('Ջնջե՞լ «'+row.title+'»?'))return;await ZZWS.json('me/carts/delete',{method:'POST',body:JSON.stringify({id:row.id})});await savedList();}]]){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=text==='Ջնջել'?'saved-delete':'saved-secondary';b.setAttribute('aria-label',text+' « զամբյուղը՝'+row.title+'»');b.onclick=()=>action().catch(e=>alert(e.message));actions.append(b);}root.append(box);}
    }catch(e){root.textContent=e.message;}
  }
  async function saveNamed(){
    const input=document.getElementById('savedCartTitle'),payload={title:input.value.trim(),cart:copy(cart),draft:read().draft,requestId:crypto.randomUUID()};
    try{let result;
      try{result=await ZZWS.json('me/carts',{method:'POST',body:JSON.stringify(payload)});}
      catch(e){if(e.status!==409||!e.data.limit)throw e;const oldest=e.data.oldest;
        if(!confirm('Արդեն պահպանված է 10 զամբյուղ։ Փոխարինե՞լ ամենահինը՝ «'+oldest.title+'», ամսաթիվ՝ '+new Date(oldest.saved_at).toLocaleString((window.ZZWS_I18N?.language==='ru'?'ru-RU':'hy-AM'))+'?'))return;
        result=await ZZWS.json('me/carts',{method:'POST',body:JSON.stringify({...payload,replace:oldest.id})});
      }
      input.value='';await savedList();alert(result.replaced?'Զամբյուղը պահպանվել է։ Ամենահին զամբյուղը փոխարինվել է։':'Զամբյուղը պահպանվել է սերվերում։');
    }catch(e){alert(e.data?.limit?'Զամբյուղների ցանկը փոխվել է այլ սարքում։ Թարմացրեք ցանկը և կրկնեք պահպանումը։':e.message);}
  }
  window.ZZWS_MEMORY={start,stop,capture,flush,prepareLeave,invalidateHistory,savedList,saveNamed,restoreDraft:()=>{if(ready)apply('draft',baseline.draft,false);}};
  window.addEventListener('zzws:account-cache-cleared',event=>{if(event.detail?.id===owner)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){capture();flush();}});
  window.addEventListener('pageshow',event=>{if(event.persisted&&ready&&owner===serverIdentity?.id)resetCatalogFiltersOnOpen();});
  window.addEventListener('focus',()=>{pollAt=0;flush();});
  window.addEventListener('beforeunload',e=>{capture();if(Object.keys(pending).length){e.preventDefault();e.returnValue='';}});
})();
