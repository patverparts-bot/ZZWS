// Keep published legacy APK WebViews working while ordinary web entry moves.
(() => {
 'use strict';
 if(location.protocol!=='https:'||location.hostname!=='patverparts-bot.github.io')return;
 const prefix='/ZZWS';if(location.pathname!==prefix&&!location.pathname.startsWith(prefix+'/'))return;
 if(window.ZZWS_FRAME_GUARD?.allowed===false)return;
 // Published 7.1.35 sets this suffix before every embedded WebView load.
 // It is a compatibility hint for public routing, never an authorization check.
 if(/(?:^|\s)ZZWS\/\d/.test(navigator.userAgent))return;
 const target=new URL('https://zzws-1z2.pages.dev/');
 target.pathname=location.pathname.slice(prefix.length)||'/';target.search=location.search;target.hash=location.hash;
 document.documentElement.hidden=true;
 window.stop();location.replace(target.href);
})();
