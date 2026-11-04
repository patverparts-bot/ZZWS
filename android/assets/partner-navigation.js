/* Native Back belongs to this tool's sections, never to its sign-in bootstrap. */
(()=>{
 if(window.ZZWS_PARTNER_NAV)return;
 const tabs=[];
 let restoring=null;
 function current(){
  const workspace=document.getElementById('workspace');
  if(!workspace||workspace.hidden)return null;
  const selected=document.querySelector('[data-tab].admin-tab-active,[data-tab][aria-current="page"]');
  if(selected?.dataset.tab&&!document.getElementById(selected.dataset.tab)?.hidden)return selected.dataset.tab;
  // Older published admin pages also identify sections by their visible panels.
  const visible=[...document.querySelectorAll('[data-tab]')].map(button=>button.dataset.tab).find(tab=>{const panel=document.getElementById(tab);return panel&&!panel.hidden;});
  return visible||new URLSearchParams(location.hash.slice(1)).get('tab');
 }
 function capture(){
  const tab=current();if(!tab)return;
  if(restoring){if(tab===restoring)restoring=null;return;}
  if(tabs[tabs.length-1]!==tab)tabs.push(tab);
 }
 function back(){
  // A cancelled dialog must stay open if its own handler blocks dismissal.
  const dialogs=[...document.querySelectorAll('dialog[open]')];
  if(dialogs.length){const dialog=dialogs[dialogs.length-1];if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();return 'handled';}
  const menu=document.getElementById('adminMoreMenu');
  if(menu?.open){menu.open=false;return 'handled';}
  capture();
  if(current()){
   if(restoring)return 'handled';
   if(tabs.length<=1)return 'root';
   if(typeof window.selectAdminTab!=='function')return 'blocked';
   tabs.pop();restoring=tabs[tabs.length-1];
   try{
    const result=window.selectAdminTab(restoring,{history:'restore'});
    capture();
    Promise.resolve(result).catch(()=>{restoring=null;});
    return 'handled';
   }catch(error){restoring=null;return 'blocked';}
  }
  return /^(?:\/ZZWS)?\/admin(?:\/|$)/.test(location.pathname)?'root':'browser';
 }
 window.ZZWS_PARTNER_NAV={back};
 new MutationObserver(capture).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','aria-current','hidden']});
 addEventListener('hashchange',capture);addEventListener('popstate',capture);capture();
})();
