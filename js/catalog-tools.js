/* One discoverable place for catalogue workflows; original controls retain their handlers. */
(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const heading=document.querySelector('.sf-catalog-heading'),old=document.getElementById('storefrontTools');if(!heading||!old)return;
  const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;},panel=node('section');panel.id='catalogTools';panel.setAttribute('aria-labelledby','catalogToolsTitle');
  const title=node('h2');title.id='catalogToolsTitle';panel.append(title);const grid=node('div');grid.className='catalog-tools-grid';panel.append(grid);
  const groups=[['Ցանկեր և ներմուծում','Списки и загрузка'],['Առաջարկներ','Предложения'],['Դիտում և արտահանում','Просмотр и экспорт']].map(([hy,ru])=>{const section=node('section'),h=node('h3');section.append(h);grid.append(section);return {section,h,hy,ru};});
  const move=(selector,index)=>{const e=document.querySelector(selector);if(e)groups[index].section.append(e);};
  move('#stockPickerOpen',0);move('button[onclick="openBulkAddModal()"]',0);move('#proposalOpen',1);move('#dealerOffers',1);move('#dealerBundles',1);move('#dealerShowroom',1);move('#dealerTableView',2);move('#dealerCardsView',2);move('#dealerCompare',2);
  const remaining=[...old.querySelectorAll('.sf-tools-items>button')];remaining.pop()?.remove();for(const b of remaining)groups[2].section.append(b);old.remove();heading.after(panel);
  function localize(){const ru=window.ZZWS_I18N?.language==='ru';title.textContent=ru?'Инструменты каталога':'Կատալոգի գործիքներ';for(const g of groups)g.h.textContent=ru?g.ru:g.hy;}
  localize();window.addEventListener('zzws:languagechange',localize);
 });
})();
