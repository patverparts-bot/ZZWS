const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..'),site='https://patverparts-bot.github.io/ZZWS/';
const staticOverlay=process.env.ZZWS_STATIC_OVERLAY?path.resolve(process.env.ZZWS_STATIC_OVERLAY):null;
const appRoot=process.env.ZZWS_ANDROID_SOURCE||'android';
const native=fs.readFileSync(path.join(root,appRoot,'src/am/zzws/admin/PartnerWebActivity.java'),'utf8');
const actions=new Map([...native.matchAll(/case ([A-Z_]+):action=("(?:[^"\\]|\\.)*");break;/g)].map(m=>[m[1],JSON.parse(m[2])]));
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs'),{createTrackedApkRuntime}=await import('../support/apk-runtime.mjs');const runtime=await createRuntime({memory:true,origin:'https://patverparts-bot.github.io'}),apk=createTrackedApkRuntime(runtime,{origin:'https://patverparts-bot.github.io'});let browser;const checks=[],errors=[],orderReads=[],unhandledServices=[];
 const call=async(route,token,data)=>{const r=await runtime.handle(new Request('https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/'+route,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,data:await r.json()};};
 const login=async user=>{const r=await call('login',null,{login:user,password:'24681012'});assert.equal(r.status,200);return r.data.sessionToken;};
 try{
  const client=await login('zzws-test-dealer'),owner=await login('zzws-test-owner');assert.equal((await call('admin/users',client)).status,403);
  await call('me/state',client,{section:'favorites',version:0,value:['test-002']});await call('me/state',client,{section:'cart',version:0,value:{'test-002':{articul:'test-002',qty:2,addedPrice:101000,addedPriceMode:'WS'}}});
  await runtime.db.exec("update zzws_receipt_settings set mode='off'");const profile=(await call('me',client)).data,product=(await call('catalog',client)).data.products.find(p=>p.articul==='test-002');for(let i=0;i<8;i++){const result=await call('orders',client,{requestId:crypto.randomUUID(),profileRevision:profile.profileRevision,deliveryVariantId:profile.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});assert.equal(result.status,200);}
  const seeded=await call('orders',client);assert.equal(seeded.status,200);assert.equal(seeded.data.orders.length,8,'Actual API must list all local fixture orders');
  const release=await apk.handle(new Request('https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-apk/current',{headers:{Authorization:'Bearer '+client}}));assert.equal(release.status,200,'APK endpoint must use the same isolated session database');
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function pageFor(token){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(token=>sessionStorage.setItem('zzws_session_v3',token),token);
   await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'}));
   await page.route('https://xufxevjdfukglplsknrp.supabase.co/functions/**',async route=>{unhandledServices.push(new URL(route.request().url()).pathname);await route.abort('blockedbyclient');});
   for(const service of ['zzws-api','zzws-apk'])await page.route('https://xufxevjdfukglplsknrp.supabase.co/functions/v1/'+service+'/**',async route=>{const q=route.request(),headers=await q.allHeaders(),response=await (service==='zzws-apk'?apk.handle:runtime.handle)(new Request(q.url(),{method:q.method(),headers,...(!['GET','HEAD'].includes(q.method())?{body:q.postDataBuffer()}:{} )})),body=Buffer.from(await response.arrayBuffer()),name=new URL(q.url()).pathname.split('/'+service+'/')[1];if(orderReads.length<12&&(response.status===401||name==='logout'||service==='zzws-api'&&q.method()==='GET'&&name==='orders')){const data=JSON.parse(body.toString());orderReads.push({service,route:name,method:q.method(),status:response.status,count:data.orders?.length,error:data.error,bearerPresent:!!headers.authorization,...(response.status===401?{originalFixtureSessionStatus:(await call('me',client)).status}:{})});}await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});});
   await page.route(site+'**',async route=>{let name=decodeURIComponent(new URL(route.request().url()).pathname).slice('/ZZWS/'.length);if(!name||name.endsWith('/'))name+='index.html';if(name==='js/api-config.js'){await route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:"https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/",publishableKey:"offline-public"};'});return;}const original=path.resolve(root,name),replacement=staticOverlay?path.resolve(staticOverlay,name):null,file=replacement&&replacement.startsWith(staticOverlay+path.sep)&&fs.existsSync(replacement)?replacement:original;if(!original.startsWith(root+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
   return page;
  }
  const page=await pageFor(client);await page.goto(site);await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded&&cart['test-002']?.qty===2);assert.deepEqual(await page.evaluate(()=>[...favoritesSet]),['test-002']);checks.push('native cart/favourites are restored by the authenticated website');
  await page.evaluate(fs.readFileSync(path.join(root,appRoot,'assets/partner-navigation.js'),'utf8'));
  for(const [name,id]of [['SAVED_CARTS','savedCartsPanel'],['SELLER','storefrontTools'],['TECHNICAL','dealerTechFilters']]){
   await page.evaluate(name=>window.__partnerPhase=name,name);if(name!=='SAVED_CARTS')await page.evaluate(()=>{closeOrderModal();ZZWS_STOREFRONT.navigate('home');});assert.ok(actions.has(name));await page.evaluate(code=>(0,eval)('(function(){'+code+'})()'),actions.get(name));assert.equal(await page.locator('#'+id).evaluate(n=>n.open),true,name);assert.equal(await page.locator('#'+id).isVisible(),true,name+' panel must be visible from home');assert.equal(await page.locator('#'+id).locator('button,input,select').first().isVisible(),true,name+' controls must be visible');checks.push(name+' opens its actual visible website tool from home');
  }
  const nativeSeller=()=>page.evaluate(code=>(0,eval)('(function(){'+code+'})()'),actions.get('SELLER'));
  for(const width of [320,390]){
   await page.evaluate(width=>window.__partnerPhase='Orders lifecycle '+width,width);await page.setViewportSize({width,height:740});await page.evaluate(()=>{closeOrderModal();closePersonalCabinet();});await nativeSeller();await page.waitForFunction(()=>document.getElementById('storefrontTools').open);
   await page.evaluate(()=>openPersonalCabinet());try{await page.waitForFunction(()=>document.querySelector('.server-order-card')?.getClientRects().length||document.getElementById('mainApp').classList.contains('hidden'));assert.equal(await page.locator('#mainApp').isVisible(),true,'History must retain the normal authenticated session');assert.equal(await page.locator('.server-order-card').first().isVisible(),true);}catch(error){console.error('CABINET_DIAGNOSTIC '+JSON.stringify({orderReads,...await page.evaluate(()=>({trace:window.__partnerTrace,phase:window.__partnerPhase,url:location.pathname+location.hash,cabinetHidden:document.getElementById('cabinetModal').classList.contains('hidden'),mainHidden:document.getElementById('mainApp').classList.contains('hidden'),pending:document.getElementById('pendingReceiptOnly').checked,text:document.getElementById('serverOrdersList').textContent.slice(0,500),state:ZZWS_ORDERS.viewState()}))}));throw error;}await page.waitForFunction(()=>!document.getElementById('storefrontTools').open);if(!await page.locator('.orders-search-panel').evaluate(n=>n.open))await page.locator('.orders-search-panel>summary').click();await page.locator('#serverOrderSearch').fill('unsent history search');
   const before=await page.evaluate(()=>document.getElementById('cabinetScroll').scrollTop);await page.evaluate(()=>document.getElementById('cabinetScroll').scrollTop=100000);await page.waitForFunction(old=>document.getElementById('cabinetScroll').scrollTop>old,before);await page.evaluate(()=>document.getElementById('cabinetScroll').scrollTop=0);assert.equal(await page.locator('#storefrontTools').evaluate(n=>n.open),false);assert.equal(await page.locator('.orders-search-panel').evaluate(n=>n.open),true);assert.equal(await page.locator('#serverOrderSearch').inputValue(),'unsent history search');assert.equal(await page.evaluate(()=>cart['test-002'].qty),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('#serverOrderSearch').fill('');await page.evaluate(()=>closePersonalCabinet());await nativeSeller();await page.waitForFunction(()=>document.getElementById('storefrontTools').open);await page.evaluate(()=>scrollBy(0,50));await page.waitForFunction(()=>!document.getElementById('storefrontTools').open);await nativeSeller();await page.waitForFunction(()=>document.getElementById('storefrontTools').open);await page.evaluate(()=>ZZWS_STOREFRONT.navigate('home'));assert.equal(await page.locator('#storefrontTools').evaluate(n=>n.open),false);
  }
  checks.push('actual SELLER bridge closes its popover on Orders transition and background scroll at320/390px; inline search/draft/cart survive');
  await page.evaluate(()=>closeOrderModal());await page.evaluate(code=>(0,eval)('(function(){'+code+'})()'),actions.get('ASSISTANT'));await page.locator('dialog[open]').first().waitFor();checks.push('assistant opens from the native action');
  const admin=await pageFor(owner);await admin.goto(site+'admin/');await admin.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));assert.equal(await admin.locator('#workspace').isVisible(),true);checks.push('full administration opens with the existing owner session');
  await admin.addStyleTag({content:fs.readFileSync(path.join(root,appRoot,'assets/partner-admin.css'),'utf8')});
  await admin.evaluate(()=>document.body.classList.add('zzws-partner-admin'));
  assert.equal(await admin.locator('body>header').isVisible(),false,'duplicate website header must not consume the native app viewport');
  for(const width of [320,390]){
   await admin.setViewportSize({width,height:844});
   const nav=await admin.locator('.admin-navigation').boundingBox();assert.ok(nav&&nav.height<=72,'compact management menu at width '+width);
   assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'compact header exceeds viewport');
  }
  checks.push('duplicate web header removed and management menu fits one compact row at 320/390px');
  await admin.evaluate(fs.readFileSync(path.join(root,appRoot,'assets/partner-admin.js'),'utf8'));
  await admin.locator('#zzwsPartnerChannelNote').waitFor({state:'attached'});
  assert.match(await admin.locator('#apkUploadPanel legend').textContent(),/am\.zzws\.admin/);
  assert.match(await admin.locator('#zzwsPartnerChannelNote').textContent(),appRoot==='android'?/am\.zzws\.admin/:/am\.zzws\.partner/);
  checks.push('APK publisher identifies the correct application and channel');
  for(const tab of ['users','price','dashboard']){
   await admin.evaluate(tab=>{location.hash='tab='+tab},tab);await admin.locator('#'+tab).waitFor({state:'visible'});
   assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'embedded '+tab+' exceeds phone viewport');
   checks.push('management link opens actual '+tab+' section with Partner styling');
  }
  await admin.screenshot({path:path.join(root,'output/partner/admin-7.1.5.png'),fullPage:true});
  const managerSource=fs.readFileSync(path.join(root,appRoot,'src/am/zzws/admin/PartnerManagement.kt'),'utf8');
  assert.match(managerSource,/orders\(key\)/);assert.match(managerSource,/model\.openOrders\(context,status\)/);
  const navigationSource=fs.readFileSync(path.join(root,appRoot,'src/am/zzws/admin/NativeNavigation.kt'),'utf8');
  assert.match(navigationSource,/putExtra\("zzws_status",status\)/);assert.match(navigationSource,/PartnerFeature\.ORDERS\.name/);
  assert.match(native,/applyAdminStyle\(view\)/);
  assert.deepEqual(unhandledServices,[],'All application services must remain inside the isolated runtimes');assert.deepEqual(errors,[]);assert.equal(runtime.reportEmails.length,0);console.log('PASS: '+checks.join('; '));
 }finally{fs.mkdirSync(path.join(root,'output/partner'),{recursive:true});fs.writeFileSync(path.join(root,'output/partner/tools-verification.json'),JSON.stringify({checks,errors,unhandledServices,productionMutations:0},null,2));await browser?.close();await runtime.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
