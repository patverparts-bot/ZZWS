/* Category navigation moves the canonical destination buttons; role flags stay on those buttons. */
(() => {
 'use strict';
 const menu=document.getElementById('adminMoreMenu'),host=menu?.querySelector('.admin-more-items');
 if(!menu||!host)return;
 const definitions=[
  {key:'orders',heading:'admin-nav-orders',hy:'Պատվերներ',ru:'Заказы',tabs:['templates','proposalManagement']},
  {key:'catalog',heading:'admin-nav-catalog',hy:'Կատալոգ',ru:'Каталог',tabs:['catalogControls','warehouses','rules','offers']},
  {key:'settings',heading:'admin-nav-settings',hy:'Կարգավորումներ',ru:'Настройки',tabs:['orderSettings','email']},
  {key:'app',heading:'admin-nav-app',hy:'Հավելված',ru:'Приложение',tabs:['apkDownloads','mobileApp']},
  {key:'system',heading:'admin-nav-system',hy:'Համակարգ',ru:'Система',tabs:['operations','assistantHistory','audit','storage','systemDataReset']},
  {key:'account',heading:'admin-nav-account',hy:'Իմ հաշիվը',ru:'Мой аккаунт',tabs:['accountSettings']}
 ];
 const rows=[];let mounted=false,selected=null,frame=0;
 const ru=()=>window.ZZWS_I18N?.language==='ru';
 const title=row=>ru()?row.ru:row.hy;
 function available(row){return row.buttons.some(button=>!button.hidden);}
 function resize(){
  frame=0;if(!menu.open)return;
  const viewport=window.visualViewport,offsetX=viewport?.offsetLeft||0,offsetY=viewport?.offsetTop||0,vw=viewport?.width||innerWidth,vh=viewport?.height||innerHeight,gap=10;
  const rect=menu.querySelector('summary').getBoundingClientRect(),width=Math.max(0,Math.min(560,vw-gap*2));
  const below=Math.max(0,offsetY+vh-rect.bottom-gap*2),above=Math.max(0,rect.top-offsetY-gap*2),flip=below<Math.min(host.scrollHeight||360,360)&&above>below;
  let height=Math.max(0,Math.min(flip?above:below,vh-gap*2));
  const overlay=height<Math.min(244,vh-gap*2);if(overlay)height=Math.max(0,vh-gap*2);
  host.style.width=width+'px';host.style.maxHeight=height+'px';
  host.style.left=Math.max(offsetX+gap,Math.min(rect.right-width,offsetX+vw-width-gap))+'px';
  host.style.top=(overlay?offsetY+gap:flip?Math.max(offsetY+gap,rect.top-gap-Math.min(host.scrollHeight,height)):Math.max(offsetY+gap,rect.bottom+gap))+'px';
  host.dataset.menuPlacement=overlay?'viewport':flip?'above':'below';
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(resize);}
 function paint(){
  const permitted=rows.filter(available);if(!permitted.some(row=>row.key===selected))selected=permitted[0]?.key||null;
  for(const row of rows){const visible=available(row),active=visible&&row.key===selected;
   row.section.hidden=!visible;row.category.hidden=!visible;row.category.textContent=title(row);row.heading.textContent=title(row);
   row.category.setAttribute('aria-selected',String(active));row.category.tabIndex=active?0:-1;row.panel.hidden=!active;
   const shown=row.buttons.filter(button=>!button.hidden);for(const button of row.buttons)button.classList.toggle('admin-menu-destination-wide',shown.length%2===1&&shown.at(-1)===button);
  }
  const offers=document.querySelector('[data-tab="offers"]');if(offers){offers.dataset.i18nSkip='true';offers.textContent=ru()?'Специальные предложения':'Հատուկ առաջարկներ';}
  schedule();
 }
 function choose(key,{focus=false}={}){const row=rows.find(item=>item.key===key);if(!row||!available(row))return;selected=key;paint();if(focus)row.category.focus();}
 function mount(){
  if(mounted)return;mounted=true;menu.classList.add('admin-category-menu');host.classList.add('admin-category-panel');
  const categories=document.createElement('div');categories.className='admin-menu-categories';categories.setAttribute('role','tablist');categories.dataset.i18nSkip='true';host.prepend(categories);
  for(const definition of definitions){
   let heading=document.getElementById(definition.heading),section=heading?.closest('.admin-nav-group');
   if(!section){section=document.createElement('section');section.className='admin-nav-group';heading=document.createElement('h3');heading.id=definition.heading;section.append(heading);host.append(section);}
   section.classList.add('admin-menu-section');section.dataset.menuGroup=definition.key;section.setAttribute('aria-labelledby',heading.id);heading.dataset.i18nSkip='true';
   const category=document.createElement('button');category.type='button';category.id='admin-menu-category-'+definition.key;category.className='admin-menu-category';category.dataset.menuCategory=definition.key;category.dataset.i18nSkip='true';category.setAttribute('role','tab');category.setAttribute('aria-controls','admin-menu-destinations-'+definition.key);
   const panel=document.createElement('div');panel.id='admin-menu-destinations-'+definition.key;panel.className='admin-menu-destinations';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',category.id);panel.hidden=true;section.append(panel);
   const buttons=definition.tabs.map(tab=>document.querySelector('[data-tab="'+tab+'"]')).filter(Boolean);
   for(const button of buttons)panel.append(button);
   categories.append(category);const row={...definition,heading,section,panel,category,buttons};rows.push(row);category.onclick=()=>choose(row.key);
   category.addEventListener('keydown',event=>{const allowed=rows.filter(available),index=allowed.indexOf(row);let next;
    if(event.key==='ArrowRight')next=(index+1)%allowed.length;else if(event.key==='ArrowLeft')next=(index+allowed.length-1)%allowed.length;else if(event.key==='ArrowDown')next=(index+2)%allowed.length;else if(event.key==='ArrowUp')next=(index+allowed.length-2)%allowed.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=allowed.length-1;else return;
    event.preventDefault();choose(allowed[next].key,{focus:true});
   });
  }
  for(const section of host.querySelectorAll('.admin-nav-group'))if(!rows.some(row=>row.section===section)&&!section.querySelector('[data-tab]'))section.hidden=true;
  menu.addEventListener('toggle',()=>{if(menu.open){sync();resize();}});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;menu.querySelector('summary').focus();}});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  window.addEventListener('zzws:languagechange',()=>{categories.setAttribute('aria-label',ru()?'Категории разделов':'Բաժինների խմբեր');paint();});
  categories.setAttribute('aria-label',ru()?'Категории разделов':'Բաժինների խմբեր');
 }
 function sync(){mount();paint();}
 function reveal(tabId){mount();const row=rows.find(item=>item.tabs.includes(tabId));if(row&&available(row)){selected=row.key;paint();return true;}return false;}
 function reset(){selected=null;if(frame)cancelAnimationFrame(frame);frame=0;menu.open=false;for(const row of rows){row.category.hidden=true;row.category.setAttribute('aria-selected','false');row.category.tabIndex=-1;row.panel.hidden=true;}}
 window.ZZWS_ADMIN_MENU=Object.freeze({sync,reveal,reset});
})();
