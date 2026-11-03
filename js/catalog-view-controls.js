/* Keep the real view controls visible outside the filters/tools panel. */
(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const heading=document.querySelector('.sf-catalog-heading'),list=document.getElementById('dealerTableView'),cards=document.getElementById('dealerCardsView');if(!heading||!list||!cards)return;
  const bar=document.createElement('div'),label=document.createElement('span'),group=document.createElement('div');bar.id='catalogViewBar';bar.dataset.i18nSkip='true';group.className='catalog-view-buttons';group.setAttribute('role','group');bar.append(label,group);group.append(list,cards);heading.after(bar);
  function translate(){const ru=window.ZZWS_I18N?.language==='ru';label.textContent=ru?'Вид товаров':'Ապրանքների տեսքը';group.setAttribute('aria-label',label.textContent);list.textContent=ru?'☰ Список':'☰ Ցանկ';cards.textContent=ru?'▦ Карточки':'▦ Քարտեր';list.title=ru?'Показать товары списком':'Ցուցադրել ապրանքների ցանկը';cards.title=ru?'Показать товары карточками':'Ցուցադրել ապրանքների քարտերը';}
  window.addEventListener('zzws:languagechange',translate);translate();
 });
})();
