const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const token='a'.repeat(64),errors=[],csp=[];let logouts=0,identityRequests=0,restrictedRequests=0;
 const owner={id:'navigation-admin',role:'admin',adminScope:'owner',login:'demo',client:'Demo admin',active:true,permissions:['orders:read','price:read','users','audit']};
 try{
  async function setup(user=owner){
   const page=await browser.newPage({viewport:{width:1440,height:950}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|Refused to/.test(m.text()))csp.push(m.text());});
   await page.addInitScript(value=>sessionStorage.setItem('zzws_session_v3',value),token);
   await page.route('**/functions/v1/zzws-api/**',async route=>{
    const req=route.request(),name=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={};
    if(name==='me'){identityRequests++;data=user;}
    if(name==='logout'){logouts++;data={ok:true};}
    if(name==='admin/catalog-options')data={pairs:[]};if(name==='admin/price/versions')data={versions:[]};if(name==='admin/users')data={users:[]};
    if(name==='admin/dashboard')data={counts:{new:0},priceVersion:'Test'};
    if(name==='admin/orders')data={orders:[]};if(name==='admin/orders/summary')data={version:'test'};
    if(name.includes('receipt-notifications'))data={events:[],unreadCount:0};if(name.includes('reopens'))data={events:[]};if(name==='admin/audit')data={events:[]};
    if(name==='admin/storage')restrictedRequests++;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });return page;
  }
  const base=process.env.ZZWS_TEST_URL||'http://127.0.0.1:8080/',page=await setup();
  await page.goto(new URL('admin/?lang=ru#tab=manager',base).href,{waitUntil:'domcontentloaded'});await page.locator('#manager').waitFor({state:'visible'});await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
  for(const [tab,label]of Object.entries({orders:'Таблица заказов',catalogControls:'Фильтры и отметки',email:'Настройки почты',operations:'Работоспособность'}))assert.equal((await page.locator('[data-tab="'+tab+'"]').textContent()).trim(),label,'complete Russian navigation label '+tab);
  assert.equal(await page.locator('.admin-navigation').evaluate(el=>/[Ա-և]/.test(el.textContent)),false,'Russian navigation must contain no untranslated Armenian fragments');
  const authenticated=identityRequests;
  await page.goBack();await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('#login').isVisible(),false);assert.equal(await page.locator('#adminBackSection').isDisabled(),true);
  await page.goForward();await page.locator('#manager').waitFor({state:'visible'});
  await page.locator('#managerSearch').fill('unsent search');await page.locator('[data-tab="users"]').click();await page.locator('[data-tab="price"]').click();
  const length=await page.evaluate(()=>history.length);await page.locator('[data-tab="price"]').click();assert.equal(await page.evaluate(()=>history.length),length);
  await page.goBack();await page.locator('#users').waitFor({state:'visible'});assert.equal(await page.locator('#login').isVisible(),false);assert.ok(page.url().endsWith('#tab=users'));
  await page.goBack();await page.locator('#manager').waitFor({state:'visible'});assert.equal(await page.locator('#managerSearch').inputValue(),'unsent search');assert.equal(identityRequests,authenticated);assert.equal(logouts,0);assert.equal(await page.evaluate(()=>sessionStorage.getItem('zzws_session_v3')),token);
  await page.goForward();await page.locator('#users').waitFor({state:'visible'});await page.goForward();await page.locator('#price').waitFor({state:'visible'});
  await page.locator('#adminBackSection').click();await page.locator('#users').waitFor({state:'visible'});
  const beforeReload=await page.evaluate(()=>history.length);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#users').waitFor({state:'visible'});await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));assert.equal(await page.evaluate(()=>history.length),beforeReload);
  await page.locator('#adminBackSection').click();await page.locator('#manager').waitFor({state:'visible'});assert.equal(await page.locator('#login').isVisible(),false);
  const dir=path.resolve(__dirname,'../../work/admin-navigation');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'back-desktop.png')});
  await page.setViewportSize({width:390,height:844});await page.locator('[data-tab="price"]').click();await page.locator('#adminBackSection').click();await page.locator('#manager').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(dir,'back-mobile.png')});
  await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});assert.equal(logouts,1);assert.equal(await page.evaluate(()=>sessionStorage.getItem('zzws_session_v3')),null);await page.goBack();assert.equal(await page.locator('#workspace').isVisible(),false);
  const viewer=await setup({...owner,id:'navigation-viewer',adminScope:'viewer',permissions:['orders:read','price:read']});await viewer.goto(new URL('admin/#tab=storage',base).href,{waitUntil:'domcontentloaded'});await viewer.locator('#dashboard').waitFor({state:'visible'});await viewer.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));assert.equal(restrictedRequests,0);
  await viewer.evaluate(()=>{location.hash='tab=storage';});await viewer.waitForURL('**/#tab=dashboard');assert.equal(await viewer.locator('#storage').isVisible(),false);assert.equal(await viewer.locator('#login').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);console.log('PASS: browser Back/Forward and internal Back restore admin sections, preserve session/search, avoid duplicate entries, survive reload, enforce permissions and keep logout effective; mobile layout passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
