/* Presentation metadata only: action handlers, validation and access remain in their modules. */
(() => {
 'use strict';
 const tones=new Set(['primary','secondary','warning','danger']),byId=new Map();
 const ids={
  primary:['publish','importUsers','newUser','templateNew','templateSave','warehouseSave','manualOrderSave','applyConfirmation','saveAdminScope','saveAdminChannels','saveAdminPolling','offerSave','storefrontSave','saveReportEmailSettings','activateMfa','stockPickerToCart'],
  secondary:['cancelUser','templateCancel','closeAdminOrder','cancelConfirmation','previewUserAccess','previewGroupRules','reloadGroupRules','previewFinalFile','previewFinalPaste','viewOrderExport','exportServerOrder','warehouseReload','warehouseAdd','managerRefresh','managerMore','templateRefresh','catalogControlsReload','operationsRefresh','refreshAdminOrders','moreAdminOrders','userTemplate','downloadFinalTemplate','downloadPriceReport','storageRefresh','refreshAudit','adminBackSection','logout','offerNew','offerMore'],
  warning:['archiveClient','resetUserPassword','issueInvitation','reportDefaultsToggle'],
  danger:['deleteClient','offerDelete']
 };
 for(const [tone,values]of Object.entries(ids))for(const id of values)byId.set(id,tone);
 const primaryForms=new Set(['loginForm','setupForm','userForm','templateSaveForm','groupRulesForm','catalogControlsForm','warehouseForm','storefrontSettingsForm','popularityRulesForm','popularityEditForm']);
 const excluded='.admin-menu-category,[data-overview-order],[data-tab],.dashboard-metric,.column-sort-button,[data-sort-column],.orders-view-switch button,[data-language-switcher] button,[data-language],.calendar-grid button,.calendar-weekdays button';
 function decorate(button){
  if(button.matches(excluded)){if(button.hasAttribute('data-action-tone'))button.removeAttribute('data-action-tone');return;}
  let tone;
  if(button.id==='confirmClientDeletion')tone=({delete:'danger',archive:'warning',restore:'primary'})[button.closest('[data-mode]')?.dataset.mode]||'danger';
  else if(byId.has(button.id))tone=byId.get(button.id);
  else if(button.type==='submit'&&primaryForms.has(button.form?.getAttribute('id')))tone='primary';
  else if(tones.has(button.dataset.actionTone))tone=button.dataset.actionTone;
  else if(button.matches('.storage-danger,.storage-clear,.cleanup-danger,[data-archive-delete]'))tone='danger';
  else if(button.matches('.cleanup-primary'))tone='primary';
  else tone='secondary';
  if(button.dataset.actionTone!==tone)button.dataset.actionTone=tone;
 }
 function refresh(root=document.body){if(root?.nodeType===Node.TEXT_NODE)root=root.parentElement;if(!root?.querySelectorAll)return;if(root.matches?.('button'))decorate(root);for(const button of root.querySelectorAll('button'))decorate(button);}
 const pending=new Set();let scheduled=false;
 function schedule(root){if(root)pending.add(root);if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;for(const target of pending)if(target.isConnected)refresh(target);pending.clear();});}
 new MutationObserver(changes=>{for(const change of changes){if(change.type==='attributes')schedule(change.target);else{if(change.target.closest?.('button'))schedule(change.target.closest('button'));for(const added of change.addedNodes)if(added.nodeType===Node.ELEMENT_NODE)schedule(added);}}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['id','type','class','data-mode','data-action-tone']});
 window.ZZWS_ADMIN_ACTIONS=Object.freeze({refresh});refresh();
})();
