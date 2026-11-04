const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const site=await require('../support/serve-site.cjs')(),base=new URL(site.url),{createRuntime}=await import('../support/runtime.mjs'),runtime=await createRuntime({memory:true,origin:base.origin});let browser;
 const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');
 const rules=defaultRules();rules.cat_trade={...structuredClone(rules.KP),name:'Trade <b>literal</b>',pricing:{...rules.KP.pricing,sources:['ws'],adjustmentPercent:-17,roundTo:1}};
 const configure=async()=>{await runtime.db.exec('reset role');await runtime.db.query('update zzws_state set rules=$1,rules_revision=gen_random_uuid() where id=true',[JSON.stringify(rules)]);await runtime.db.exec('set role service_role');};
 const call=async(route,token,body)=>{const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+route,base),{method:body?'POST':'GET',headers:{origin:base.origin,...(token?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));assert.equal(response.status,200,route+': '+await response.clone().text());return response.json();};
 try{
  await configure();const token=(await call('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken,client=(await call('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken;
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];let orderPosts=0;
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);
  await context.route('**/js/api-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('https://www.zigzag.am/**',route=>route.fulfill({status:404,body:''}));
  await context.route('**/functions/v1/zzws-apk/**',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{const request=route.request();if(new URL(request.url()).pathname.endsWith('/zzws-api/orders')&&request.method()==='POST')orderPosts++;const response=await runtime.handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
  await page.addInitScript(token=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','ru');},token);
  await page.goto(base.href);await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded);assert.equal(await page.evaluate(()=>typeof ZZWS_PRICE_CATEGORIES),'object');
  const catalog=await call('catalog',token),product=catalog.products.find(product=>product.stockPickerPrices?.cat_trade>0);assert.ok(product);assert.notEqual(product.stockPickerPrices.cat_trade,product.wholesale);
  await page.evaluate(sku=>{addToCart(sku);setDirectQty(sku,2);openOrderModal();},product.articul);
  const selector=page.locator('[data-admin-price-mode-select]:visible').last();await selector.selectOption('cat_trade');
  assert.equal(await page.evaluate(()=>adminOrderPriceMode),'cat_trade');assert.equal(await page.evaluate(sku=>getItemWholesalePrice({articul:sku}),product.articul),product.stockPickerPrices.cat_trade);
  assert.equal(await selector.locator('option:checked').textContent(),'Trade <b>literal</b>');assert.equal(await selector.locator('b').count(),0);
  assert.equal(await page.evaluate(sku=>cart[sku].qty,product.articul),2);
  rules.cat_trade.name='Renamed trade category';await configure();await page.evaluate(()=>loadPriceDataSilent());
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-admin-price-mode-select]')].some(select=>select.selectedOptions[0]?.textContent==='Renamed trade category'));assert.equal(await selector.inputValue(),'cat_trade');assert.equal(await page.evaluate(sku=>getItemWholesalePrice({articul:sku}),product.articul),product.stockPickerPrices.cat_trade);
  const saved=rules.cat_trade;delete rules.cat_trade;await configure();await page.evaluate(()=>loadPriceDataSilent());await page.waitForFunction(()=>ZZWS_PRICE_CATEGORIES.choices().every(category=>category.id!=='cat_trade'));
  assert.equal(await selector.inputValue(),'cat_trade');assert.equal(await selector.locator('option:checked').isDisabled(),true);assert.match(await selector.locator('option:checked').textContent(),/Категория недоступна/);assert.equal(await page.evaluate(sku=>getItemWholesalePrice({articul:sku}),product.articul),0);
  rules.cat_trade=saved;rules.cat_new={...structuredClone(saved),name:'New trade group'};await configure();await page.evaluate(()=>loadPriceDataSilent());await page.waitForFunction(()=>ZZWS_PRICE_CATEGORIES.choices().some(category=>category.id==='cat_new'));assert.equal(await selector.locator('option[value=cat_new]').textContent(),'New trade group');assert.equal(await selector.locator('option[value=cat_trade]').isDisabled(),false);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await selector.scrollIntoViewIfNeeded();const output=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'work/remaining-release/price-browser');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'custom-category-mobile.png')});
  const clientCatalog=await call('catalog',client);assert.equal(clientCatalog.priceCategories,undefined);assert.ok(clientCatalog.products.every(product=>product.stockPickerPrices===undefined));
  assert.equal(orderPosts,0);assert.equal((await runtime.db.query('select count(*)::int as count from zzws_orders')).rows[0].count,0);assert.equal(runtime.reportEmails.length,0);assert.equal(runtime.telegramMessages.length,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,actualCandidateApi:true,customCategoryPricing:true,literalLabels:true,renamePreservesIdAndBasket:true,removedCategoryNoFallback:true,newCategoryAppears:true,clientPriceIsolation:true,mobile:true,ordersCreated:0,messagesSent:0,browserErrors:0}));
 }finally{await browser?.close();await runtime.close();await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
