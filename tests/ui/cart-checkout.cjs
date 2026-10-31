const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const user={person:{firstName:'Demo',lastName:'Buyer',phone:'+37499123456',email:'buyer@example.am'},customerId:'checkout-user',clientRole:'manager',id:'checkout-user',profileRevision:7,role:'client',login:'checkout',client:'Demo customer',sheet:'Dealers',active:true,allBrands:true,rowsList:[{id:'11111111-1111-4111-8111-111111111111',organization:'Demo organisation',address:'Demo address',contact:'Demo contact'},{id:'22222222-2222-4222-8222-222222222222',organization:'Second organisation',address:'Second address',contact:'Second contact'}]};
 const products=['001','002','003'].map((articul,i)=>({articul,name:'Demo model '+articul,brand:'Demo',category:'Washing machines',retail:(i+1)*1500,wholesale:(i+1)*1000,stockStatus:'Առկա է',hasWholesale:true,marginVal:20,targetWarehousesStock:2}));
 const errors=[],csp=[],posts=[],orders=new Map();let failNext=false,delayNext=false;
 fs.mkdirSync(path.join(root,'work/cart-checkout'),{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|Refused to/.test(m.text()))csp.push(m.text());});page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:404,body:''}));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const req=route.request(),name=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={};
   if(name==='me')data=user;if(name==='me/state')data=req.method()==='POST'?{version:req.postDataJSON().version+1}:{data:{},versions:{}};if(name==='me/carts')data={carts:[]};
   if(name==='catalog')data={products,version:'checkout-test',updated:'30/10/2026'};if(name==='catalog/version')data={version:'checkout-test'};
   if(name==='orders/notifications')data={events:[]};if(name==='orders/receipt-state')data={enabled:false,blocked:false,outstanding:[],pendingCount:0};
   if(name==='orders/quote')data={products:products.filter(p=>req.postDataJSON().articuls.includes(p.articul)),unavailable:[]};
   if(name==='dealer/facts')data={items:{}};
   if(name==='orders'&&req.method()==='GET')data={orders:[]};
   if(name==='orders'&&req.method()==='POST'){
    const payload=req.postDataJSON();assert.equal(payload.profileRevision,7);assert.ok(user.rowsList.some(r=>r.id===payload.deliveryVariantId));posts.push(payload);
    if(delayNext){delayNext=false;await new Promise(r=>setTimeout(r,250));}
    if(failNext){failNext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test error'})});return;}
    if(!orders.has(payload.requestId))orders.set(payload.requestId,{id:'order-'+orders.size,number:orders.size+1});data=orders.get(payload.requestId);
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.ZZWS_TEST_URL||'http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>catalogLoaded&&displayedCount===3);
  await page.evaluate(()=>{setDirectQty('001',2);setDirectQty('002',3);setDirectQty('003',1);openOrderModal();});
  const modal=page.locator('#orderModal');assert.equal(await modal.getAttribute('data-checkout-step'),'1');assert.equal(await page.locator('#checkoutStage2').isVisible(),false);assert.equal(await page.locator('#submitServerOrder').isVisible(),false);
  assert.equal(await page.locator('[data-checkout-art]').count(),3);await page.locator('[data-checkout-art="002"]').uncheck();assert.equal((await page.locator('#modalTotalSum').innerText()).replace(/\D/g,''),'5000');
  assert.equal(await page.evaluate(()=>buildEmailFormattedText().includes('Demo model 002')),false);assert.equal(await page.evaluate(()=>Object.keys(cart).length),3);
  await page.locator('#checkoutSelectAll').check();await page.locator('#checkoutSelectAll').uncheck();await page.locator('#checkoutNext').click();assert.equal(await modal.getAttribute('data-checkout-step'),'1');assert.ok((await page.locator('#checkoutNotice').innerText()).length>0);assert.equal(posts.length,0);
  await page.locator('[data-checkout-art="001"]').check();await page.locator('[data-checkout-art="003"]').check();
  await modal.getByRole('button',{name:'Ավելացնել կատալոգից',exact:true}).click();assert.equal(await modal.isVisible(),false);await page.evaluate(()=>openOrderModal());assert.equal(await page.locator('[data-checkout-art="002"]').isChecked(),false);
  await modal.getByRole('button',{name:'Ավելացնել ցանկից',exact:true}).click();await page.locator('#bulkAddInput').fill('002\t1');await page.evaluate(()=>{previewBulkAdd();confirmBulkAdd();});assert.equal(await page.locator('#modalItemsList [data-act="mqty-input"][data-art="002"]').inputValue(),'4');assert.equal(await page.locator('[data-checkout-art="002"]').isChecked(),false);await page.locator('#modalItemsList [data-act="mqty-input"][data-art="002"]').fill('3');await page.locator('#modalItemsList [data-act="mqty-input"][data-art="002"]').dispatchEvent('change');
  await page.evaluate(()=>{ZZWS_CHECKOUT.go(1);document.activeElement?.blur();document.getElementById('modalBody').scrollTop=0;});await page.screenshot({path:path.join(root,'work/cart-checkout/step-1-desktop.png')});
  await page.locator('#checkoutNext').click();assert.equal(await modal.getAttribute('data-checkout-step'),'2');assert.equal(await page.locator('#modalItemsList').isVisible(),false);assert.equal(await page.locator('#contactPersonInput').isVisible(),true);assert.equal(posts.length,0);
  assert.equal(await page.locator('#contactPersonInput').isEditable(),true);assert.equal(await page.locator('#deliveryAddressInput').isEditable(),true);assert.equal(await page.locator('#contactPersonInput').inputValue(),'Demo contact');assert.equal(await page.locator('#deliveryAddressInput').inputValue(),'Demo address');await page.locator('#organizationSelect').selectOption(user.rowsList[1].id);assert.equal(await page.locator('#deliveryAddressInput').inputValue(),'Second address');assert.equal(await page.locator('#contactPersonInput').inputValue(),'Second contact');await page.locator('#organizationSelect').selectOption(user.rowsList[0].id);assert.equal(await page.locator('#deliveryAddressInput').inputValue(),'Demo address');assert.equal(await page.locator('#contactPersonInput').inputValue(),'Demo contact');
  await page.locator('#deliveryMethodInput').selectOption('Ինքնաառաքում');await page.locator('#orderCommentInput').fill('Keep this comment');
  await page.evaluate(()=>closeOrderModal());await page.evaluate(()=>openOrderModal());assert.equal(await modal.getAttribute('data-checkout-step'),'2');assert.equal(await page.locator('#orderCommentInput').inputValue(),'Keep this comment');
  await page.evaluate(()=>{ZZWS_CHECKOUT.go(2);document.activeElement?.blur();document.getElementById('modalBody').scrollTop=0;});await page.screenshot({path:path.join(root,'work/cart-checkout/step-2-desktop.png')});
  await page.evaluate(()=>ZZWS_CHECKOUT.go(1));await page.locator('#checkoutQuickReview').click();assert.equal(await modal.getAttribute('data-checkout-step'),'3');assert.equal(await page.locator('#checkoutReview .checkout-review-table tbody tr').count(),2);assert.equal(await page.locator('#checkoutReview').innerText().then(t=>t.includes('Demo model 002')),false);assert.equal(posts.length,0);
  fs.mkdirSync(path.join(root,'work/cart-checkout'),{recursive:true});await page.screenshot({path:path.join(root,'work/cart-checkout/step-3-desktop.png')});
  // A changed current price must be reviewed again before any request is made.
  await page.evaluate(()=>{getProduct('001').wholesale=1100;});await page.locator('#submitServerOrder').click();assert.equal(posts.length,0);assert.ok((await page.locator('#checkoutNotice').innerText()).includes('փոխվել'));
  products[0].wholesale=1100;delayNext=true;await page.locator('#submitServerOrder').click();await page.waitForFunction(()=>ZZWS_CHECKOUT.busy);assert.equal(await page.locator('#checkoutBack').isDisabled(),true);await page.evaluate(()=>ZZWS_ORDERS.submit());await modal.waitFor({state:'hidden'});
  assert.equal(posts.length,1);assert.deepEqual(posts[0].lines.map(i=>i.articul),['001','003']);assert.equal(posts[0].delivery.organization,'Demo organisation');assert.equal(posts[0].delivery.contact,'Demo contact');assert.equal(posts[0].lines[0].unitPrice,1100);
  assert.deepEqual(await page.evaluate(()=>Object.keys(cart)),['002']);assert.equal(await page.evaluate(()=>cart['002'].qty),3);
  // A failed send retains both steps and the same idempotency key for retry.
  await page.evaluate(()=>{closePersonalCabinet();openOrderModal();});await page.locator('#checkoutSelectAll').check();await page.locator('#checkoutNext').click();await page.locator('#checkoutNext').click();failNext=true;const failedResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/orders')&&r.status()===503);await page.locator('#submitServerOrder').click();await failedResponse;await page.waitForFunction(()=>!ZZWS_CHECKOUT.busy&&document.getElementById('orderModal').dataset.checkoutStep==='3');assert.equal(posts.length,2);assert.equal(await page.evaluate(()=>cart['002'].qty),3);
  await page.locator('#submitServerOrder').click();await modal.waitFor({state:'hidden'});assert.equal(posts.length,3);assert.equal(posts[1].requestId,posts[2].requestId);assert.equal(orders.size,2);assert.deepEqual(await page.evaluate(()=>cart),{});
  // Responsive preparation/data/review layout and subset-only spreadsheet export.
  await page.evaluate(()=>{closePersonalCabinet();setDirectQty('001',1);setDirectQty('002',1);openOrderModal();});await page.setViewportSize({width:390,height:844});await page.locator('[data-checkout-art="002"]').uncheck();await page.evaluate(()=>{document.activeElement?.blur();document.getElementById('modalBody').scrollTop=0;});await page.screenshot({path:path.join(root,'work/cart-checkout/step-1-mobile.png')});
  assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);await page.locator('#checkoutNext').click();await page.locator('#deliveryMethodInput').selectOption('Առաքում');assert.equal(await page.locator('#contactPersonInput').inputValue(),'Demo contact');assert.equal(await page.locator('#deliveryAddressInput').inputValue(),'Demo address');await page.evaluate(()=>{document.activeElement?.blur();document.getElementById('modalBody').scrollTop=0;});await page.screenshot({path:path.join(root,'work/cart-checkout/step-2-mobile.png')});await page.locator('#checkoutNext').click();
  await page.screenshot({path:path.join(root,'work/cart-checkout/step-3-mobile.png')});
  assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  products[0].wholesale=1250;await page.locator('#submitServerOrder').click();await page.waitForFunction(()=>document.getElementById('orderModal').dataset.checkoutStep==='1');assert.equal(posts.length,3);assert.equal(await page.evaluate(()=>getProduct('001').wholesale),1250);await page.locator('#checkoutQuickReview').click();
  await page.evaluate(()=>{window.__excel=null;XLSX.writeFile=(book)=>{window.__excel=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1});};generateAndDownloadExcel();});
  const excel=await page.evaluate(()=>window.__excel);assert.ok(excel.some(row=>row[0]==='001'));assert.equal(excel.some(row=>row[0]==='002'),false);assert.equal(posts.length,3);
  await page.evaluate(()=>{keepCartAndCloseSuccess();openOrderModal();lockCatalog();});assert.equal(await modal.isVisible(),false);assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);
  console.log('PASS: three checkout steps, subset selection, preserved draft, buyer validation, reviewed prices, final-only send, double-submit guard, unselected cart retention, idempotent retry, mobile layout and subset exports.');
 }catch(error){console.error(JSON.stringify({browserErrors:errors,csp}));throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
