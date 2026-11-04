// The website's APK publisher targets the original app; make that distinction explicit in Partner.
(()=>{
 if(window.zzwsPartnerLabels)return;window.zzwsPartnerLabels=true;
 function apply(){
  const panel=document.getElementById('apkUploadPanel');if(!panel)return;
  const ru=document.documentElement.lang==='ru';
  const title=ru?'Обновление основного ZZWS · am.zzws.admin':'Հիմնական ZZWS-ի թարմացում · am.zzws.admin';
  const legend=panel.querySelector('legend');if(legend&&legend.textContent!==title)legend.textContent=title;
  let note=document.getElementById('zzwsPartnerChannelNote');if(!note){note=document.createElement('p');note.id='zzwsPartnerChannelNote';note.setAttribute('role','note');panel.prepend(note)}
  const text=ru?'Эта форма публикует обновления основного приложения ZZWS (am.zzws.admin). Выберите новый APK и подтвердите публикацию.':'Այս ձևը հրապարակում է հիմնական ZZWS հավելվածի (am.zzws.admin) թարմացումները։ Ընտրեք նոր APK-ն և հաստատեք հրապարակումը։';
  if(note.textContent!==text)note.textContent=text;
 }
 const observer=new MutationObserver(apply);observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['lang']});apply();
})();
