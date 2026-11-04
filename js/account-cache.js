/* Account-scoped business caches are temporary copies of authenticated state.
   Keep journals across reload; leaving an account saves or explicitly discards. */
(() => {
 'use strict';
 if(window.top!==window.self)return;
 const marker='zzws_cache_owner_v1',logoutPrefix='zzws_account_logout_';
 const owner=()=>{try{return sessionStorage.getItem(marker)||null;}catch{return null;}};
 const pending=id=>{try{const value=JSON.parse(localStorage.getItem('zzws_pending_'+id)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function record(id){if(typeof id==='string'&&id)try{sessionStorage.setItem(marker,id);}catch{}}
 function clear(id=owner(),broadcast=true){
  if(!id)return;
  for(const key of ['zigzag_history_'+id,'zigzag_cart_'+id,'zzws_pending_'+id])try{localStorage.removeItem(key);}catch{}
  for(const key of ['zigzag_client','zigzag_sheet','zigzag_client_rows'])try{localStorage.removeItem(key);}catch{}
  if(owner()===id)try{sessionStorage.removeItem(marker);}catch{}
  window.dispatchEvent(new CustomEvent('zzws:account-cache-cleared',{detail:{id}}));
  if(typeof lockCatalog==='function')lockCatalog();else if(typeof showLogin==='function')showLogin();
  if(broadcast)try{localStorage.setItem(logoutPrefix+id,String(Date.now())+':'+Math.random());localStorage.removeItem(logoutPrefix+id);}catch{}
 }
 function discard(){return window.confirm(window.ZZWS_I18N?.language==='ru'?'Не удалось сохранить изменения. Выйти без сохранения?':'Չհաջողվեց պահպանել փոփոխությունները։ Դո՞ւրս գալ առանց պահպանելու։');}
 async function storedJournalSaved(id){
  const token=sessionStorage.getItem('zzws_session_v3'),journal=pending(id);
  for(const section of ['cart','favorites','history','preferences','draft']){
   const item=journal[section];if(!item)continue;
   try{
    const result=await ZZWS.json('me/state',{method:'POST',timeoutMs:15000,body:JSON.stringify({section,value:item.value,version:item.version})});
    if(owner()!==id||sessionStorage.getItem('zzws_session_v3')!==token)return false;
    const current=pending(id);if(same(current[section],item))delete current[section];else if(current[section])current[section].version=result.version;
    if(Object.keys(current).length)localStorage.setItem('zzws_pending_'+id,JSON.stringify(current));else localStorage.removeItem('zzws_pending_'+id);
   }catch{return false;}
  }
  return !Object.keys(pending(id)).length;
 }
 async function prepareLeave(){
  if(window.ZZWS_MEMORY?.prepareLeave)return ZZWS_MEMORY.prepareLeave();
  const id=owner();if(!id||!Object.keys(pending(id)).length)return true;
  return await storedJournalSaved(id)||discard();
 }
 async function beforeSession(nextId){
  const previous=owner();if(!previous||!nextId||previous===nextId)return;
  if(!await prepareLeave())throw Object.assign(Error(window.ZZWS_I18N?.language==='ru'?'Изменения не сохранены. Вход в другой аккаунт отменён.':'Փոփոխությունները չեն պահպանվել։ Այլ հաշիվ մուտքը չեղարկված է։'),{accountChangeCancelled:true});
  if(owner()!==previous)throw Object.assign(Error('Աշխատաշրջանը փոխվել է։ Կրկին փորձեք։'),{staleSession:true});
  clear(previous);return {token:sessionStorage.getItem('zzws_session_v3')};
 }
 async function exit(){try{await ZZWS.json('logout',{method:'POST'});}catch(error){if(error.logoutCancelled)return;}if(typeof lockCatalog==='function')lockCatalog();else if(typeof showLogin==='function')showLogin();}
 window.addEventListener('storage',event=>{if(event.key?.startsWith(logoutPrefix)&&event.newValue&&owner()===event.key.slice(logoutPrefix.length)){const id=owner();clear(id,false);sessionStorage.removeItem('zzws_session_v3');if(typeof lockCatalog==='function')lockCatalog();else if(typeof showLogin==='function')showLogin();}});
 window.ZZWS_ACCOUNT_CACHE=Object.freeze({owner,record,clear,prepareLeave,beforeSession,exit});
})();
