(() => {
  if(window.top!==window.self)return;
  const config=window.ZZWS_CONFIG;
  const key='zzws_session_v3';
  const responseSessions=new WeakMap(),responseGenerations=new WeakMap();
  let generationScope=null,generationToken=null,ordersGeneration=null,workspaceGeneration=null,seenWithoutGeneration=false;
  function staleOrders(){const error=new Error('Պատվերների տվյալները թարմացվել են։ Կրկին բացեք պատվերը։');error.status=409;error.staleOrders=true;return error;}
  function rememberGeneration(response,token,scope){
    if(generationToken!==token||generationScope!==scope){generationToken=token;generationScope=scope;ordersGeneration=workspaceGeneration=null;seenWithoutGeneration=false;}
    const value=name=>{const raw=response.headers.get(name);if(!/^[1-9][0-9]*$/.test(raw||''))return null;const n=Number(raw);return Number.isSafeInteger(n)?n:null;},orders=value('X-ZZWS-Orders-Generation'),workspace=value('X-ZZWS-Workspace-Generation');
    if(orders===null&&workspace===null){seenWithoutGeneration=true;return;}
    if(orders!==null&&ordersGeneration!==null&&orders<ordersGeneration||workspace!==null&&workspaceGeneration!==null&&workspace<workspaceGeneration)throw staleOrders();
    const initial=ordersGeneration===null,changed=orders!==null&&ordersGeneration!==null&&orders>ordersGeneration,legacyOrders=initial&&seenWithoutGeneration&&orders>1,workspaceChanged=workspace!==null&&workspaceGeneration!==null&&workspace>workspaceGeneration;
    if(orders!==null)ordersGeneration=orders;if(workspace!==null)workspaceGeneration=workspace;
    responseGenerations.set(response,{orders,workspace,token,scope});
    const assertCurrent=()=>{const saved=responseGenerations.get(response);if(saved&&sessionStorage.getItem(key)!==saved.token)throw staleSession();if(saved&&saved.token===generationToken&&saved.scope===generationScope&&(saved.orders!==null&&saved.orders<ordersGeneration||saved.workspace!==null&&saved.workspace<workspaceGeneration))throw staleOrders();};
    for(const name of ['json','text','blob','arrayBuffer','formData']){const read=response[name]?.bind(response);if(read)response[name]=async(...args)=>{assertCurrent();const value=await read(...args);assertCurrent();return value;};}
    if(changed||legacyOrders)window.dispatchEvent(new CustomEvent('zzws:orders-generation',{detail:{generation:orders,initial:legacyOrders}}));
    if(workspaceChanged)window.dispatchEvent(new CustomEvent('zzws:workspace-generation',{detail:{generation:workspace}}));
  }
  function upload(url,headers,options){return new Promise((resolve,reject)=>{
    const progress=window.ZZWS_SERVER_PROGRESS?.begin({method:options.method||'POST',target:options.progressTarget});
    const xhr=new XMLHttpRequest();xhr.open(options.method||'POST',url);xhr.timeout=options.timeoutMs||120000;
    headers.forEach((value,name)=>xhr.setRequestHeader(name,value));
    xhr.upload.onprogress=event=>{const value={loaded:event.loaded,total:event.lengthComputable?event.total:0};progress?.transfer(value);options.onUploadProgress(value);};
    xhr.onload=()=>{if(!xhr.status){progress?.finish();reject(new Error('Չհաջողվեց կապվել սերվերի հետ։'));return;}const response=new Response(xhr.responseText,{status:xhr.status,headers:{'Content-Type':'application/json',...Object.fromEntries(['X-ZZWS-Orders-Generation','X-ZZWS-Workspace-Generation'].map(name=>[name,xhr.getResponseHeader(name)]).filter(([,value])=>value))}});resolve(window.ZZWS_SERVER_PROGRESS?.response(response,progress)||response);};
    const failed=message=>{progress?.finish();reject(Object.assign(new Error(message),{uploadUncertain:true}));};
    xhr.onerror=()=>failed('Կապն ընդհատվել է։ Ստուգվում է հրապարակման արդյունքը։');
    xhr.ontimeout=()=>failed('Սպասման ժամանակն ավարտվել է։ Ստուգվում է հրապարակման արդյունքը։');
    xhr.onabort=()=>failed('Բեռնումն ընդհատվել է։');
    try{xhr.send(options.body);}catch(error){progress?.finish();reject(error);}
  });}
  function staleSession(){const error=new Error('Հարցումն ավարտվել է նախկին աշխատաշրջանում։ Կրկին փորձեք։');error.status=409;error.staleSession=true;return error;}
  // A token is kept for this tab only. It contains no role or customer information.
  // The server rechecks status and permissions on every request.
  async function request(path,options={}){
    const headers=new Headers(options.headers||{});
    headers.set('apikey',config.publishableKey);
    const token=sessionStorage.getItem(key);if(token)headers.set('Authorization','Bearer '+token);
    if(options.body&&!(options.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    let response;try{const url=new URL(path,config.api);response=options.onUploadProgress?await upload(url,headers,options):await fetch(url,{...options,signal:options.timeoutMs?AbortSignal.timeout(options.timeoutMs):options.signal,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});}catch(error){if(sessionStorage.getItem(key)!==token)throw staleSession();if(error.uploadUncertain)throw error;throw new Error('Չհաջողվեց կապվել սերվերի հետ։ Ստուգեք ինտերնետային կապը և կրկին փորձեք։');}
    if(sessionStorage.getItem(key)!==token)throw staleSession();
    if(response.status===401){sessionStorage.removeItem(key);window.ZZWS_SERVER_PROGRESS?.reset();}
    if(response.status!==401)rememberGeneration(response,token,new URL(config.api).origin+new URL(config.api).pathname);
    responseSessions.set(response,sessionStorage.getItem(key));
    return response;
  }
  async function json(path,options={},retried=false){
    if(path==='logout'&&!retried){
      if(window.ZZWS_ACCOUNT_CACHE&&!await ZZWS_ACCOUNT_CACHE.prepareLeave())throw Object.assign(Error('Ելքը չեղարկված է։ Փոփոխությունները պահպանված չեն։'),{logoutCancelled:true});
      const token=sessionStorage.getItem(key),owner=window.ZZWS_ACCOUNT_CACHE?.owner();
      try{return await json(path,options,true);}finally{
        if(sessionStorage.getItem(key)===token||sessionStorage.getItem(key)===null){window.ZZWS_ACCOUNT_CACHE?.clear(owner);sessionStorage.removeItem(key);window.ZZWS_SERVER_PROGRESS?.reset();}
      }
    }
    const response=await request(path,options);let data;try{data=await response.json();}catch(error){if(error.staleOrders||error.staleSession)throw error;throw new Error('Սերվերը վերադարձրել է սխալ պատասխան։');}
    if(sessionStorage.getItem(key)!==responseSessions.get(response))throw staleSession();
    if(response.status===428&&data.reauthRequired&&!retried&&window.requireReauthentication){await window.requireReauthentication();return json(path,options,true);}
    if(!response.ok){const missing=response.status===404&&data.error==='Չի գտնվել'&&/^(admin\/orders\/(customers|customer-|create|report-)|admin\/users\/channels|admin\/email-settings|admin\/offers|orders\/quote|catalog\/contract)/.test(path);const error=new Error(missing?'Այս հնարավորությունը դեռ հասանելի չէ գործող սերվերում։ Անհրաժեշտ է ZZWS սերվերի համաձայնեցված թարմացում։':data.error||'Հարցման սխալ');error.status=response.status;error.data=data;throw error;}
    if(['login','login/mfa','account/password','invitation/open'].includes(path)&&data.sessionToken){const transition=await window.ZZWS_ACCOUNT_CACHE?.beforeSession(data.id);if(sessionStorage.getItem(key)!==(transition?transition.token:responseSessions.get(response)))throw staleSession();window.ZZWS_SERVER_PROGRESS?.reset();sessionStorage.setItem(key,data.sessionToken);window.ZZWS_ACCOUNT_CACHE?.record(data.id);delete data.sessionToken;}
    if(path==='me')window.ZZWS_ACCOUNT_CACHE?.record(data.id);
    if(path==='logout'){sessionStorage.removeItem(key);window.ZZWS_SERVER_PROGRESS?.reset();}
    return data;
  }
  window.ZZWS=Object.freeze({request,json,generations:()=>generationToken===sessionStorage.getItem(key)?{orders:ordersGeneration,workspace:workspaceGeneration}:{orders:null,workspace:null},message:error=>typeof error?.message==='string'&&/[\u0531-\u058f]/u.test(error.message)?error.message:'Գործողությունը չի կատարվել։ Կրկին փորձեք։',clearSession:()=>{sessionStorage.removeItem(key);window.ZZWS_SERVER_PROGRESS?.reset();}});
})();
