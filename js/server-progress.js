/* Request progress only. Never inspects/stores bodies, credentials or request URLs. */
(() => {
 'use strict';
 if(window.ZZWS_SERVER_PROGRESS)return;
 const nativeFetch=window.fetch.bind(window),active=new Map(),locks=new WeakMap();let serial=0,action=null,host=null;
 const copy={hy:{processing:'Սերվերը մշակում է հարցումը…',upload:'Ֆայլը փոխանցվում է…',transferred:'Ֆայլը փոխանցված է։ Սերվերը մշակում է հարցումը…',requests:'Ընթացիկ հարցումներ՝'},ru:{processing:'Сервер обрабатывает запрос…',upload:'Файл передаётся…',transferred:'Файл передан. Сервер обрабатывает запрос…',requests:'Текущих запросов:'}};
 const labels=()=>copy[window.ZZWS_I18N?.language==='ru'?'ru':'hy'];
 const mutating=method=>!['GET','HEAD','OPTIONS'].includes(String(method||'GET').toUpperCase());
 function capture(event){const button=event.submitter||event.target?.closest?.('button,input[type=submit],input[type=button]')||(event.type==='submit'?event.target?.querySelector('button:not([type]),button[type=submit],input[type=submit]'):null);if(button){if(locks.has(button)){event.preventDefault();event.stopImmediatePropagation();return;}const current=action={button};setTimeout(()=>{if(action===current)action=null;},0);}}
 document.addEventListener('click',capture,true);document.addEventListener('submit',capture,true);
 function target(explicit){if(explicit instanceof Element)return explicit;if(action?.button.isConnected)return action.button;return null;}
 function lock(button){if(!button)return;let state=locks.get(button);if(!state){state={count:0,disabled:button.disabled,busy:button.getAttribute('aria-busy')};locks.set(button,state);}state.count++;button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.serverBusy='true';}
 function unlock(button){const state=button&&locks.get(button);if(!state)return;if(--state.count)return;locks.delete(button);button.disabled=state.disabled;if(state.busy===null)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy',state.busy);delete button.dataset.serverBusy;}
 function container(){const last=[...active.values()].slice(-1)[0],dialog=last?.button?.closest('dialog[open]');if(dialog?.isConnected)return dialog;const open=[...document.querySelectorAll('dialog[open]')];return open.slice(-1)[0]||document.body;}
 function render(){if(!active.size){host?.remove();host=null;return;}if(!document.body)return;const parent=container();if(!host){host=document.createElement('aside');host.id='zzwsServerProgress';host.dataset.i18nSkip='true';host.setAttribute('role','status');host.setAttribute('aria-live','polite');host.innerHTML='<span class="server-progress-caption"></span><progress></progress><small></small>';}
  host.className=parent.tagName==='DIALOG'?'zzws-server-progress in-dialog':'zzws-server-progress';if(host.parentNode!==parent)parent.prepend(host);
  const text=labels(),uploads=[...active.values()].filter(v=>v.loaded!=null&&v.total>0&&v.loaded<v.total),transferred=[...active.values()].some(v=>v.total>0&&v.loaded>=v.total),bar=host.querySelector('progress'),caption=host.querySelector('span');
  if(uploads.length===1){const item=uploads[0];bar.max=item.total;bar.value=item.loaded;caption.textContent=text.upload+' '+Math.floor(item.loaded/item.total*100)+'%';bar.setAttribute('aria-label',text.upload);}else{bar.removeAttribute('value');bar.removeAttribute('max');caption.textContent=transferred?text.transferred:text.processing;bar.setAttribute('aria-label',text.processing);}
  host.querySelector('small').textContent=active.size>1?text.requests+' '+active.size:'';
 }
 function begin(options={}){const button=target(options.target);if(!mutating(options.method)&&!button)return null;const origin=action,id=++serial,item={button,loaded:null,total:0};active.set(id,item);lock(button);render();let finished=false;
  return Object.freeze({finish(){if(finished)return;finished=true;active.delete(id);unlock(button);if(action===origin)action=null;render();},transfer({loaded,total}){if(finished)return;if(Number.isFinite(loaded)&&loaded>=0&&Number.isFinite(total)&&total>0){item.loaded=Math.min(loaded,total);item.total=total;}else{item.loaded=null;item.total=0;}render();}});
 }
 function response(response,ticket){if(!ticket)return response;let reading=false;for(const name of ['json','text','blob','arrayBuffer','formData']){const original=response[name]?.bind(response);if(!original)continue;try{response[name]=(...args)=>{reading=true;return Promise.resolve().then(()=>original(...args)).finally(()=>ticket.finish());};}catch{}}
  // Unconsumed responses still finish; callers normally begin body reading in
  // their await continuation before this next task. No duplicate body is read.
  setTimeout(()=>{if(!reading)ticket.finish();},0);return response;
 }
 async function fetchWithProgress(input,options){const ticket=begin({method:options?.method||input?.method||'GET'});try{return response(await nativeFetch(input,options),ticket);}catch(error){ticket?.finish();throw error;}}
 window.fetch=fetchWithProgress;
 window.ZZWS_SERVER_PROGRESS=Object.freeze({begin,response,reset(){for(const item of active.values())unlock(item.button);active.clear();action=null;render();},state:()=>({pending:active.size,measuredUploads:[...active.values()].filter(v=>v.total>0).length})});
 window.addEventListener('zzws:languagechange',render);window.addEventListener('pagehide',()=>window.ZZWS_SERVER_PROGRESS.reset());
})();
