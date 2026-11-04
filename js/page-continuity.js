/* Parser-blocking privacy gate. Navigation data never grants account access. */
(() => {
 'use strict';
 const key='zzws_buyer_view_v1',root=document.documentElement;
 let pending=null;
 function read(){try{const value=JSON.parse(sessionStorage.getItem(key)||'null');return value?.v===1&&typeof value.actorId==='string'&&typeof value.offerId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.offerId)?value:null;}catch{return null;}}
 function releaseBuyerGate(){root.classList.remove('zzws-buyer-restoring');}
 function clearBuyerResume(){try{sessionStorage.removeItem(key);}catch{}pending=null;releaseBuyerGate();}
 function buyerPending(user){const value=read();return !!value&&(!user||value.actorId===user.id);}
 function acceptIdentity(user){const value=read();if(value&&value.actorId!==user?.id)clearBuyerResume();else pending=value;}
 try{
  const base=new URL('../',document.currentScript.src).pathname;
  const onSite=location.pathname===base||location.pathname===base+'index.html';
  if(onSite&&sessionStorage.getItem('zzws_session_v3')&&(pending=read()))root.classList.add('zzws-buyer-restoring');
 }catch{}
 window.ZZWS_PAGE_CONTINUITY=Object.freeze({buyerPending,acceptIdentity,releaseBuyerGate,clearBuyerResume});
})();
