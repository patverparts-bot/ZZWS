/* Presentation only. Catalogue lifetime belongs to auth-data; order scenes follow server success. */
(() => {
 'use strict';
 const keys=Object.freeze({catalog:'Պատրաստում ենք կատալոգը',order:'Ձեր պատվերը պատրաստում ենք առաքման',note:'Սպասեք պատվերի հաստատմանը։',continue:'Շարունակել'});
 const fridge='<rect class="scene-appliance" width="44" height="66" rx="5"/><path class="scene-handle" d="M3 31h38M34 9v14m0 17v17"/>';
 const warehouse='<path class="scene-building" d="M32 83h225v162H32z"/><path class="scene-roof" d="m20 83 24-26h201l25 26z"/><path class="scene-shelf" d="M53 139h184M53 202h184"/><g class="scene-box"><rect x="65" y="104" width="40" height="31" rx="3"/><rect x="174" y="104" width="45" height="31" rx="3"/><rect x="118" y="166" width="43" height="32" rx="3"/></g>';
 const frame=body=>'<svg viewBox="0 0 900 310" aria-hidden="true" focusable="false"><path class="scene-floor" d="M0 245h900v65H0z"/>'+body+'</svg>';
 const catalog=frame(warehouse+'<path class="scene-route" d="M200 165h345"/><rect class="scene-building" x="540" y="58" width="325" height="182" rx="15"/><path class="scene-shelf" d="M559 88h287"/><g class="scene-catalog-tiles"><rect x="560" y="108" width="86" height="108" rx="7"/><rect x="660" y="108" width="86" height="108" rx="7"/><rect x="760" y="108" width="86" height="108" rx="7"/></g><g transform="translate(581 123)">'+fridge+'</g><g transform="translate(679 130)"><rect class="scene-appliance" width="48" height="55" rx="5"/><circle class="scene-glass" cx="24" cy="32" r="15"/></g><g transform="translate(772 133)"><rect class="scene-glass" width="62" height="41" rx="4"/><path class="scene-handle" d="M31 42v9m-14 0h28"/></g><g class="catalog-transfer transfer-fridge">'+fridge+'</g><g class="catalog-transfer transfer-washer"><rect class="scene-appliance" width="48" height="55" rx="5"/><circle class="scene-glass" cx="24" cy="32" r="15"/></g><g class="catalog-transfer transfer-tv"><rect class="scene-glass" width="62" height="41" rx="4"/><path class="scene-handle" d="M31 42v9m-14 0h28"/></g>');
 const order=frame(warehouse+'<g transform="translate(766 96)"><path class="scene-roof" d="m-6 54 60-47 60 47z"/><path class="scene-building" d="M5 54h98v115H5z"/><rect class="scene-glass" x="20" y="75" width="25" height="29" rx="3"/><rect class="scene-glass" x="62" y="75" width="25" height="29" rx="3"/><path class="scene-shelf" d="M49 167v-40h22v40"/></g><path class="scene-road" d="M0 278h900"/><g class="order-truck"><g transform="translate(340 160)"><rect class="scene-truck-body" width="180" height="95" rx="7"/><path class="scene-cab" d="M180 27h43l31 35v33h-74z"/><path class="scene-glass" d="M190 37h27l20 24h-47z"/><path class="scene-stripe" d="M0 80h180v15H0z"/><g class="order-cargo"><g transform="translate(35 5)">'+fridge+'</g></g><g class="scene-wheels"><circle cx="37" cy="100" r="16"/><circle cx="171" cy="100" r="16"/><circle cx="229" cy="100" r="16"/></g></g></g><g class="order-forklift"><g transform="translate(155 245)"><path class="scene-forklift-body" d="M0-30h53v35H0zM9-30v-43h30l13 43z"/><path class="scene-mast" d="M56-94V13m8-107V13"/><path class="scene-forks" d="M57 14h70"/><g class="scene-wheels"><circle cx="9" cy="9" r="10"/><circle cx="44" cy="9" r="10"/></g></g></g>');
 const scene=document.getElementById('sessionSpinner');
 scene.className='zzws-scene catalog-scene';scene.innerHTML=catalog;
 const label=document.getElementById('sessionLoadingText');label.dataset.loadingKey='catalog';label.textContent=keys.catalog;
 const dialog=document.createElement('dialog');dialog.id='orderPreparation';dialog.className='zzws-order-preparation';dialog.setAttribute('aria-labelledby','orderPreparationTitle');
 dialog.innerHTML='<div class="loading-scene-logos"><img class="session-loader-logo" src="logo.svg" alt="ZIGZAG" width="198" height="46"><img class="session-loader-logo-dark" src="logo-dark.svg" alt="" aria-hidden="true" width="198" height="46"></div><h2 id="orderPreparationTitle" data-loading-key="order"></h2><div class="zzws-scene order-scene">'+order+'</div><p data-loading-key="note"></p><button type="button" data-loading-key="continue"></button>';
 document.body.append(dialog);
 function localize(){for(const el of document.querySelectorAll('[data-loading-key]'))el.textContent=window.ZZWS_I18N.t(keys[el.dataset.loadingKey]);}
 localize();window.addEventListener('zzws:languagechange',localize);
 let pending=null;
 function close(completed=false){if(!pending)return;const resolve=pending;pending=null;dialog.close();resolve(completed);}
 dialog.querySelector('button').onclick=()=>close(true);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close(true);});
 dialog.addEventListener('close',()=>{if(!dialog.open)close(false);});
 window.addEventListener('pagehide',()=>close(false));
 window.ZZWS_LOADING_SCENES=Object.freeze({keys,cancelOrder:()=>close(false),async orderAccepted(){
  if(pending)return false;
  // Reduced motion goes straight to the existing order confirmation.
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return true;
  return new Promise(resolve=>{
   pending=resolve;dialog.showModal();
   // The scene ends with its animation, never with a catalogue/network timer.
   const animations=dialog.querySelector('.order-truck').getAnimations();
   if(!animations.length){close(true);return;}
   const finish=()=>{if(pending===resolve)close(true);};
   Promise.all(animations.map(animation=>animation.finished)).then(finish,finish);
  });
 }});
})();
