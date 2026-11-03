/* Keep stable select values for saved views and existing navigation links. */
(() => {
 const options=[];
 for(const id of ['orderStatusFilter','managerStatusFilter']){
  const select=document.getElementById(id);if(!select)continue;
  for(const value of ['unfinished','finished','approval_pending']){
   let option=[...select.options].find(option=>option.value===value);
   if(!option){option=document.createElement('option');option.value=value;select.append(option);}
   option.dataset.i18nSkip='true';options.push(option);
  }
 }
 function translate(){const ru=window.ZZWS_I18N?.language==='ru',labels={unfinished:ru?'Текущие':'Ընթացիկ',finished:ru?'Завершённые':'Ավարտված',approval_pending:ru?'Ждут согласования':'Սպասում են հաճախորդի հաստատմանը'};for(const option of options)option.textContent=labels[option.value];}
 window.addEventListener('zzws:languagechange',translate);translate();
})();
