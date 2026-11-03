(() => {
 'use strict';
 const releaseUrl=new URL('../apk-release.json',document.currentScript.src);
 const apkEndpoint=path=>new URL('../zzws-apk/'+path,ZZWS_CONFIG.api).href;
 const assetOptions={credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error'};
 const maxApkBytes=150*1024*1024;
 let owner=null,ticket=0,mount=null,loading=false,clientAccount=false;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
 function mobileAppIcon(){
  const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg');
  for(const [name,value]of Object.entries({viewBox:'0 0 24 24',width:'22',height:'22',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))icon.setAttribute(name,value);
  icon.style.cssText='display:inline-block;vertical-align:middle;flex-shrink:0;margin-inline-end:7px';
  const phone=document.createElementNS(ns,'rect');for(const [name,value]of Object.entries({x:'5',y:'1.5',width:'14',height:'21',rx:'3'}))phone.setAttribute(name,value);
  const screen=document.createElementNS(ns,'path');screen.setAttribute('d','M10 5h4M9 8h2v2H9zM13 8h2v2h-2zM12 12v5m-2-2 2 2 2-2M10 20h4');icon.append(phone,screen);return icon;
 }
 function mobileAppLabel(target,text){target.replaceChildren(mobileAppIcon(),node('span',text));}
 function root(){
  if(mount?.isConnected)return mount;
  mount=document.getElementById('adminResourcesPanel')||document.getElementById('catalogAdminResources');
  if(!mount){const cabinet=document.getElementById('cabinetModal');if(!cabinet)return null;mount=node('section');mount.id='catalogAdminResources';mount.hidden=true;const subtitle=document.getElementById('cabinetUserSubtitle');(subtitle?.parentElement||cabinet).append(mount);}
  return mount;
 }
 function reset(){owner=null;clientAccount=false;++ticket;loading=false;const box=root();if(box){box.replaceChildren();box.hidden=true;}}
 function textError(error){return window.ZZWS?.message(error)||'Չհաջողվեց կատարել գործողությունը։';}
 async function readRelease(){
  const current=await ZZWS.json(apkEndpoint('current'));
  if(current.release)return validateRelease(current.release,true);
  // Only a filename beside the manifest is accepted; account credentials never leave the API.
  const response=await fetch(releaseUrl,assetOptions);
  if(!response.ok)throw Error('APK-ի թողարկման տվյալները դեռ հասանելի չեն։ Փորձեք ավելի ուշ։');
  const text=await response.text();if(text.length>16384)throw Error('APK-ի թողարկման տվյալները սխալ են։');
  let data;try{data=JSON.parse(text);}catch{throw Error('APK-ի թողարկման տվյալները սխալ են։');}
  return validateRelease(data,false);
 }
 function validateRelease(data,server){
  if(data?.schemaVersion!==1||typeof data.version!=='string'||!/^[0-9][A-Za-z0-9.+_-]{0,79}$/.test(data.version)||
   typeof data.filename!=='string'||!/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,159}\.apk$/.test(data.filename)||
   typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256)||!Number.isSafeInteger(data.bytes)||data.bytes<4||data.bytes>maxApkBytes||
   typeof data.description!=='string'||data.description.length>4000)throw Error('APK-ի թողարկման տվյալները սխալ են։');
  if(server&&(!Number.isInteger(data.versionCode)||data.versionCode<1||data.versionCode>2147483647))throw Error('APK-ի թողարկման տվյալները սխալ են։');
  return {...data,server,url:server?apkEndpoint('download?versionCode='+data.versionCode):new URL(data.filename,releaseUrl).href};
 }
 function showRelease(card,release){
  card.querySelector('[data-apk-version]').textContent='Տարբերակ՝ '+release.version;
  card.querySelector('[data-apk-description]').textContent=release.description;
 }
 async function availability(button,notice,card,who,requestTicket){
  button.disabled=true;mobileAppLabel(button,'Ստուգվում է Բջջային Հավելվածի հասանելիությունը…');
  try{
   const release=await readRelease();
   if(!release.server){const response=await fetch(release.url,{...assetOptions,method:'HEAD'});
    const length=response.headers.get('content-length');
    if(!response.ok||!/^(application\/vnd\.android\.package-archive|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type')||'')||length!==null&&Number(length)!==release.bytes)throw Error('APK-ը դեռ հասանելի չէ։ Փորձեք ավելի ուշ։');
   }
   if(owner!==who||requestTicket!==ticket)return;
   showRelease(card,release);mobileAppLabel(button,'Ներբեռնել Բջջային Հավելվածը');button.onclick=()=>download(button,notice,card,who,requestTicket);button.disabled=false;notice.textContent='';
  }catch(error){if(owner===who&&requestTicket===ticket){notice.textContent=textError(error);mobileAppLabel(button,'Կրկին ստուգել Բջջային Հավելվածը');button.onclick=()=>availability(button,notice,card,who,requestTicket);button.disabled=false;}}
 }
 async function download(button,notice,card,who,requestTicket){
  if(loading||owner!==who||requestTicket!==ticket)return;loading=true;button.disabled=true;notice.textContent='Ֆայլը բեռնվում է…';
  try{
   const permission=await ZZWS.json(clientAccount?'me':'me/resources');
   if(owner!==who||requestTicket!==ticket)return;
   if(clientAccount?(permission.id!==who||permission.role!=='client'):permission.mobileAdminEnabled!==true)throw Error('Ներբեռնման թույլտվությունը փոխվել է։');
   const release=await readRelease();
   if(owner!==who||requestTicket!==ticket)return;
   showRelease(card,release);
   // Public GitHub asset: never send the ZZWS session or API key to this URL.
   const response=release.server?await ZZWS.request(release.url):await fetch(release.url,assetOptions);
   if(!response.ok){const e=new Error('APK-ի ներբեռնումը հասանելի չէ։ Թարմացրեք մուտքը կամ դիմեք սեփականատիրոջը։');e.status=response.status;throw e;}
   if(!/^(application\/vnd\.android\.package-archive|application\/octet-stream)(;|$)/i.test(response.headers.get('content-type')||''))throw Error('Սերվերը վերադարձրել է ոչ ճիշտ APK ֆայլ։');
   const blob=await response.blob();if(blob.size!==release.bytes)throw Error('APK ֆայլի ստուգումը ձախողվել է։ Թարմացրեք էջը կամ դիմեք սեփականատիրոջը։');
   const signature=new Uint8Array(await blob.slice(0,4).arrayBuffer());if(signature[0]!==80||signature[1]!==75||signature[2]!==3||signature[3]!==4)throw Error('APK ֆայլը չի ստուգվել։');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
   if(digest!==release.sha256)throw Error('APK ֆայլի ստուգումը ձախողվել է։ Թարմացրեք էջը կամ դիմեք սեփականատիրոջը։');
   if(owner!==who||requestTicket!==ticket)return;
   const current=await ZZWS.json(clientAccount?'me':'me/resources');
   if(owner!==who||requestTicket!==ticket)return;
   if(clientAccount?(current.id!==who||current.role!=='client'):current.mobileAdminEnabled!==true)throw Error('Ներբեռնման թույլտվությունը փոխվել է։');
   const link=node('a'),url=URL.createObjectURL(blob);link.href=url;link.download=release.filename;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   notice.textContent='APK ֆայլը ներբեռնված է։ Տեղադրեք այն ձեր Android սարքում։';
   const downloadId=response.headers.get('X-ZZWS-Download-Id');if(release.server&&downloadId){try{await ZZWS.json(apkEndpoint('download-complete'),{method:'POST',body:JSON.stringify({downloadId,sha256:release.sha256,bytes:release.bytes})});}catch{if(owner===who&&requestTicket===ticket)notice.textContent='APK ֆայլը ներբեռնված է, բայց հաշվառման հաստատումը չի ուղարկվել։ Տեղադրեք այն ձեր Android սարքում։';}}
  }catch(error){if(owner===who&&requestTicket===ticket)notice.textContent=textError(error);}
  finally{if(owner===who&&requestTicket===ticket){loading=false;if(button.isConnected)button.disabled=false;}}
 }
 function render(data,who,requestTicket){
  const box=root();if(!box)return;box.replaceChildren();box.hidden=true;
  const mobile=data.mobileAdminEnabled===true,telegram=data.telegramEnabled===true;
  if(!mobile&&!telegram)return;
  box.style.cssText='margin:10px 0;min-width:0;max-width:100%;line-height:1.5;flex-shrink:0';
  const details=node('details');details.dataset.resourceInstructions='';details.style.cssText='box-sizing:border-box;width:fit-content;max-width:min(100%,32rem);padding:10px 12px;border:1px solid #94a3b8;border-radius:10px';
  const summary=node('summary');if(mobile)mobileAppLabel(summary,(telegram?'Բջջային Հավելված և Telegram':'Բջջային Հավելված')+' · հրահանգներ');else summary.textContent='Telegram · հրահանգներ';summary.style.cssText='cursor:pointer;font-weight:600;font-size:13px;list-style-position:inside;overflow-wrap:anywhere';
  const content=node('div');content.style.cssText='display:grid;gap:12px;padding-top:12px;max-height:34vh;overflow:auto;font-size:13px;min-width:0;overflow-wrap:anywhere';details.append(summary,content);box.append(details);
  const notice=node('p');notice.setAttribute('role','status');notice.style.fontSize='13px';
  if(mobile){
   const card=node('div');card.style.cssText='display:grid;gap:6px;min-width:0';const heading=node('h4');mobileAppLabel(heading,'Բջջային Հավելված');card.append(heading);
   const button=node('button');button.type='button';button.dataset.resource='apk';button.style.cssText='padding:10px 14px;border:1px solid #2563eb;border-radius:8px;background:#1d4ed8;color:white;cursor:pointer;justify-self:start;max-width:100%;white-space:normal';card.append(button);
   const version=node('p');version.dataset.apkVersion='';card.append(version);const description=node('p');description.dataset.apkDescription='';description.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';card.append(description);availability(button,notice,card,who,requestTicket);
   card.append(node('p','Մուտք գործեք ձեր անձնական ZZWS հաշվով։ Հավելվածը չի ընդլայնում հաշվի իրավունքները։'));content.append(card);
  }
  if(telegram){
   const card=node('div');card.dataset.resource='telegram';card.style.cssText='display:grid;gap:6px;min-width:0';card.append(node('h4','Telegram ծանուցումների միացում'));
   card.append(node('p',data.telegram?.mode==='offline'?'Անցանց փորձարկման ռեժիմ․ իրական Telegram հաղորդագրություններ չեն ուղարկվում։':'Ծանուցումները նախատեսված են միայն սեփականատիրոջ կողմից հաստատված ստացողի համար։'));
   const username=data.telegram?.botUsername,validBot=typeof username==='string'&&/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)&&!['botfather','userinfobot'].includes(username.toLowerCase());
   card.append(node('p',validBot?'ZZWS ծանուցումների բոտ՝ @'+username:'ZZWS ծանուցումների բոտը դեռ նշված չէ։ Սեփականատերը պետք է այն լրացնի ադմինիստրատորի քարտում։'));
   const list=node('ol');for(const step of [
    validBot?'Telegram-ում բացեք @'+username+' բոտը ստորև նշված հղումով։':'Սեփականատիրոջից ստացեք հենց ZZWS ծանուցումների բոտի անունը կամ հղումը։',
    'Ձեր անձնական թվային Telegram ID-ն իմանալու համար առանձին բացեք @userinfobot-ը և սեղմեք Start։ Պատճենեք պատասխանի «Id» թվային արժեքը։ Սա ստացողի ID-ն է, ոչ թե բոտի անունը։',
    'Փոխանցեք անձնական ID-ն ZZWS-ի սեփականատիրոջը։ Նա այն պահպանում է ձեր ադմինիստրատորի քարտի «Ստացողի անձնական Telegram ID» դաշտում և միացնում ծանուցումները։',
    'ID-ն քարտում պահպանելուց հետո սեղմեք ZZWS բոտի «Սկսել» (Start) կոճակը կամ կրկին ուղարկեք /start։ Սերվերային միացումը գործարկված լինելու դեպքում կստանաք միացման հաստատում։ «Доступ запрещён» պատասխանը նշանակում է, որ տվյալ անձնական ID-ն դեռ թույլատրված չէ։',
    'Յուրաքանչյուր ադմինիստրատոր ստանում է ծանուցումները իր քարտում նշված Telegram ID-ով, եթե հասանելիությունը միացված է և ունի պատվերները դիտելու իրավունք։ Միացումից հետո ծանուցումները վերաբերում են նոր պատվերներին և հետագա փոփոխություններին։ Հին իրադարձությունները կրկին չեն ուղարկվում։',
    'Բոտը միայն տեղեկացնում է․ պատվերների կառավարումն իրականացվում է ZZWS-ում։ Գաղտնաբառ կամ բոտի գաղտնի բանալի Telegram-ով մի ուղարկեք։'
   ])list.append(node('li',step));card.append(list);
   if(validBot){const link=node('a','Բացել ZZWS ծանուցումների բոտը՝ @'+username);link.href='https://t.me/'+username;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}
   const idHelp=node('a','Իմանալ իմ անձնական ID-ն՝ @userinfobot');idHelp.href='https://t.me/userinfobot';idHelp.target='_blank';idHelp.rel='noopener noreferrer';idHelp.style.display='block';card.append(idHelp);
   if(data.telegram?.canSimulateStart===true){const simulator=node('a','Փորձարկել /start-ը անցանց՝ առանց Telegram ուղարկելու');simulator.href='/offline-console';simulator.style.display='block';card.append(simulator);}
   card.append(node('p',data.telegram?.recipientConfigured?'Ձեր անձնական ID-ն պահպանված է սերվերում։ Իրական ուղարկումը կախված է սերվերի միացված ծառայությունից։':'Ձեր ստացողի ID-ն դեռ հաստատված չէ այս հաշվի համար։ Դիմեք սեփականատիրոջը։'));
   if(typeof data.telegram?.instructions==='string'&&data.telegram.instructions.length<=2000)card.append(node('p',data.telegram.instructions));content.append(card);
  }
  content.append(notice);box.hidden=false;
 }
 async function start(user,options={}){
  reset();if(options.root)mount=options.root;
  if(!['admin','client'].includes(user?.role)||!user.id||(user.role==='admin'&&user.mobileAdminEnabled!==true&&user.telegramEnabled!==true))return;
  clientAccount=user.role==='client';owner=user.id;const who=owner,requestTicket=++ticket;
  try{const data=clientAccount?{mobileAdminEnabled:true,telegramEnabled:false}:await ZZWS.json('me/resources');if(who!==owner||requestTicket!==ticket)return;render(data,who,requestTicket);}
  catch{if(who===owner&&requestTicket===ticket){const box=root();if(box){box.replaceChildren();box.hidden=true;}}}
 }
 async function refresh(){const who=owner,at=ticket;try{const user=await ZZWS.json('me');if(owner!==who||ticket!==at)return;const opened=root()?.querySelector('[data-resource-instructions]')?.open;await start(user);const details=root()?.querySelector('[data-resource-instructions]');if(opened&&details)details.open=true;}catch{if(owner===who&&ticket===at)reset();}}
 window.ZZWS_ADMIN_RESOURCES=Object.freeze({start,reset,refresh});
 window.addEventListener('zzws:session-changed',event=>event.detail?.user?start(event.detail.user):reset());
})();

