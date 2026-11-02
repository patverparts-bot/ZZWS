const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const local=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')(),site=local||{url:process.env.ZZWS_TEST_URL,close:async()=>{}},browser=await chromium.launch({channel:'msedge',headless:true});
 fs.mkdirSync('output/loading-scenes',{recursive:true});
 const user={id:'scene-client',login:'scene',role:'client',client:'Scene test',sheet:'Dealers',active:true,allBrands:true,rowsList:[{id:'one',organization:'Demo',address:'Test address',contact:'Demo'}]};
 const products=[{articul:'001234',name:'Bosch TEST',brand:'Bosch',category:'Սառնարաններ',wholesale:100,retail:150,hasWholesale:true,stockStatus:'Առկա է'}];
 try{
  async function setup({saved=true,memoryError=false,reduced=false}={}){
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:reduced?'reduce':'no-preference'}),errors=[],violations=[],dialogs=[],requests=[];
   page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);
   page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error: '+e.message);});page.on('console',m=>{if(m.text().includes('Content Security Policy'))violations.push(m.text());});page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
   if(saved)await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
   let releaseCatalog,releaseMemory,releaseOrder,catalogFailure=false,orderFailure=false;
   // Exercise the reviewed candidate against all other current production assets.
   if(process.env.ZZWS_TEST_URL&&process.env.ZZWS_STATIC_OVERLAY){
    const path=require('node:path'),root=path.resolve(process.env.ZZWS_STATIC_OVERLAY),base=new URL(site.url);
    await page.route(new URL('./**',base).href,async route=>{
     const url=new URL(route.request().url());let relative=decodeURIComponent(url.pathname.slice(base.pathname.length));if(!relative||relative.endsWith('/'))relative+='index.html';const file=path.resolve(root,relative);
     if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())await route.fulfill({status:200,body:fs.readFileSync(file),contentType:({'.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream'});
     else await route.fallback();
    });
   }
   await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:404,body:''}));
   await page.route('**/functions/v1/zzws-apk/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({release:{schemaVersion:1,version:'1.0-test',versionCode:1,filename:'ZZWS-test.apk',sha256:'0'.repeat(64),bytes:4,description:''}})}));
   await page.route('**/functions/v1/zzws-api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={},status=200;
    if(path==='me'){data=user;if(!req.headers().authorization){status=401;data={error:'Մուտք գործեք համակարգ'};}}
    if(path==='login')data={...user,sessionToken:'a'.repeat(64)};
    if(path==='me/state'&&req.method()==='GET'){await new Promise(r=>releaseMemory=r);data={versions:{cart:1,favorites:1,preferences:1,draft:1},data:{cart:{},favorites:[],preferences:{},draft:{}}};if(memoryError){status=503;data={error:'Չհաջողվեց թարմացնել տվյալները։'};}}
    if(path==='catalog'){await new Promise(r=>releaseCatalog=r);data={products,account:user,version:'scenes',updated:'02/11/2026'};if(catalogFailure){status=503;data={error:'Catalogue unavailable'};}}
    if(path==='catalog/version')data={version:'scenes'};
    if(path==='orders/receipt-state')data={enabled:false,blocked:false,pendingCount:0,outstanding:[]};
    if(path==='orders/notifications')data={events:[]};if(path==='orders/approval-pending')data={orders:[]};if(path==='dealer/facts')data={items:{}};
    if(path==='me/bulletins')data={bulletins:[],cursor:''};
    if(path==='orders'&&req.method()==='POST'){requests.push(req.postDataJSON());await new Promise(r=>releaseOrder=r);data={id:'order-42',number:42};if(orderFailure){status=503;data={error:'Order unavailable'};}}
    if(path==='orders'&&req.method()==='GET')data={orders:[]};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto(site.url,{waitUntil:'domcontentloaded'});
   const waitFor=async what=>{for(let i=0;i<150;i++){if(what())return;await page.waitForTimeout(20);}throw Error('Expected request not started');};
   const ready=async()=>{await waitFor(()=>releaseCatalog&&releaseMemory);releaseCatalog();releaseMemory();await page.waitForFunction(()=>catalogLoaded&&ZZWS_PAGE_STATE.ready);await page.locator('#sessionLoader').waitFor({state:'hidden'});};
   const prepareOrder=async()=>page.evaluate(()=>{window.ZZWS_CHECKOUT=undefined;cart={'001234':{articul:'001234',qty:1,addedPrice:100,addedPriceMode:'WS'}};updateOrderPanel();document.getElementById('organizationSelect').value='one';});
   return {page,errors,violations,dialogs,requests,waitFor,ready,prepareOrder,releaseCatalog:()=>releaseCatalog(),releaseMemory:()=>releaseMemory(),releaseOrder:()=>releaseOrder(),resetOrder:()=>releaseOrder=null,orderPending:()=>!!releaseOrder,catalogPending:()=>!!releaseCatalog,resetCatalog:()=>releaseCatalog=null,failCatalog:value=>catalogFailure=value,failOrder:value=>orderFailure=value};
  }
  const s=await setup(),p=s.page;await s.waitFor(()=>s.catalogPending());
  assert.equal(await p.locator('#sessionLoadingText').innerText(),'Պատրաստում ենք կատալոգը');
  assert.equal(await p.locator('#sessionSpinner .order-truck').count(),0);
  await p.waitForTimeout(6600);assert.equal(await p.locator('#sessionLoader').isVisible(),true,'loading must survive six seconds');
  assert.equal(await p.locator('#sessionSpinner').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),3);
  await p.screenshot({path:'output/loading-scenes/catalog-hy-phone.png'});
  s.releaseCatalog();await p.waitForTimeout(80);assert.equal(await p.locator('#sessionLoader').isVisible(),true,'catalogue must wait for account restoration');s.releaseMemory();await p.waitForFunction(()=>catalogLoaded&&ZZWS_PAGE_STATE.ready);
  assert.equal(await p.locator('#sessionLoader').isVisible(),false);assert.equal(await p.locator('#sessionSpinner').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  console.log('PASS catalogue lifecycle');
  // Refresh, fail, and retry through the existing catalogue error UI.
  await p.evaluate(()=>ZZWS_STOREFRONT.navigate('catalog'));s.resetCatalog();s.failCatalog(true);await p.evaluate(()=>{window.sceneRefresh=loadPriceData();});await s.waitFor(()=>s.catalogPending());assert.equal(await p.locator('#sessionLoader').isVisible(),true);assert.equal(await p.locator('#skeletonLoader').isVisible(),false);s.releaseCatalog();await p.locator('#dataErrorBox').waitFor();assert.equal(await p.locator('#sessionLoader').isVisible(),false);
  s.resetCatalog();s.failCatalog(false);await p.locator('#dataErrorBox button').click();await s.waitFor(()=>s.catalogPending());s.releaseCatalog();await p.locator('#sessionLoader').waitFor({state:'hidden'});
  console.log('PASS catalogue error and retry');
  // No order scene while the server is pending; exactly one send despite another click.
  await s.prepareOrder();await p.evaluate(()=>{window.sceneSubmit=ZZWS_ORDERS.submit();});await s.waitFor(s.orderPending);await p.evaluate(()=>ZZWS_ORDERS.submit());assert.equal(s.requests.length,1);assert.equal(await p.locator('#orderPreparation').isVisible(),false);
  console.log('PASS pending order');s.releaseOrder();await p.locator('#orderPreparation').waitFor({state:'visible'});assert.equal(s.dialogs.length,0);assert.equal(await p.locator('#orderPreparationTitle').innerText(),'Ձեր պատվերը պատրաստում ենք առաքման');assert.equal(await p.locator('#orderPreparation [data-loading-key=note]').innerText(),'Սպասեք պատվերի հաստատմանը։');
  // Sample the driving phase: the cargo has a constant local position inside its truck.
  async function sample(time){return p.evaluate(time=>{for(const a of document.querySelector('#orderPreparation').getAnimations({subtree:true})){a.pause();a.currentTime=time;}const truck=document.querySelector('.order-truck'),cargo=document.querySelector('.order-cargo'),t=truck.getBoundingClientRect(),c=cargo.getBoundingClientRect();return {x:c.x-t.x,y:c.y-t.y,cargoX:c.x,inside:truck.contains(cargo),transform:getComputedStyle(cargo).transform};},time);}
  const a=await sample(3000),b=await sample(4000);assert.equal(a.inside,true);assert.equal(a.transform,b.transform);assert.ok(Math.abs(a.x-b.x)<.05&&Math.abs(a.y-b.y)<.05);assert.ok(b.cargoX>a.cargoX+10);
  for(const width of [320,390,1280]){await p.setViewportSize({width,height:844});for(const dark of [false,true]){await p.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);const logo=p.locator('#orderPreparation .'+(dark?'session-loader-logo-dark':'session-loader-logo'));assert.equal(await logo.isVisible(),true);assert.equal(await logo.evaluate(e=>e.complete&&e.naturalWidth>0),true);const box=await p.locator('#orderPreparation').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);await p.screenshot({path:`output/loading-scenes/order-${width}-${dark?'dark':'light'}.png`});}}
  await p.evaluate(()=>ZZWS_I18N.setLanguage('ru'));assert.equal(await p.locator('#orderPreparationTitle').innerText(),'Готовим ваш заказ к отгрузке');assert.equal(await p.locator('#orderPreparation [data-loading-key=note]').innerText(),'Ожидайте подтверждения заказа.');await p.evaluate(()=>ZZWS_I18N.setLanguage('hy'));
  await p.locator('#orderPreparation button').click();await p.evaluate(()=>window.sceneSubmit);assert.ok(s.dialogs.some(d=>d.includes('42')));assert.equal(await p.locator('#orderPreparation').isVisible(),false);
  // Failed server sends retain their request ID for retry and never show a scene.
  s.resetOrder();s.failOrder(true);await s.prepareOrder();const failedSubmit=p.evaluate(()=>ZZWS_ORDERS.submit());await s.waitFor(s.orderPending);s.releaseOrder();await failedSubmit;assert.equal(await p.locator('#orderPreparation').isVisible(),false);assert.equal(await p.evaluate(()=>!!sessionStorage.getItem('zzws_order_request_scene-client')),true);
  const retryId=s.requests.at(-1).requestId;s.resetOrder();s.failOrder(false);const retrySubmit=p.evaluate(()=>ZZWS_ORDERS.submit());await s.waitFor(s.orderPending);assert.equal(s.requests.at(-1).requestId,retryId);s.releaseOrder();await p.locator('#orderPreparation').waitFor();await p.waitForTimeout(1400);await p.screenshot({path:'output/loading-scenes/order-loading-phase.png'});await retrySubmit;assert.equal(await p.locator('#orderPreparation').isVisible(),false);assert.equal(await p.evaluate(()=>sessionStorage.getItem('zzws_order_request_scene-client')),null);
  // Version-triggered updates use this same catalogue scene.
  s.resetCatalog();await p.evaluate(()=>{window.sceneRefresh=reloadIfPriceChanged();});await s.waitFor(()=>s.catalogPending());assert.equal(await p.locator('#sessionLoader').isVisible(),true);await p.evaluate(()=>document.documentElement.classList.add('dark'));assert.equal(await p.locator('#sessionLoader .session-loader-logo-dark').isVisible(),true);await p.screenshot({path:'output/loading-scenes/catalog-hy-dark.png'});s.releaseCatalog();await p.evaluate(()=>window.sceneRefresh);assert.equal(await p.locator('#sessionLoader').isVisible(),false);
  // Reduced motion bypasses the scene and retains the existing confirmation.
  const reduced=await setup({reduced:true});await reduced.ready();await reduced.prepareOrder();const reducedSubmit=reduced.page.evaluate(()=>ZZWS_ORDERS.submit());await reduced.waitFor(reduced.orderPending);reduced.releaseOrder();await reducedSubmit;assert.equal(await reduced.page.locator('#orderPreparation').isVisible(),false);assert.ok(reduced.dialogs.some(d=>d.includes('42')));
  const failed=await setup({memoryError:true});await failed.waitFor(()=>failed.catalogPending());failed.releaseCatalog();failed.releaseMemory();await failed.page.locator('#sessionRetryActions').waitFor();assert.equal(await failed.page.locator('#sessionSpinner').isVisible(),false);const error=await failed.page.locator('#sessionLoadingText').innerText();await failed.page.evaluate(()=>ZZWS_I18N.setLanguage('ru'));assert.notEqual(await failed.page.locator('#sessionLoadingText').innerText(),'Подготавливаем каталог');
  // A fresh sign-in uses the same loader; logout cancels a scene without a late confirmation.
  const fresh=await setup({saved:false});await fresh.page.locator('#authScreen').waitFor();await fresh.page.locator('#loginInput').fill('scene');await fresh.page.locator('#passwordInput').fill('test');await fresh.page.locator('[onclick="checkPassword()"]').click();await fresh.waitFor(()=>fresh.catalogPending());assert.equal(await fresh.page.locator('#sessionLoader').isVisible(),true);await fresh.ready();await fresh.prepareOrder();await fresh.page.evaluate(()=>{window.sceneSubmit=ZZWS_ORDERS.submit();});await fresh.waitFor(fresh.orderPending);fresh.releaseOrder();await fresh.page.locator('#orderPreparation').waitFor();await fresh.page.evaluate(()=>lockCatalog());await fresh.page.evaluate(()=>window.sceneSubmit);assert.equal(await fresh.page.locator('#orderPreparation').isVisible(),false);assert.equal(fresh.dialogs.length,0);
  for(const ctx of [s,reduced,failed,fresh]){assert.deepEqual(ctx.errors,[]);assert.deepEqual(ctx.violations,[]);await ctx.page.close();}
  console.log(JSON.stringify({pass:true,checks:'actual catalogue/state lifetime beyond six seconds; refresh/error/retry; success-only server scene; duplicate-send guard; cargo attached during drive; current confirmation; failed send retry ID; HY/RU; local light/dark logos; 320/390/1280px; reduced motion; fresh login and logout cancellation; CSP'}));
 }catch(error){for(const context of browser.contexts())for(const page of context.pages()){console.error(JSON.stringify(await page.evaluate(()=>({ready:window.ZZWS_PAGE_STATE?.ready,catalog:typeof catalogLoaded==='undefined'?null:catalogLoaded,identity:typeof serverIdentity==='undefined'?null:serverIdentity?.id,text:document.getElementById('sessionLoadingText')?.textContent,body:document.body.innerText.slice(-700)}))));await page.screenshot({path:'output/loading-scenes/failed-publication-check.png'}).catch(()=>{});}throw error;}finally{await browser.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
