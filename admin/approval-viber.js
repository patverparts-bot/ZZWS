/* Personal Viber recipients cannot be selected by the documented share scheme. */
(() => {
 'use strict';
 function phone(value){
  if(typeof value!=='string'||value.length>40||/[\r\n\t]/.test(value))return '';
  let number=value.trim();if(!/^\+?[\d ()-]+$/.test(number))return '';
  number=number.replace(/[ ()-]/g,'');
  if(number.startsWith('00'))number='+'+number.slice(2);
  if(/^0\d{8}$/.test(number))number='+374'+number.slice(1);
  else if(/^\d{8}$/.test(number))number='+374'+number;
  else if(!number.startsWith('+'))number='+'+number;
  if(!/^\+[1-9]\d{7,14}$/.test(number))return '';
  // Armenia has eight national digits; do not retain a domestic trunk zero.
  if(number.startsWith('+374')&&!/^\+374[1-9]\d{7}$/.test(number))return '';
  return number;
 }
 function message(data,site){
  const url=new URL(site);url.search='';url.hash='';
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid ZZWS URL');
  return 'Բարև Ձեզ։ Խնդրում ենք դիտարկել և հաստատել №'+data.number+' պատվերի փոփոխությունները ZZWS-ում։\n'+url.href+(phone(data.managerPhone)?'\nՄենեջերի հեռախոսը՝ '+phone(data.managerPhone):'');
 }
 function shareLink(number,text){
  if(!phone(number)||typeof text!=='string'||!text.trim()||text.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))return '';
  try{return 'viber://forward?text='+encodeURIComponent(text);}catch{return '';}
 }
 window.ZZWS_APPROVAL_VIBER=Object.freeze({phone,message,shareLink});
})();

