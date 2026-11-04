/* Real isolated administration: navigation/layout only, with all browser POSTs
   blocked. ZZWS_STATIC_OVERLAY and ZZWS_API_SOURCE_ROOT select reviewed source. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cached=path.join(process.env.USERPROFILE||'C:/Users/levon','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||(fs.existsSync(cached)?cached:'playwright'));
const root=path.resolve(__dirname,'../..');
const groups={orders:['templates','proposalManagement'],catalog:['catalogControls','warehouses','rules','offers'],settings:['orderSettings','email'],app:['apkDownloads','mobileApp'],system:['operations','assistantHistory','audit','storage','systemDataReset'],account:['accountSettings']};
const allowed={owner:new Set(['dashboard','manager','orders','price','users',...Object.values(groups).flat()]),manager:new Set(['manager','orders','templates','accountSettings']),price:new Set(['price','offers','accountSettings'])};
const menuSelector='#adminMoreMenu',panelSelector='#adminMoreMenu > .admin-more-items.admin-category-panel';
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs');
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')();
 const base=new URL(process.env.ZZWS_TEST_URL||site.url),runtime=await createRuntime({memory:true,debug:true,origin:base.origin,sourceRoot:process.env.ZZWS_API_SOURCE_ROOT});
 const {createTrackedApkRuntime}=await import('../support/apk-runtime.mjs'),apk=createTrackedApkRuntime(runtime,{origin:base.origin});
 const output=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'output/admin-menu');fs.mkdirSync(output,{recursive:true});
 const errors=[],posts=[],checks=[],screenshots=[],sessions={};let browser;
 const direct=async(route,token,value)=>{
  const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+route,base),{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));
  const data=await response.json();assert.equal(response.status,200,route+': '+JSON.stringify(data));return data;
 };
 const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 async function open(page){
  const menu=page.locator(menuSelector);if(!await menu.evaluate(node=>node.open))await menu.locator(':scope > summary').click();
  await page.locator(panelSelector).waitFor({state:'visible'});await frames(page);
 }
 async function closed(page){await page.waitForFunction(()=>!document.getElementById('adminMoreMenu').open);}
 async function choose(page,key){await open(page);const tab=page.locator('.admin-menu-category[data-menu-category="'+key+'"]');await tab.click();await frames(page);assert.equal(await tab.getAttribute('aria-selected'),'true',key+' selected');}
 async function navigate(page,id){
  assert.equal(await page.locator('[data-tab="'+id+'"]').count(),1,'One canonical navigation destination '+id);
  await page.evaluate(value=>ZZWS_ADMIN_MENU.reveal(value),id);await open(page);
  const button=page.locator('[data-tab="'+id+'"]');await button.click();await closed(page);
  await page.locator('#'+id).waitFor({state:'visible'});
  await page.waitForFunction(value=>window.ZZWS_ADMIN_VIEW_STATE?.current===value&&window.ZZWS_ADMIN_VIEW_STATE.ready,id);
  assert.equal(await button.getAttribute('aria-current'),'page','Actual handler selected '+id);
  if(id==='proposalManagement'){
   const dialog=page.locator('#proposalManagementDialog');await dialog.waitFor({state:'visible'});
   await dialog.getByRole('button',{name:/^(Փակել|Закрыть)$/}).click();await dialog.waitFor({state:'hidden'});
  }
 }
 async function bounds(page,label){
  const geometry=await page.locator(panelSelector).evaluate(panel=>{const r=panel.getBoundingClientRect(),s=getComputedStyle(panel);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth,overflowY:s.overflowY,viewportWidth:innerWidth,viewportHeight:innerHeight};});
  assert.ok(geometry.width>100&&geometry.height>100,label+': open menu has useful dimensions');
  assert.ok(geometry.x>=-1&&geometry.y>=-1&&geometry.right<=geometry.viewportWidth+1&&geometry.bottom<=geometry.viewportHeight+1,label+': popup stays inside viewport: '+JSON.stringify(geometry));
  assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,label+': popup does not clip horizontal content');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+': document does not overflow');
  return geometry;
 }
 async function categoryGeometry(page,label,expectedCount){
  const tiles=await page.locator('.admin-menu-category').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).map(node=>{const r=node.getBoundingClientRect();return {key:node.dataset.menuCategory,width:r.width,height:r.height,top:r.top,left:r.left,clientWidth:node.clientWidth,scrollWidth:node.scrollWidth,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,tone:node.dataset.actionTone||null,text:node.textContent.trim()};}));
  assert.equal(tiles.length,expectedCount,label+': permitted category count');
  const widths=tiles.map(tile=>tile.width),heights=tiles.map(tile=>tile.height);
  assert.ok(Math.max(...widths)-Math.min(...widths)<=1,label+': category widths are equal');assert.ok(Math.max(...heights)-Math.min(...heights)<=1,label+': category heights are equal');
  assert.ok(tiles.every(tile=>tile.text&&tile.scrollWidth<=tile.clientWidth+1&&tile.scrollHeight<=tile.clientHeight+1),label+': category labels fit without clipping');
  assert.ok(tiles.every(tile=>tile.tone===null),label+': category tabs retain navigation styling');
  const grid=await page.locator('.admin-menu-categories').evaluate(node=>{const s=getComputedStyle(node);return {rowGap:parseFloat(s.rowGap),columnCount:s.gridTemplateColumns.split(' ').length};});
  const tops=[...new Set(tiles.map(tile=>Math.round(tile.top*100)/100))].sort((a,b)=>a-b);
  for(let i=1;i<tops.length;i++)assert.ok(Math.abs((tops[i]-tops[i-1])-heights[0]-grid.rowGap)<=1,label+': category rows use their declared compact gap');
  return tiles;
 }
 async function groupPanel(page,key,role,label){
  await choose(page,key);const expected=groups[key].filter(id=>allowed[role].has(id)),panel=page.locator('#admin-menu-destinations-'+key);
  const visiblePanels=await page.locator(menuSelector+' [role=tabpanel]').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden').map(node=>node.id));
  assert.deepEqual(visiblePanels,['admin-menu-destinations-'+key],label+': exactly one destination panel is visible');
  assert.deepEqual(await panel.locator(':scope > [data-tab]').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).map(node=>node.dataset.tab)),expected,label+': semantic destinations '+key);
  const sizes=await panel.evaluate(node=>{const s=getComputedStyle(node);return {inner:node.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,overflowY:s.overflowY};});
  if(sizes.scrollHeight>sizes.clientHeight+1)assert.ok(['auto','scroll'].includes(sizes.overflowY),label+': overflow remains scrollable');
  const last=panel.locator(':scope > [data-tab]:not([hidden])').last();
  if(expected.length%2===1){assert.equal(await last.evaluate(node=>node.classList.contains('admin-menu-destination-wide')),true,label+': last odd destination spans grid');const box=await last.boundingBox();assert.ok(Math.abs(box.width-sizes.inner)<=1,label+': last odd destination is full width');}
  else assert.equal(await panel.locator(':scope > .admin-menu-destination-wide:not([hidden])').count(),0,label+': even destination count has no special wide row');
  await last.scrollIntoViewIfNeeded();await frames(page);
  const clipping=await last.evaluate(node=>{const p=node.parentElement.getBoundingClientRect(),r=node.getBoundingClientRect();return {horizontal:node.scrollWidth>node.clientWidth+1,text:node.scrollHeight>node.clientHeight+1,reachable:r.top>=p.top-1&&r.bottom<=p.bottom+1};});
  assert.equal(clipping.horizontal,false,label+': destination text does not overflow horizontally');assert.equal(clipping.text,false,label+': destination text fits its button');assert.equal(clipping.reachable,true,label+': last destination can be reached within scroll panel');
  await bounds(page,label);return expected;
 }
 try{
  const tokens={};for(const role of Object.keys(allowed))tokens[role]=(await direct('login',null,{login:'zzws-test-'+role,password:'24681012'})).sessionToken;
  const initialOrders=Number((await runtime.db.query('select count(*)::int n from zzws_orders')).rows[0].n);
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const role of Object.keys(allowed)){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(20000);
   await context.addInitScript(token=>{sessionStorage.clear();sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','hy');},tokens[role]);
   await context.route('**/js/api-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
   for(const service of ['zzws-api','zzws-apk'])await context.route('**/functions/v1/'+service+'/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='POST'){posts.push({role,service,path:url.pathname});await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'Navigation test blocks all browser POST requests'})});return;}
    const response=await(service==='zzws-api'?runtime:apk).handle(new Request(request.url(),{method:request.method(),headers:request.headers()}));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(role+': '+error.message));await page.goto(new URL('admin/',base).href);await page.locator('#workspace').waitFor({state:'visible'});await page.waitForFunction(()=>window.ZZWS_ADMIN_MENU&& !document.documentElement.hasAttribute('data-session-pending'));
   sessions[role]={page,context};
   const actual=await page.locator('[data-tab]').evaluateAll(nodes=>nodes.map(node=>({id:node.dataset.tab,hidden:node.hidden}))),expectedAll=[...allowed.owner].sort();
   assert.deepEqual(actual.map(item=>item.id).sort(),expectedAll,role+': original canonical destination IDs are unique and preserved');
   assert.equal(await page.locator('#adminOrdersHub .orders-view-switch > [data-tab=orders]').count(),1,role+': canonical table-view button remains in the orders hub');
   assert.equal(await page.locator(menuSelector+' [data-tab=orders]').count(),0,role+': More does not steal the table-view button');
   for(const item of actual){assert.equal(!item.hidden,allowed[role].has(item.id),role+': button permission '+item.id);assert.equal(await page.evaluate(id=>ZZWS_ADMIN_HOME.can(id),item.id),allowed[role].has(item.id),role+': route permission '+item.id);}
   const permittedKeys=Object.keys(groups).filter(key=>groups[key].some(id=>allowed[role].has(id)));
   await open(page);assert.deepEqual(await page.locator('.admin-menu-category').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).map(node=>node.dataset.menuCategory)),permittedKeys,role+': only permitted categories remain');
   await categoryGeometry(page,role,permittedKeys.length);for(const key of permittedKeys)await groupPanel(page,key,role,role+' '+key);
   await page.keyboard.press('Escape');await closed(page);assert.equal(await page.locator(menuSelector+' > summary').evaluate(node=>node===document.activeElement),true,role+': Escape restores focus');
   await open(page);await page.mouse.click(2,2);await closed(page);
   checks.push(role+': exact semantic IDs, role permissions, one panel, equal categories, odd row width, Escape and outside close');
  }
  const owner=sessions.owner.page;
  for(const embedded of [false,true]){
   if(embedded){await owner.addStyleTag({content:fs.readFileSync(path.join(root,'android/assets/partner-admin.css'),'utf8')});await owner.evaluate(()=>document.body.classList.add('zzws-partner-admin'));}
   for(const language of ['hy','ru'])for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:640}]){
    await owner.setViewportSize(viewport);await owner.evaluate(value=>ZZWS_I18N.setLanguage(value),language);await open(owner);
    const label=(embedded?'embedded':'web')+' '+language+' '+viewport.width+'x'+viewport.height;
    await categoryGeometry(owner,label,6);for(const key of Object.keys(groups))await groupPanel(owner,key,'owner',label+' '+key);
    await choose(owner,'system');const screenshot=(embedded?'embedded':'web')+'-'+language+'-'+viewport.width+'.png',filename=path.join(output,screenshot);await owner.screenshot({path:filename});screenshots.push(filename);
    checks.push(label+': menu open with six equal categories; every semantic panel fits and scrolls');
    await owner.keyboard.press('Escape');await closed(owner);
   }
  }
  // Real destination buttons exercise their existing navigation handlers. No
  // form is submitted, file uploaded, APK published or business request sent.
  await owner.setViewportSize({width:1440,height:1000});
  for(const role of Object.keys(allowed))for(const id of Object.values(groups).flat().filter(id=>allowed[role].has(id)))await navigate(sessions[role].page,id);
  await owner.locator('[data-tab=manager]').click();await owner.locator('#manager').waitFor({state:'visible'});await owner.locator('#adminOrdersHub [data-tab=orders]').click();await owner.locator('#orders').waitFor({state:'visible'});
  assert.deepEqual(posts,[],'Navigation does not submit business, credential, mail or publication POSTs');assert.deepEqual(errors,[],'No page JavaScript errors');assert.equal(runtime.reportEmails.length,0,'No mail was sent');assert.equal(Number((await runtime.db.query('select count(*)::int n from zzws_orders')).rows[0].n),initialOrders,'No order was created');
  const verification={passed:true,source:{staticOverlay:process.env.ZZWS_STATIC_OVERLAY||null,apiSourceRoot:process.env.ZZWS_API_SOURCE_ROOT||'workspace API',url:base.href},fixtures:'Only seeded owner/manager/price logins in ephemeral PGlite; no business fixtures or production writes',checks,screenshots,browserPosts:posts,ordersCreated:0,externalMailSent:0,errors};fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(verification,null,2));
  console.log('PASS: real owner/manager/price navigation, six equal category tiles, exact grouped IDs, role gates, keyboard/outside close, all destination handlers, HY/RU desktop/mobile/embedded geometry; no business POSTs, orders or mail.');
 }finally{await browser?.close();await runtime.close();if(site)await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
