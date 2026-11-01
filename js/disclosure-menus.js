/* Only popover menus close outside; content disclosures and working dialogs stay open. */
(() => {
 'use strict';
 const menus='details[data-disclosure-menu],#storefrontAccount,#storefrontTools,#adminMoreMenu,.catalog-columns,.dealer-advanced-tools';
 const pickers=[['brandDropdown','brandInput','clearBrandBtn'],['categoryDropdown','categoryInput','clearCategoryBtn']];
 const within=(event,node)=>node&&(event.composedPath?.().includes(node)||node.contains(event.target));
 document.addEventListener('pointerdown',event=>{
  for(const menu of document.querySelectorAll(menus))if(menu.open&&!within(event,menu))menu.open=false;
  for(const ids of pickers)if(!ids.some(id=>within(event,document.getElementById(id))))document.getElementById(ids[0])?.classList.add('hidden');
 },true);
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  for(const ids of pickers){const input=document.getElementById(ids[1]),panel=document.getElementById(ids[0]);if(panel&&!panel.classList.contains('hidden')&&ids.some(id=>within(event,document.getElementById(id)))){panel.classList.add('hidden');input?.focus({preventScroll:true});event.preventDefault();event.stopPropagation();return;}}
  const active=event.target.closest?.(menus);if(active?.open){active.open=false;active.querySelector(':scope > summary')?.focus({preventScroll:true});event.preventDefault();event.stopPropagation();}
 },true);
})();
