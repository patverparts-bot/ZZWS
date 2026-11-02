/* Invalidate order views only after an authoritative server generation change. */
(() => {
 'use strict';
 function cached(){return !!document.querySelector('[data-order-id],[data-admin-order-read],[data-manager-order],#orderViewDialog,#receiptConfirmationDialog,#approvalReminderDialog');}
 function safely(fn){try{Promise.resolve(fn?.()).catch(()=>{});}catch{}}
 function invalidate(detail={}){
  if(detail.initial&&(Number(detail.generation)<=1||!cached()))return;
  const user=window.ZZWS_HELP_USER;if(!user)return;
  safely(()=>window.ZZWS_MEMORY?.invalidateHistory?.());
  const cabinet=document.getElementById('cabinetModal'),cabinetOpen=cabinet&&!cabinet.classList.contains('hidden');
  document.getElementById('receiptConfirmationDialog')?.remove();
  if(user.role==='client'&&window.ZZWS_ORDERS){window.ZZWS_ORDERS.start(user);if(cabinetOpen){if(typeof window.openPersonalCabinet==='function')window.openPersonalCabinet();else safely(()=>window.ZZWS_ORDERS.load());}window.ZZWS_PAGE_STATE?.save();}
  if(user.role==='admin'){
   safely(()=>window.ZZWS_CATALOG_VIEW?.revalidate?.());safely(()=>window.ZZWS_ASSISTED?.revalidate?.());
   window.ZZWS_ADMIN_ORDERS?.reset();window.ZZWS_ADMIN_WORKBENCH?.reset();window.ZZWS_ADMIN_VIEW_STATE?.invalidateOrders?.();
   if(user.permissions?.includes('orders:read')){window.ZZWS_ADMIN_RECEIPTS?.start(user);window.ZZWS_ADMIN_ORDERS?.start(user);window.ZZWS_ADMIN_WORKBENCH?.start();if(document.getElementById('manager')?.hidden===false){window.ZZWS_ADMIN_WORKBENCH?.mount('manager');safely(()=>window.ZZWS_ADMIN_WORKBENCH.load());}else if(document.getElementById('orders')?.hidden===false)safely(()=>window.ZZWS_ADMIN_ORDERS.load());}
   window.ZZWS_ADMIN_APPROVAL_REMINDERS?.start(user);window.ZZWS_REOPEN_ALERTS?.start(user);if(document.getElementById('dashboard')?.hidden===false)safely(()=>window.ZZWS_ADMIN_HOME?.load());
  }
 }
 window.addEventListener('zzws:orders-generation',event=>invalidate(event.detail));
 window.addEventListener('zzws:workspace-generation',()=>{const user=window.ZZWS_HELP_USER;if(!user)return;window.ZZWS_MEMORY?.stop();try{localStorage.removeItem('zzws_pending_'+user.id);sessionStorage.removeItem('zzws_order_request_'+user.id);for(const key of Object.keys(sessionStorage))if(key.startsWith('zzws_assisted_request_'+user.id+'_'))sessionStorage.removeItem(key);}catch{}window.ZZWS_PAGE_STATE?.stop();window.ZZWS_ADMIN_VIEW_STATE?.stop();location.reload();});
 window.ZZWS_ORDER_GENERATION=Object.freeze({invalidate});
})();
