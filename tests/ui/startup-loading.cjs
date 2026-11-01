const assert=require('node:assert/strict');const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const user={id:'startup-client',login:'startup',role:'client',client:'Startup test',sheet:'Dealers',active:true,allBrands:true,rowsList:[{id:'delivery-one',organization:'Demo',address:'Test address',contact:'Demo'}]};
 const products=[{articul:'001234',name:'Bosch START1',brand:'Bosch',category:'Սառնարաններ',wholesale:100,retail:150,hasWholesale:true,stockStatus:'Առկա է'}];
 async function setup({memoryError=false,freshLogin=false}={}){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));if(!freshLogin)await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  let releaseMemory,releaseCatalog,catalogCount=0;let sawMemory,sawCatalog;const memoryStarted=new Promise(r=>sawMemory=r),catalogStarted=new Promise(r=>sawCatalog=r);
  await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:404,body:''}));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const req=route.request(),name=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={};
   if(name==='me'){if(!req.headers().authorization){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Մուտք գործեք համակարգ'})});return;}data=user;}
   if(name==='login')data={...user,sessionToken:'a'.repeat(64)};
   if(name==='me/bulletins')data={bulletins:[],cursor:''};
   if(name==='me/state'&&req.method()==='GET'){
    await new Promise(r=>{releaseMemory=r;sawMemory();});
    if(memoryError){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Չհաջողվեց թարմացնել տվյալները։'})});return;}
    data={versions:{cart:1,favorites:1,preferences:1,draft:1},data:{cart:{'001234':{articul:'001234',qty:3,addedPrice:100,addedPriceMode:'WS'}},favorites:['001234'],preferences:{theme:'dark'},draft:{organizationSelect:'delivery-one',contactPersonInput:'Saved contact'}}};
   }
   if(name==='catalog'){catalogCount++;await new Promise(r=>{releaseCatalog=r;sawCatalog();});data={products,account:user,version:'startup-test',updated:'02/11/2026'};}
   if(name==='catalog/version')data={version:'startup-test'};
   if(name==='orders/receipt-state')data={enabled:false,blocked:false,pendingCount:0,outstanding:[]};if(name==='orders/notifications')data={events:[]};if(name==='orders/approval-pending')data={orders:[]};if(name==='dealer/facts')data={items:{}};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.ZZWS_TEST_URL,{waitUntil:'domcontentloaded'});
  if(freshLogin){await page.locator('#loginInput').fill('startup');await page.locator('#passwordInput').fill('test-password');await page.locator('[onclick="checkPassword()"]').click();}
  await Promise.race([Promise.all([memoryStarted,catalogStarted]),new Promise((_,reject)=>setTimeout(()=>reject(Error('Catalogue did not start while account state was pending')),5000))]);
  return {page,errors,releaseMemory:()=>releaseMemory(),releaseCatalog:()=>releaseCatalog(),catalogCount:()=>catalogCount};
 }
 const normal=await setup();normal.releaseCatalog();await normal.page.waitForTimeout(100);assert.equal(await normal.page.evaluate(()=>catalogLoaded),false,'fast catalogue must wait for the restored basket');normal.releaseMemory();await normal.page.waitForFunction(()=>catalogLoaded&&ZZWS_PAGE_STATE.ready);
 assert.equal(normal.catalogCount(),1);assert.equal(await normal.page.evaluate(()=>cart['001234'].qty),3);assert.equal(await normal.page.evaluate(()=>favoritesSet.has('001234')),true);assert.equal(await normal.page.locator('#contactPersonInput').inputValue(),'Saved contact');assert.equal(await normal.page.locator('html').evaluate(e=>e.classList.contains('dark')),true);assert.deepEqual(normal.errors,[]);
 const switched=await setup();switched.releaseCatalog();await switched.page.waitForTimeout(100);await switched.page.evaluate(()=>{lockCatalog();sessionStorage.setItem('zzws_session_v3','b'.repeat(64));});switched.releaseMemory();await switched.page.waitForTimeout(150);assert.equal(await switched.page.evaluate(()=>catalogLoaded),false);assert.equal(await switched.page.evaluate(()=>allProducts.length),0);assert.equal(await switched.page.locator('#mainApp').isVisible(),false);assert.deepEqual(switched.errors,[]);
 const failed=await setup({memoryError:true});failed.releaseCatalog();failed.releaseMemory();await failed.page.locator('#sessionRetryActions').waitFor({state:'visible'});assert.equal(await failed.page.evaluate(()=>catalogLoaded),false);assert.deepEqual(failed.errors,[]);
 const login=await setup({freshLogin:true});login.releaseMemory();login.releaseCatalog();await login.page.waitForFunction(()=>catalogLoaded&&ZZWS_PAGE_STATE.ready);assert.equal(login.catalogCount(),1);assert.equal(await login.page.evaluate(()=>cart['001234'].qty),3);assert.deepEqual(login.errors,[]);
 for(const context of [normal,switched,failed,login])await context.page.close();console.log(JSON.stringify({pass:true,checks:'parallel catalogue/state requests after login and reload; single catalogue fetch; restored basket/favourites/draft/theme; no old data after logout/session change; state failure and retry; deferred script dependencies'}));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
