const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const {default:XLSX}=await import('../../supabase/functions/zzws-api/vendor/xlsx.mjs');const {clientOrderWorkbook}=await import('../../supabase/functions/zzws-api/client-order-export.mjs');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const uuid=n=>'12345678-1234-4123-8123-'+String(n).padStart(12,'0'),user={id:uuid(200),login:'export.client',role:'client',clientRole:'employee',customerId:uuid(200),client:'Export test',sheet:'Dealers',active:true,allBrands:true,rowsList:[]};
 const products=[{articul:'001234',name:'Bosch EXPORT1',brand:'Bosch',category:'Սառնարաններ',wholesale:70,retail:100,stockStatus:'Առկա է',hasWholesale:true}];
 const orders=Array.from({length:61},(_,i)=>({id:uuid(i+1),user_id:user.id,customer_id:user.id,number:i+1,status:['new','confirmed','in_progress','completed','rejected','received'][i%6],revision:2,created:'2026-11-01T08:00:00Z',updated:'2026-11-01T09:00:00Z',customer:{client:'Export test',customerCode:'000123',author:{firstName:'Export',lastName:'Sender'}},delivery:{organization:'Branch',address:'Delivery address',phone:'+37400123456'},lines:[{articul:'001234',name:'Bosch EXPORT1',qty:2,unitPrice:70}],original_lines:[{articul:'001234',name:'Bosch EXPORT1',qty:1,unitPrice:60}],total:140})).reverse();
 let failNext=false,holdNext=false,releaseHeld,heldReady;const exports=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});page.on('pageerror',e=>errors.push(e.stack||e.message));await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:404,body:''}));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/zzws-api/')[1],post=()=>request.postDataJSON();let data={};
   if(name==='me')data=user;if(name==='catalog')data={products,version:'export-test',updated:'01/11/2026'};if(name==='catalog/version')data={version:'export-test'};
   if(name==='me/state')data=request.method()==='POST'?{version:1}:{data:{},versions:{}};
   if(name==='orders/receipt-state')data={enabled:false,blocked:false,outstanding:[],pendingCount:0};if(name==='orders/notifications')data={events:[]};
   if(name==='me/bulletins')data={bulletins:[],items:[],cursor:''};
   if(name==='orders'){const before=Number(url.searchParams.get('before')||Infinity);data={orders:orders.filter(o=>o.number<before).slice(0,50)};}
   if(name==='orders/detail')data={order:orders.find(o=>o.id===post().id),events:[]};
   if(name==='orders/export'){
    const p=post();exports.push(p);if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;heldReady?.();});}
    if(failNext){failNext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Չհաջողվեց պատրաստել ֆայլը։ Կրկին փորձեք։'})});return;}
    const selected=p.id?orders.filter(o=>o.id===p.id):orders,workbook=clientOrderWorkbook(selected,{locale:p.locale,filters:p.filters||{},single:!!p.id});
    const book=XLSX.utils.book_new();for(const tab of workbook.sheets)XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(tab.rows),tab.name);
    await route.fulfill({status:200,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="'+workbook.filename+'"','Access-Control-Expose-Headers':'Content-Disposition'},body:Buffer.from(XLSX.write(book,{type:'buffer',bookType:'xlsx'}))});return;
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.ZZWS_TEST_URL,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>catalogLoaded&&allProducts.length===1);await page.evaluate(()=>openPersonalCabinet());await page.locator('.server-order-card').first().waitFor();
  assert.equal(await page.locator('.server-order-card').count(),50);
  const download=async locator=>{let d;try{[d]=await Promise.all([page.waitForEvent('download',{timeout:8000}),locator.click()]);}catch(error){console.error(JSON.stringify({errors,notice:await page.locator('#orderExportNotice').innerText(),exports}));throw error;}const book=XLSX.read(fs.readFileSync(await d.path()),{type:'buffer'});await page.waitForFunction(()=>!document.getElementById('downloadAllOrders').disabled);return {book,d};};
  const all=await download(page.locator('#downloadAllOrders'));assert.equal(all.d.suggestedFilename(),'ZZWS-Orders.xlsx');assert.equal(XLSX.utils.sheet_to_json(all.book.Sheets[all.book.SheetNames[0]],{header:1}).length,62);assert.equal(exports[0].id,undefined);assert.equal(exports[0].filters,undefined);
  await page.locator('.server-order-card>summary').first().click();await page.locator('[data-export-order]').first().waitFor();
  const one=await download(page.locator('[data-export-order]').first());assert.equal(one.d.suggestedFilename(),'ZZWS-Order-61.xlsx');const rows=XLSX.utils.sheet_to_json(one.book.Sheets[one.book.SheetNames[1]],{header:1});assert.equal(rows.length,2);assert.equal(rows[1][2],'001234');assert.equal(rows[1][5],70);assert.equal(rows[1][6],140);
  const before=exports.length;await page.locator('.orders-search-panel>summary').click();await page.locator('#serverOrderFrom').fill('2026-11-01');await page.locator('#serverOrderSearchForm button[type="submit"]').click();await page.locator('#downloadFilteredOrders').waitFor({state:'visible'});
  await page.locator('#serverOrderFrom').fill('2026-12-01');await download(page.locator('#downloadFilteredOrders'));assert.equal(exports[before].filters.from,'2026-11-01','export uses applied filters, not an unsubmitted date');
  failNext=true;await page.locator('#downloadAllOrders').click();await page.waitForFunction(()=>!document.getElementById('downloadAllOrders').disabled);assert.ok((await page.locator('#orderExportNotice').innerText()).includes('Կրկին փորձեք'));
  await page.locator('.orders-search-panel>summary').click();await page.locator('.server-order-card').first().evaluate(el=>el.open=true);await page.locator('[data-export-order]').first().waitFor();
  for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.cabinet-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);if(width===390)await page.screenshot({path:path.join(__dirname,'../../work/client-order-export/mobile.png')});}
  await page.evaluate(()=>ZZWS_I18N.setLanguage('ru'));assert.equal(await page.locator('#downloadAllOrders').innerText(),'Скачать данные');
  const held=new Promise(resolve=>heldReady=resolve);holdNext=true;await page.locator('#downloadAllOrders').click();await held;await page.evaluate(()=>lockCatalog());releaseHeld();await page.waitForTimeout(200);assert.equal(await page.locator('#orderExportNotice').innerText(),'');assert.equal(await page.locator('#downloadAllOrders').isVisible(),false);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,checks:'single/all/filtered XLSX; 61 orders beyond visible 50; original/current prices; leading zeros; error and retry controls; mobile/desktop; RU/HY; no late download after logout',requests:exports.length}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
