const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..'),site=process.env.ZZWS_TEST_URL||'https://zzws-1z2.pages.dev/';
const navigation=fs.readFileSync(path.join(root,'android/assets/partner-navigation.js'),'utf8');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const token='a'.repeat(64),errors=[],checks=[];let logouts=0;
 const owner={id:'navigation-admin',role:'admin',adminScope:'owner',login:'demo',client:'Demo admin',active:true,permissions:['orders:read','price:read','users','audit']};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(value=>sessionStorage.setItem('zzws_session_v3',value),token);
  // Every request is local fixture data or a workspace asset; no live account/service.
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.includes('/functions/v1/zzws-api/')){
    const name=url.pathname.split('/zzws-api/')[1];let data={};
    if(name==='me')data=owner;if(name==='logout'){logouts++;data={ok:true};}
    if(name==='admin/catalog-options')data={pairs:[]};if(name==='admin/price/versions')data={versions:[]};if(name==='admin/users')data={users:[]};
    if(name==='admin/dashboard')data={counts:{new:0},priceVersion:'Test'};
    if(name==='admin/orders')data={orders:[]};if(name==='admin/orders/summary')data={version:'test'};
    if(name.includes('receipt-notifications'))data={events:[],unreadCount:0};if(name.includes('reopens'))data={events:[]};if(name==='admin/audit')data={events:[]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(!route.request().url().startsWith(site))return route.abort();
   let relative=decodeURIComponent(url.pathname).slice(new URL(site).pathname.length);if(!relative||relative.endsWith('/'))relative+='index.html';
   const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto(site+'admin/#tab=users');await page.locator('#users').waitFor({state:'visible'});await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'android/assets/partner-admin.css'),'utf8')});await page.evaluate(()=>document.body.classList.add('zzws-partner-admin'));
  await page.evaluate(navigation);
  const back=()=>page.evaluate(()=>ZZWS_PARTNER_NAV.back());
  assert.equal(await back(),'root');assert.equal(await page.locator('#users').isVisible(),true);checks.push('direct department entry returns to native hub, without visiting the sign-in bootstrap');
  await page.locator('[data-tab="price"]').click();await page.locator('#price').waitFor({state:'visible'});
  await page.evaluate(()=>selectAdminTab('manager'));await page.locator('#manager').waitFor({state:'visible'});await page.locator('#managerSearch').fill('unsent search');
  await page.locator('[data-tab="price"]').click();await page.locator('#price').waitFor({state:'visible'});
  assert.equal(await back(),'handled');await page.locator('#manager').waitFor({state:'visible'});assert.equal(await page.locator('#managerSearch').inputValue(),'unsent search');
  assert.equal(await back(),'handled');await page.locator('#price').waitFor({state:'visible'});
  assert.equal(await back(),'handled');await page.locator('#users').waitFor({state:'visible'});assert.equal(await back(),'root');checks.push('Back follows visited departments and preserves unsent search');
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='navigationDialog';d.innerHTML='<button>Close</button>';d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();});
  assert.equal(await back(),'handled');await page.locator('#navigationDialog').waitFor({state:'detached'});assert.equal(await page.locator('#users').isVisible(),true);checks.push('Back closes the top dialog before navigating to another department');
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='busyDialog';d.addEventListener('cancel',e=>e.preventDefault());document.body.append(d);d.showModal();});
  assert.equal(await back(),'handled');assert.equal(await page.locator('#busyDialog').evaluate(d=>d.open),true);await page.locator('#busyDialog').evaluate(d=>{d.close();d.remove();});checks.push('a dialog can block Back while its operation is in progress');
  await page.locator('#adminMoreMenu summary').click();assert.equal(await back(),'handled');assert.equal(await page.locator('#adminMoreMenu').evaluate(d=>d.open),false);assert.equal(await back(),'root');checks.push('Back closes More before leaving the tool');
  await page.locator('[data-tab="price"]').click();await page.locator('#price').waitFor({state:'visible'});await page.evaluate(()=>history.replaceState(null,'',location.href));
  assert.equal(await back(),'handled');await page.locator('#users').waitFor({state:'visible'});assert.equal(await back(),'root');checks.push('section Back works independently of browser history metadata');
  await page.evaluate(navigation);assert.equal(await back(),'root');assert.equal(await page.evaluate(()=>sessionStorage.getItem('zzws_session_v3')),token);assert.equal(logouts,0);assert.equal(await page.locator('#login').isVisible(),false);checks.push('repeated injection and root Back preserve the authenticated session');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);
  const directory=path.join(root,'output/primary-718');fs.mkdirSync(directory,{recursive:true});await page.screenshot({path:path.join(directory,'management-navigation.png'),fullPage:true});
  fs.writeFileSync(path.join(directory,'browser-navigation.json'),JSON.stringify({checks,errors,liveRequests:0,logouts},null,2));
  console.log('PASS: '+checks.join('; '));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
