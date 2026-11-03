/* The server filters before pagination; both order views use the same rule. */
(() => {
 const options=[];
 for(const id of ['orderStatusFilter','managerStatusFilter']){const select=document.getElementById(id),option=document.createElement('option');option.value='unfinished';option.dataset.i18nSkip='true';select.options[0].after(option);options.push(option);}
 function translate(){for(const option of options)option.textContent=window.ZZWS_I18N?.language==='ru'?'Незавершённые':'Չավարտված գործընթացով';}
 window.addEventListener('zzws:languagechange',translate);translate();
})();
