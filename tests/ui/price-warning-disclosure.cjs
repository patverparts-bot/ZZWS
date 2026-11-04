const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const site=await require('../support/serve-site.cjs')();let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1000,height:700}}),errors=[];let apiCalls=0;page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/functions/v1/'))apiCalls++;});
  await page.route('**/warning-harness**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/admin/style.css"><script src="/js/i18n-dictionary.js"></script><script src="/admin/price-review-i18n.js"></script><script src="/js/i18n.js"></script><main><details><summary>Գների կտրուկ փոփոխություններ՝ 30% և ավելի</summary><div id="priceWarnings"></div></details><div id="sample"></div><button id="outside">Outside</button></main><script>window.el=id=>document.getElementById(id);window.table=()=>document.createElement('table');window.button=(text,callback)=>{const button=document.createElement('button');button.textContent=text;button.onclick=callback;return button;};window.ZZWS={request:()=>{throw Error('No server request expected');}};</script><script src="/admin/price-review-data.js"></script><script src="/admin/price-review.js"></script><script src="/js/disclosure-menus.js"></script>`}));
  await page.goto(site.url+'warning-harness?lang=ru');
  await page.evaluate(()=>ZZWS_PRICE_REVIEW.show({difference:{details:[],warningsCount:1,warnings:[{articul:'001234',name:'Example model',source:'ws',before:100000,after:140000,percent:40}]}}));
  const disclosure=page.locator('#priceWarningsDisclosure'),summary=disclosure.locator('summary'),content=page.locator('#priceWarnings');
  assert.equal(await disclosure.evaluate(element=>element.open),false);assert.match(await summary.textContent(),/30%.*1$/);
  await summary.click();assert.equal(await disclosure.evaluate(element=>element.open),true);assert.equal(await content.isVisible(),true);assert.match(await content.innerText(),/001234.*Example model.*100000 → 140000.*40%/);
  await summary.focus();await summary.press('Enter');assert.equal(await disclosure.evaluate(element=>element.open),false);
  await summary.press('Space');assert.equal(await disclosure.evaluate(element=>element.open),true);
  await page.locator('#outside').click();assert.equal(await disclosure.evaluate(element=>element.open),true,'content disclosure stays open after clicking outside');
  const output=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'output/price-warning-disclosure');fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'populated.png')});
  await page.evaluate(()=>{el('sample').replaceChildren();ZZWS_PRICE_REVIEW.show({difference:{details:[],warningsCount:0,warnings:[]}});});assert.equal(await disclosure.evaluate(element=>element.open),false);assert.match(await summary.textContent(),/· 0$/);
  await summary.click();assert.equal(await content.isVisible(),true);await page.waitForFunction(()=>document.getElementById('priceWarnings').textContent.includes('Изменений цен на 30% и более нет.'));
  await page.evaluate(()=>ZZWS_I18N.setLanguage('hy'));assert.match(await content.innerText(),/30% և ավելի գնային փոփոխություններ չկան։/);assert.equal(await disclosure.evaluate(element=>element.open),true);
  await page.setViewportSize({width:390,height:700});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'empty-mobile.png')});
  await page.evaluate(()=>{el('sample').replaceChildren();ZZWS_PRICE_REVIEW.show({difference:{details:[],warningsCount:45,warnings:[{articul:'001234',name:'Example model',source:'base',before:100000,after:50000,percent:-50}]}});});await summary.click();assert.match(await content.innerText(),/1 \/ 45/);assert.match(await content.innerText(),/-50%/);
  assert.equal(apiCalls,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,pointerToggle:true,keyboardToggle:true,populated:true,emptyMessage:true,counts:true,partialListExplained:true,hyRu:true,mobile:true,apiCalls,errors}));
 }finally{await browser?.close();await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
