/* Move existing settings without cloning controls or changing their permissions. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id),workspace=el('workspace'),labels=[];
 let navigationEpoch=0;
 const node=(tag,hy,ru)=>{const element=document.createElement(tag);if(hy){element.dataset.i18nSkip='true';labels.push({element,hy,ru});}return element;};
 function section(id,hy,ru){const root=node('section');root.id=id;root.hidden=true;root.className='workspace-settings';root.append(node('h1',hy,ru));workspace.append(root);return root;}
 function navGroup(id,hy,ru){const group=node('section');group.className='admin-nav-group';const heading=node('h3',hy,ru);heading.id=id;group.setAttribute('aria-labelledby',id);group.append(heading);el('adminMoreMenu').querySelector('.admin-more-items').append(group);return group;}
 function tab(id,hy,ru,group){const button=node('button',hy,ru);button.type='button';button.dataset.tab=id;group.append(button);return button;}
 const settings=section('orderSettings','Պատվերների կարգավորումներ','Настройки заказов');
 const account=section('accountSettings','Իմ հաշիվը','Мой аккаунт');
 const mobile=section('mobileApp','Բջջային Հավելված · հրապարակում','Мобильное приложение · публикация');
 const settingsNav=navGroup('admin-nav-settings','Կարգավորումներ','Настройки');
 tab('orderSettings','Պատվերների ստացում','Получение заказов',settingsNav);
 const email=document.querySelector('[data-tab="email"]');if(email)settingsNav.append(email);
 const accountNav=navGroup('admin-nav-account','Իմ հաշիվը','Мой аккаунт');
 tab('accountSettings','Անվտանգություն և միացումներ','Безопасность и подключения',accountNav);
 const systemNav=document.querySelector('[aria-labelledby="admin-nav-system"]');
 tab('mobileApp','Հավելվածի հրապարակում','Публикация приложения',systemNav);
 const overview=document.querySelector('[data-tab="dashboard"]');if(overview){overview.dataset.i18nSkip='true';labels.push({element:overview,hy:'Ամփոփում',ru:'Обзор'});document.querySelector('.admin-primary-navigation').prepend(overview);}
 const receipt=el('receiptGlobalPanel');if(receipt)settings.append(receipt);
 const security=el('dashboardProtection')?.closest('fieldset');if(security)account.append(security);
 const resources=el('adminResourcesPanel');if(resources)account.append(resources);
 const backup=el('backupHelp');if(backup)el('operations').append(backup);
 if(el('dashboardPrice'))el('dashboardPrice').hidden=true;
 const mobileNote=node('p','Ներբեռնումը և Telegram-ի անձնական միացման հրահանգները հասանելի են «Իմ հաշիվը» բաժնում։','Скачивание приложения и личные инструкции подключения Telegram доступны в разделе «Мой аккаунт».');mobileNote.className='help';mobile.append(mobileNote);
 function translate(){const ru=window.ZZWS_I18N?.language==='ru';for(const {element,hy,ru:translation}of labels)element.textContent=ru?translation:hy;}
 window.addEventListener('zzws:languagechange',translate);translate();
 window.ZZWS_WORKSPACE_LAYOUT=Object.freeze({
  start(user){
   ++navigationEpoch;
   const upload=el('apkUploadPanel');if(upload)mobile.prepend(upload);
   document.documentElement.dataset.ownerOverview=String(user.adminScope==='owner');
   for(const group of document.querySelectorAll('.admin-nav-group'))group.hidden=![...group.querySelectorAll('[data-tab]')].some(button=>!button.hidden);
  },
  reset(){++navigationEpoch;delete document.documentElement.dataset.ownerOverview;}
 });
 window.ZZWS_OVERVIEW_NAV=Object.freeze({
  async openOrders({filter,view='orders'}={}){
   ++navigationEpoch;
   window.ZZWS_ADMIN_VIEW_STATE?.invalidateOrders();
   for(const id of ['orderSearch','orderDatefrom','orderDateto','managerSearch'])el(id).value='';
   await selectAdminTab(view==='manager'?'manager':'orders',{orderFilter:filter||'unfinished'});
  },
  async openOrder(id){
   const ticket=++navigationEpoch,session=sessionStorage.getItem('zzws_session_v3');
   const order=await ZZWS_ADMIN_ORDERS.openNotice(id);
   if(!order)return;
   const valid=()=>{
    const selected=ZZWS_ADMIN_ORDERS.context?.();
    return ticket===navigationEpoch&&session===sessionStorage.getItem('zzws_session_v3')&&!el('workspace').hidden&&selected?.id===order.id&&Number(selected.revision)===Number(order.revision);
   };
   if(!valid())return;
   window.ZZWS_ADMIN_VIEW_STATE?.invalidateOrders();
   const groups=window.ZZWS_ADMIN_ORDER_GROUPS;
   await selectAdminTab('manager',{orderFilter:groups?.groupForOrder(order)||'unfinished'});if(valid())ZZWS_ADMIN_WORKBENCH.customer(order);
  }
 });
})();
