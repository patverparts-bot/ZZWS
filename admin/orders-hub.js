/* Two views of the same orders and the same shared editor. */
(() => {
 const el=id=>document.getElementById(id),hub=document.createElement('section');hub.id='adminOrdersHub';hub.hidden=true;hub.dataset.i18nSkip='true';
 const title=document.createElement('h1'),description=document.createElement('p'),views=document.createElement('nav'),queue=document.createElement('button'),table=document.querySelector('[data-tab="orders"]');queue.type='button';queue.dataset.ordersView='manager';table.dataset.ordersView='orders';views.className='orders-view-switch';hub.append(title,description,views);views.append(queue,table);el('manager').before(hub);
 for(const id of ['manager','orders'])el(id).querySelector(':scope > h1').hidden=true;
 const text={hy:['Պատվերներ','Նույն պատվերները՝ կառավարման և աղյուսակի տեսքով։ Պատվերի կազմը, կարգավիճակն ու պատմությունը ընդհանուր են։','Կառավարում','Աղյուսակ','Պատվերների տեսքը'],ru:['Заказы','Одни и те же заказы: работа с карточкой или просмотр таблицы. Состав, статус и история заказа общие.','Управление','Таблица','Вид заказов']};
 function translate(){const t=text[window.ZZWS_I18N?.language==='ru'?'ru':'hy'];title.textContent=t[0];description.textContent=t[1];queue.textContent=t[2];table.textContent=t[3];views.setAttribute('aria-label',t[4]);}
 queue.onclick=()=>run(()=>selectAdminTab('manager'));
 function sync(name){hub.hidden=!['manager','orders'].includes(name);for(const b of [queue,table]){const active=b.dataset.ordersView===name;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));}const main=document.querySelector('.admin-primary-navigation [data-tab="manager"]');if(main){const active=!hub.hidden;main.classList.toggle('admin-tab-active',active);main.setAttribute('aria-current',active?'page':'false');}translate();}
 window.ZZWS_ADMIN_ORDERS_HUB={sync};window.addEventListener('zzws:languagechange',translate);translate();
})();
