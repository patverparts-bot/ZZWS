/* A client mitigation for static hosting. Real anti-framing HTTP headers remain
   necessary; this never attempts top navigation or changes an account/session. */
(() => {
 'use strict';
 let allowed=false;try{allowed=window.top===window.self;}catch{}
 Object.defineProperty(window,'ZZWS_FRAME_GUARD',{value:Object.freeze({allowed}),writable:false,configurable:false});
 const root=document.documentElement;
 if(allowed){root.dataset.zzwsFrameGuard='top';root.removeAttribute('hidden');return;}
 root.hidden=true;root.dataset.zzwsFrameGuard='blocked';
 // Insert before later application/auth scripts are parsed. Multiple CSPs are
 // intersected: this denies script execution and network from the framed page.
 const policy=document.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; script-src 'none'; connect-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
 (document.head||root).append(policy);
 window.addEventListener('DOMContentLoaded',()=>document.body?.replaceChildren(),{once:true});
})();
