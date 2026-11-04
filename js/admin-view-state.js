/* Account-bound navigation snapshots. Open records are fetched again after reload. */
(() => {
 const storageKey='zzws_admin_page_v1';let owner=null,current=null,entries={},ready=false,restoring=false,initial=true,restoreCurrent=false,timer,epoch=0;
 const el=id=>document.getElementById(id);
 function persist(){if(owner)try{sessionStorage.setItem(storageKey,JSON.stringify({version:1,owner,path:location.pathname,entries}));}catch{}}
 function save(){
  if(!owner||!current||!ready||restoring||el('workspace').hidden)return;
  let context=current==='manager'?ZZWS_ADMIN_WORKBENCH.navigationState?.():current==='orders'?ZZWS_ADMIN_ORDERS.navigationState?.():current==='templates'?ZZWS_ADMIN_TEMPLATES.navigationState?.():current==='apkDownloads'?ZZWS_APK_DOWNLOADS.navigationState?.():null;
  if(current==='offers')context={selectedId:document.querySelector('.offer-history-row[data-selected="true"]')?.dataset.offerId,count:document.querySelectorAll('.offer-history-row').length};
  entries[current]={ui:ZZWS_VIEW_STATE.capture(el('workspace')),scrollY:scrollY,context,contextHelp:window.ZZWS_CONTEXT_HELP?.viewState?.(),proposalManagement:window.ZZWS_PROPOSAL_MANAGEMENT?.viewState?.(),userId:current==='users'&&!el('userForm').hidden?editingUserId:null};persist();
 }
 function start(user){++epoch;owner=user.id;ready=false;restoring=false;initial=true;restoreCurrent=false;current=null;entries={};try{const data=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(data?.version===1&&data.owner===owner&&data.path===location.pathname)entries=data.entries||{};else sessionStorage.removeItem(storageKey);}catch{}}
 function prepare(tab){current=tab;restoring=true;restoreCurrent=initial;initial=false;const state=restoreCurrent?entries[tab]:null;if(state)ZZWS_VIEW_STATE.controls(state.ui);}
 async function loaded(tab){
  if(!owner||current!==tab)return;const ticket=epoch,actor=owner,state=restoreCurrent?entries[tab]:null;
  try{if(state){
   if(tab==='catalogControls'){const target=el('catalogControlsTarget'),previous=target.value;ZZWS_VIEW_STATE.controls(state.ui);if(target.value!==previous)target.dispatchEvent(new Event('change',{bubbles:true}));}
   if(tab==='offers'&&state.context){while(document.querySelectorAll('.offer-history-row').length<Math.min(10000,Number(state.context.count)||0)&&!el('offerMore').hidden){const count=document.querySelectorAll('.offer-history-row').length;await ZZWS_OFFERS.load(true);if(ticket!==epoch||actor!==owner||current!==tab)return;if(document.querySelectorAll('.offer-history-row').length<=count)break;}const row=[...document.querySelectorAll('.offer-history-row')].find(node=>node.dataset.offerId===state.context.selectedId),button=row?.querySelector('button');if(ticket!==epoch||actor!==owner||current!==tab)return;if(button&&!button.disabled)button.click();}
   if(ticket!==epoch||actor!==owner||current!==tab)return;
   if(tab==='users'&&state.userId){const user=users.find(u=>u.id===state.userId);if(user)await editUser(user);}
   if(ticket!==epoch||actor!==owner||current!==tab)return;
   const module=tab==='manager'?window.ZZWS_ADMIN_WORKBENCH:tab==='orders'?window.ZZWS_ADMIN_ORDERS:tab==='templates'?window.ZZWS_ADMIN_TEMPLATES:tab==='apkDownloads'?window.ZZWS_APK_DOWNLOADS:null;
   if(state.context)await module?.restoreView?.(state.context);
   if(ticket!==epoch||actor!==owner||current!==tab)return;
   await window.ZZWS_PROPOSAL_MANAGEMENT?.restoreView?.(state.proposalManagement);if(ticket!==epoch||actor!==owner||current!==tab)return;
   await window.ZZWS_CONTEXT_HELP?.restoreView?.(state.contextHelp);if(ticket!==epoch||actor!==owner||current!==tab)return;await ZZWS_VIEW_STATE.restore(state.ui,{withControls:false});if(ticket!==epoch||actor!==owner||current!==tab)return;window.scrollTo({top:Math.max(0,Number(state.scrollY)||0),behavior:'instant'});
  }}finally{if(ticket===epoch&&actor===owner&&current===tab){restoring=false;ready=true;save();}}
 }
 function stop(){++epoch;clearTimeout(timer);owner=null;current=null;entries={};ready=false;restoring=false;try{sessionStorage.removeItem(storageKey);}catch{}}
 for(const event of ['input','change','click','toggle'])document.addEventListener(event,()=>{clearTimeout(timer);timer=setTimeout(save,80);},true);
 document.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(save,80);},{capture:true,passive:true});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
 window.ZZWS_ADMIN_VIEW_STATE={get ready(){return ready&&!restoring;},get current(){return current;},start,prepare,loaded,save,stop,invalidateOrders(){delete entries.orders;delete entries.manager;persist();}};
})();
