const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..'),site='https://patverparts-bot.github.io/ZZWS/';
const appRoot=process.env.ZZWS_ANDROID_SOURCE||'android';
const native=fs.readFileSync(path.join(root,appRoot,'src/am/zzws/admin/PartnerWebActivity.java'),'utf8');
const actions=new Map([...native.matchAll(/case ([A-Z_]+):action=("(?:[^"\\]|\\.)*");break;/g)].map(m=>[m[1],JSON.parse(m[2])]));
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs');const runtime=await createRuntime({memory:true,origin:'https://patverparts-bot.github.io'});let browser;const checks=[],errors=[];
 const call=async(route,token,data)=>{const r=await runtime.handle(new Request('https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/'+route,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,data:await r.json()};};
 const login=async user=>{const r=await call('login',null,{login:user,password:'24681012'});assert.equal(r.status,200);return r.data.sessionToken;};
 try{
  const client=await login('zzws-test-dealer'),owner=await login('zzws-test-owner');assert.equal((await call('admin/users',client)).status,403);
  await call('me/state',client,{section:'favorites',version:0,value:['test-002']});await call('me/state',client,{section:'cart',version:0,value:{'test-002':{articul:'test-002',qty:2,addedPrice:101000,addedPriceMode:'WS'}}});
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function pageFor(token){
   const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(token=>sessionStorage.setItem('zzws_session_v3',token),token);
   await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'}));
   await page.route('https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/**',async route=>{const q=route.request(),response=await runtime.handle(new Request(q.url(),{method:q.method(),headers:q.headers(),...(!['GET','HEAD'].includes(q.method())?{body:q.postDataBuffer()}:{} )}));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
   await page.route(site+'**',async route=>{let name=decodeURIComponent(new URL(route.request().url()).pathname).slice('/ZZWS/'.length);if(!name||name.endsWith('/'))name+='index.html';if(name==='js/api-config.js'){await route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:"https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/",publishableKey:"offline-public"};'});return;}const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}await route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
   return page;
  }
  const page=await pageFor(client);await page.goto(site);await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded&&cart['test-002']?.qty===2);assert.deepEqual(await page.evaluate(()=>[...favoritesSet]),['test-002']);checks.push('native cart/favourites are restored by the authenticated website');
  for(const [name,id]of [['SAVED_CARTS','savedCartsPanel'],['SELLER','storefrontTools'],['TECHNICAL','dealerTechFilters']]){
   if(name!=='SAVED_CARTS')await page.evaluate(()=>{closeOrderModal();ZZWS_STOREFRONT.navigate('home');});assert.ok(actions.has(name));await page.evaluate(code=>(0,eval)('(function(){'+code+'})()'),actions.get(name));assert.equal(await page.locator('#'+id).evaluate(n=>n.open),true,name);assert.equal(await page.locator('#'+id).isVisible(),true,name+' panel must be visible from home');assert.equal(await page.locator('#'+id).locator('button,input,select').first().isVisible(),true,name+' controls must be visible');checks.push(name+' opens its actual visible website tool from home');
  }
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
  assert.deepEqual(errors,[]);assert.equal(runtime.reportEmails.length,0);console.log('PASS: '+checks.join('; '));
 }finally{fs.mkdirSync(path.join(root,'output/partner'),{recursive:true});fs.writeFileSync(path.join(root,'output/partner/tools-verification.json'),JSON.stringify({checks,errors,productionMutations:0},null,2));await browser?.close();await runtime.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
