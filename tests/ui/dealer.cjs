const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const {dealerRoutes}=await import('../../supabase/functions/zzws-api/dealer.mjs');
 const {validateMemory}=await import('../../supabase/functions/zzws-api/memory.mjs');
 const savedState={};let preferencesWrites=0;
 const knowledge={products:{}},user={id:'dealer-test',login:'demo',client:'Test dealer',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[]};
 const products=[];
 function add(articul,category,specs,wholesale=98765){const p={articul,name:'Demo '+articul,brand:'Demo',category,retail:199000,wholesale,hasWholesale:wholesale>0,marginVal:20,targetWarehousesStock:2,stockStatus:'Առկա է'};products.push(p);knowledge.products[articul]=[p.name,'https://www.zigzag.am/en/'+articul+'.html','2026-10-30',specs];return p;}
 const standard=[['Dimensions(HxWxD)','85 x 60 x 45 cm'],['Load Capacity (kg)','8'],['Warranty','24 months'],['Spin Speed (RPM)','1200']];
 add('W1','Washing machines',standard);add('W2','Washing machines',standard.map(([k,v])=>[k,k==='Load Capacity (kg)'?'9':v]));add('W3','Washing machines',[['Dimensions(HxWxD)','85 x 60 x 60 cm']]);add('W4','Washing machines',[]);
 add('O1','Ovens',[['Dimensions(HxWxD)','60 x 60 x 56 cm'],['Oven type','Electric']]);add('H1','Hobs',[['Dimensions(HxWxD)','5 x 60 x 52 cm'],['Hob Type','Induction']]);add('X1','Cooker hoods',[['Dimensions(HxWxD)','50 x 60 x 45 cm']]);
 add('H2','Ներկառուցվող (Գազօջախներ)',[['Dimensions(HxWxD)','5 x 60 x 52 cm']]);add('X2','Ներկառուցվող օդաքարշ պահարաններ',[['Dimensions(HxWxD)','50 x 60 x 45 cm']]);
 const history=['a','b','c'].map((user_id,i)=>({id:String(i),user_id,role:'client',status:'received',lines:['O1','H1','X1'].map(articul=>({articul,qty:1,price:123456789}))}));
 const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!(name.startsWith('js/')||['index.html','styles.css','logo.svg','logo-dark.svg','favicon.svg','favicon-32.png','bg-warehouse-login.webp','zigzag-avatar.svg','apple-touch-icon.png'].includes(name))){res.writeHead(404).end();return;}fs.readFile(file,(e,data)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'}).end(data));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[],violations=[];let submitted=0;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|Refused to/.test(m.text()))violations.push(m.text());});
  await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  await page.route('https://www.zigzag.am/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect x="35" y="10" width="90" height="175" rx="8" fill="#eef3fb" stroke="#869ab6"/><circle cx="80" cy="115" r="32" fill="#c9ddff" stroke="#647b9c"/></svg>'}));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const req=route.request(),name=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={};
   if(name==='me')data=user;
   if(name==='me/state'){if(req.method()==='POST'){const payload=req.postDataJSON();savedState[payload.section]=validateMemory(payload.section,payload.value);if(payload.section==='preferences')preferencesWrites++;data={version:preferencesWrites+1};}else data={data:savedState,versions:{}};}
   if(name==='catalog')data={products,version:'dealer-test',updated:'30/10/2026'};
   if(name==='catalog/version')data={version:'dealer-test'};
   if(name==='orders/notifications')data={events:[]};if(name==='orders/receipt-state')data={enabled:false,blocked:false,outstanding:[],pendingCount:0};
   if(name==='orders'&&req.method()==='POST')submitted++;
   if(name.startsWith('dealer/')){
    try{data=await dealerRoutes({path:name,req:{method:req.method()},user,body:async()=>req.postDataJSON(),current:async()=>({products,rules:{}}),project:p=>p,knowledge,json:x=>x,fail:(code,message)=>{throw Object.assign(Error(message),{code});},loadHistory:async()=>history});}
    catch(e){await route.fulfill({status:e.code||500,contentType:'application/json',body:JSON.stringify({error:e.message})});return;}
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>catalogLoaded&&Object.keys(ZZWS_DEALER.facts()).length===9);
  await page.evaluate(()=>{ZZWS_STOREFRONT.navigate('catalog');ZZWS_DEALER.setView('table');toggleMobileFilters(true);});
  await page.locator('[data-dealer-details="W1"]').first().waitFor();
  if(process.env.ZZWS_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.ZZWS_SCREENSHOT_DIR,'13-simplified-catalogue-toolbar.png'),fullPage:true});
  await page.locator('#dealerCardsView').click();assert.equal(await page.locator('#mobileCardsContainer [data-dealer-details]').count(),9);assert.equal(await page.locator('#tableScrollWrapper').isVisible(),false);
  await page.locator('#dealerTableView').click();
  await page.locator('#dealerTechFilters summary').click();await page.locator('#dealerFilterType').selectOption('washer');
  await page.locator('[data-tech-filter="depthMax"]').fill('45');await page.locator('[data-tech-filter="depthMax"]').dispatchEvent('change');
  await page.waitForFunction(()=>filteredProducts.length===2);assert.deepEqual(await page.evaluate(()=>filteredProducts.map(p=>p.articul)),['W1','W2']);
  await page.locator('[data-tech-filter="capacityMin"]').fill('9');await page.locator('[data-tech-filter="capacityMin"]').dispatchEvent('change');await page.waitForFunction(()=>filteredProducts.length===1);
  await page.getByRole('button',{name:'Մաքրել բնութագրերը',exact:true}).click();await page.waitForFunction(()=>filteredProducts.length===9);
  await page.locator('[data-dealer-details="W1"]').first().click();await page.locator('.dealer-product-drawer .dealer-product-hero').waitFor();
  if(process.env.ZZWS_SCREENSHOT_DIR)await page.locator('.dealer-product-drawer').screenshot({path:path.join(process.env.ZZWS_SCREENSHOT_DIR,'14-full-product-card.png')});
  assert.ok((await page.locator('.dealer-product-drawer').innerText()).includes('8'));assert.equal(await page.locator('.dealer-product-drawer a[download]').count(),0);
  await page.locator('.dealer-product-drawer .dealer-buy-row input').fill('2');await page.locator('.dealer-product-drawer').getByRole('button',{name:'Ավելացնել զամբյուղին',exact:true}).click();assert.equal(await page.evaluate(()=>cart.W1.qty),2);
  await page.locator('.dealer-product-drawer .dealer-close').click();
  await page.locator('[data-dealer-compare="W1"]').first().click();await page.locator('[data-dealer-compare="W2"]').first().click();await page.locator('#dealerCompare').click();await page.locator('.dealer-comparison-table').waitFor();
  const allRows=await page.locator('.dealer-comparison-table tbody tr').count();await page.locator('#dealerOnlyDifferences').check();assert.ok(await page.locator('.dealer-comparison-table tbody tr').count()<allRows);
  if(process.env.ZZWS_SCREENSHOT_DIR)await page.locator('.dealer-comparison-dialog').screenshot({path:path.join(process.env.ZZWS_SCREENSHOT_DIR,'15-product-comparison.png')});
  await page.locator('.dealer-comparison-dialog .dealer-close').click();
  await page.locator('#storefrontTools').evaluate(e=>e.open=true);await page.locator('#dealerShowroom').click();await page.locator('.dealer-showroom-card').first().waitFor();await page.waitForFunction(()=>document.querySelectorAll('.dealer-showroom-card input[data-sale-sku]').length===2);
  const showroom=page.locator('.dealer-showroom');const publicText=await showroom.innerText();assert.equal(/98\s?765|Մեծածախ|Եկամտաբերություն|wholesale|KP Price|WS Price/.test(publicText),false);
  assert.equal(await showroom.locator('a[download]').count(),0);await showroom.locator('[data-sale-sku="W1"]').fill('175000');await showroom.locator('[data-sale-qty="W1"]').fill('2');assert.ok((await showroom.locator('.dealer-quote-total').innerText()).replace(/\D/g,'').includes('549000'));
  fs.mkdirSync(path.join(root,'work/dealer-upgrade'),{recursive:true});await page.screenshot({path:path.join(root,'work/dealer-upgrade/showroom-desktop.png')});
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#mainApp').isVisible(),false);assert.equal(await showroom.isVisible(),true);assert.equal(await showroom.locator('.product-technical-trigger').first().isVisible(),true);await page.emulateMedia({media:'screen'});
  await showroom.getByLabel('Առաջարկի անվանում',{exact:true}).fill('Saved showroom offer');await showroom.getByRole('button',{name:'Պահպանել առաջարկը',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zigzag_dealer_offers_dealer-test')||'[]').length===1);
  await showroom.locator('.dealer-close').click();await page.locator('#storefrontTools').evaluate(e=>e.open=true);await page.locator('#dealerOffers').click();await page.getByRole('button',{name:'Բացել առաջարկը',exact:true}).click();await page.locator('.dealer-showroom [data-sale-sku="W1"]').waitFor();assert.equal(await page.locator('.dealer-showroom [data-sale-sku="W1"]').inputValue(),'175000');assert.equal(await page.locator('.dealer-showroom [data-sale-qty="W1"]').inputValue(),'2');
  await showroom.locator('.dealer-close').click();await page.locator('#storefrontTools').evaluate(e=>e.open=true);await page.locator('#dealerBundles').click();await page.getByRole('button',{name:'Ընտրել այս հավաքածուն',exact:true}).waitFor();await page.getByRole('button',{name:'Ընտրել այս հավաքածուն',exact:true}).click();
  await page.locator('[data-bundle-type="hob"]').selectOption('H2');await page.locator('[data-bundle-type="hood"]').selectOption('X2');
  await page.locator('.dealer-bundle-dialog').getByLabel('Հավաքածուի վաճառքի գին (֏)',{exact:true}).fill('400000');
  await page.getByRole('button',{name:'Ավելացնել հավաքածուն զամբյուղին',exact:true}).click();assert.equal(await page.evaluate(()=>cart.O1.qty),1);assert.equal(await page.evaluate(()=>cart.H2.qty),1);assert.equal(await page.evaluate(()=>cart.X2.qty),1);assert.equal(await page.evaluate(()=>cart.W1.qty),2);
  await page.locator('.dealer-bundle-dialog').getByRole('button',{name:'Ցույց տալ գնորդին',exact:true}).click();await page.locator('[data-bundle-sale]').waitFor();assert.ok((await page.locator('.dealer-showroom .dealer-quote-total').innerText()).replace(/\D/g,'').includes('400000'));assert.equal(await page.locator('.dealer-showroom [data-sale-sku]').count(),0);
  await page.locator('.dealer-showroom .dealer-close').click();await page.locator('.dealer-bundle-dialog .dealer-close').click();
  for(const [sku,type]of [['H2','hob'],['X2','hood']]){
   await page.evaluate(sku=>ZZWS_DEALER.openProduct(sku),sku);await page.locator('.dealer-product-drawer').getByRole('button',{name:'Հավաքածու կազմել',exact:true}).waitFor();
   const response=page.waitForResponse(r=>r.url().includes('/dealer/bundles'));
   await page.locator('.dealer-product-drawer').getByRole('button',{name:'Հավաքածու կազմել',exact:true}).click();assert.equal((await response).status(),200);
   assert.equal(await page.locator('[data-bundle-type="'+type+'"]').inputValue(),sku);
   await page.locator('.dealer-bundle-dialog .dealer-close').click();await page.locator('.dealer-product-drawer .dealer-close').click();
  }
  await page.evaluate(()=>openOrderModal());await page.locator('#modalItemsList .basket-item').first().waitFor();const height=await page.locator('#modalItemsList .basket-item').first().evaluate(e=>e.getBoundingClientRect().height);assert.ok(height<160,'compact desktop cart row height '+height);await page.screenshot({path:path.join(root,'work/dealer-upgrade/cart-desktop.png')});await page.evaluate(()=>closeOrderModal());
  await page.setViewportSize({width:390,height:844});await page.locator('#storefrontTools').evaluate(e=>e.open=true);await page.locator('#dealerShowroom').click();await page.locator('.dealer-showroom-card').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await showroom.evaluate(d=>d.scrollWidth>d.clientWidth),false);await page.screenshot({path:path.join(root,'work/dealer-upgrade/showroom-mobile.png')});
  await page.evaluate(()=>lockCatalog());assert.equal(await page.locator('.dealer-dialog').count(),0);assert.deepEqual(await page.evaluate(()=>ZZWS_DEALER.facts()),{});
  assert.ok(preferencesWrites>0);assert.ok(savedState.preferences.dealerOffers.length===1);assert.equal(submitted,0);assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);console.log('Dealer UI passed: verified filters, views, drawer/cart, comparison, showroom privacy/print, saved offers synchronization, historical bundles, responsive layout, logout; no orders submitted.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
