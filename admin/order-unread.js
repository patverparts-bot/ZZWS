(() => {
 const acknowledged=new Map(),bindings=new WeakMap();let generation=0;
 const revision=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 function unread(order){
  const current=revision(order.revision),server=revision(order.adminReadRevision);
  if(current===null||current<1)return false;
  if(server!==null)return Math.max(server,acknowledged.get(order.id)||0)<current;
  return order.unread===true&&(acknowledged.get(order.id)||0)<current;
 }
 function paint(element,order,host){
  const active=unread(order);element.classList.toggle('admin-order-unread',active);element.dataset.orderUnread=String(active);
  let label=element.querySelector('.admin-order-unread-label');
  if(active&&!label){label=document.createElement('span');label.className='admin-order-unread-label';label.dataset.i18nSkip='true';host.append(label);}
  if(active)label.textContent=window.ZZWS_I18N?.language==='ru'?'Не просмотрен':'Չդիտված';
  if(!active)label?.remove();
 }
 function apply(element,order,host=element){
  const snapshot={id:order.id,revision:order.revision,adminReadRevision:order.adminReadRevision,unread:order.unread};
  element.dataset.adminOrderRead=order.id;bindings.set(element,{order:snapshot,host});paint(element,snapshot,host);
 }
 async function acknowledge(order){
  const ticket=generation,id=order.id,current=order.revision;
  await ZZWS.json('admin/orders/read',{method:'POST',body:JSON.stringify({id,revision:current})});
  if(ticket!==generation)return false;
  acknowledged.set(id,Math.max(acknowledged.get(id)||0,current));
  for(const element of document.querySelectorAll('[data-admin-order-read]')){
   const binding=bindings.get(element);if(binding?.order.id===id)paint(element,binding.order,binding.host);
  }
  return true;
 }
 window.ZZWS_ADMIN_ORDER_UNREAD={apply,acknowledge,reset(){++generation;acknowledged.clear();}};
 window.addEventListener('zzws:languagechange',()=>{for(const element of document.querySelectorAll('[data-admin-order-read]')){const binding=bindings.get(element);if(binding)paint(element,binding.order,binding.host);}});
})();
