const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let data={mainWarehouses:['003','023','026','031'],revision:'r1',warehouses:['003','023','026','031','050'].map(code=>({code,type:code==='050'?'shop':'main',present:true}))},payload=null,rejectSave=false;
  await page.addInitScript(()=>{sessionStorage.setItem('zzws_session_v3','a'.repeat(64));localStorage.setItem('zzws_language_v1','ru');});
  await page.route('**/functions/v1/zzws-api/**',async route=>{const request=route.request(),name=new URL(request.url()).pathname.split('/zzws-api/')[1];let response={};
   if(name==='me')response={id:'owner',role:'admin',adminScope:'owner',permissions:['rules'],client:'Test',rowsList:[]};
   if(name==='admin/catalog-options')response={pairs:[]};if(name==='admin/rules')response={rules:defaultRules(),defaults:defaultRules(),revision:'rules-v1'};
   if(name==='admin/warehouses'){
    if(request.method()==='POST'){payload=request.postDataJSON();if(rejectSave){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Կարգավորումները փոխվել են։ Թարմացրեք և կրկնեք'})});return;}data={mainWarehouses:payload.mainWarehouses,revision:data.revision+'1',warehouses:[...new Set([...data.warehouses.map(r=>r.code),...payload.mainWarehouses])].sort().map(code=>({code,type:payload.mainWarehouses.includes(code)?'main':'shop',present:code!=='099'}))};}response=data;
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  const url='http://127.0.0.1:'+server.address().port+'/admin/#tab=warehouses';await page.goto(url);await page.locator('[data-warehouse-code="050"]').waitFor();
  assert.equal(await page.locator('#warehouses h1').evaluate(n=>{const copy=n.cloneNode(true);copy.querySelectorAll('.context-help').forEach(a=>a.remove());return copy.textContent;}),'Склады');assert.doesNotMatch(await page.locator('#warehouses').innerText(),/[\u0531-\u058f]/);assert.equal(await page.locator('#warehouseSave').isDisabled(),true);
  await page.locator('[data-warehouse-code="050"]').selectOption('main');await page.locator('[data-warehouse-code="003"]').selectOption('shop');await page.locator('#warehouseSave').click();await page.waitForFunction(()=>document.querySelector('#warehouseSave').disabled);assert.deepEqual(payload.mainWarehouses,['023','026','031','050']);
  await page.reload();await page.locator('[data-warehouse-code="050"]').waitFor();assert.equal(await page.locator('[data-warehouse-code="050"]').inputValue(),'main');assert.equal(await page.locator('[data-warehouse-code="003"]').inputValue(),'shop');
  await page.locator('#warehouseCode').fill('099');await page.locator('#warehouseAdd').click();await page.locator('#warehouseSave').click();await page.waitForFunction(()=>document.querySelector('#warehouseSave').disabled);assert.ok(payload.mainWarehouses.includes('099'));
  await page.locator('#warehouseCode').fill('99');await page.locator('#warehouseAdd').click();assert.match(await page.locator('#warehousesStatus').textContent(),/трёхзначные/);
  rejectSave=true;await page.locator('[data-warehouse-code="023"]').selectOption('shop');await page.locator('#warehouseSave').click();await page.waitForFunction(()=>document.querySelector('#warehousesStatus').classList.contains('error'));assert.equal(await page.locator('[data-warehouse-code="023"]').inputValue(),'shop');assert.equal(await page.locator('#warehouseSave').isEnabled(),true);
  assert.doesNotMatch(await page.locator('#warehouses').innerText(),/[\u0531-\u058f]/);rejectSave=false;await page.locator('#warehouseSave').click();await page.waitForFunction(()=>document.querySelector('#warehouseSave').disabled);await page.locator('#warehouseCode').fill('');
  assert.equal(await page.locator('#status').textContent(),'');
  const dir=path.join(root,'output/warehouse-settings');fs.mkdirSync(dir,{recursive:true});await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>ZZWS_I18N.setLanguage('hy'));assert.equal(await page.locator('#warehouses h1').evaluate(n=>{const copy=n.cloneNode(true);copy.querySelectorAll('.context-help').forEach(a=>a.remove());return copy.textContent;}),'Պահեստներ');await page.evaluate(()=>ZZWS_I18N.setLanguage('ru'));assert.deepEqual(errors,[]);
  console.log('PASS: warehouse editor, Russian/Armenian, persisted changes, future code, conflict, mobile layout');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
