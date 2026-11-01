const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..');
const user={id:'11111111-1111-4111-8111-111111111111',login:'demo',client:'Demo',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[]};
const products=[{articul:'001',name:'Test model',category:'Test category',brand:'Test brand',retail:100,wholesale:80,hasWholesale:true,stockStatus:'Առկա է',targetWarehousesStock:3,marginVal:20}];
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)||!(/^\/(js|admin)\//.test(name)||['/index.html','/styles.css','/logo.svg','/logo-dark.svg','/favicon.svg','/bg-warehouse-login.webp','/zigzag-avatar.svg'].includes(name))){res.writeHead(404).end();return;}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'}).end(data);});
});
(async()=>{
 const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');
 const {popularityValues}=await import('../../supabase/functions/zzws-api/catalog-controls.mjs');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const screenDir=process.env.ZZWS_SCREENSHOT_DIR;const capture=async(name,target)=>{if(!screenDir)return;await page.locator(target||'body').screenshot({path:path.join(screenDir,name+'.png')});};
  const setTarget=async value=>{await page.locator('#catalogAccountOptions').evaluate(e=>e.open=true);await page.locator('#catalogControlsTarget').selectOption(value);};
  let controls={},popularity={'001':{popular:true,personalPopular:true}},config={},revision='v1',saved=null;
  await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const name=new URL(route.request().url()).pathname.split('/zzws-api/')[1];let data={};
   if(name==='me')data=user;
   if(name==='me/state')data=route.request().method()==='POST'?{version:1}:{data:{},versions:{}};
   if(name==='catalog')data={products,version:'test',updated:'30/10/2026',controls,popularity};
   if(name==='catalog/version')data={version:'test'};
   if(name==='dealer/facts')data={items:{'001':{type:'washer',verified:true,dimensions:{width:60,height:85,depth:45},capacity:7}}};
   if(name==='orders/notifications')data={events:[]};
   if(name==='orders/receipt-state')data={enabled:false,blocked:false,outstanding:[],pendingCount:0};
   if(name==='admin/catalog-options')data={pairs:[]};
   if(name==='admin/rules')data={rules:defaultRules(),defaults:defaultRules(),revision:'rules-v1'};
   if(name==='admin/catalog-controls'){
    if(route.request().method()==='POST'){
     saved=route.request().postDataJSON();
     if(saved.kind==='popularityRules')config.popularityRules=saved.rules;
     else if(saved.kind==='popularityEdit'){
      config.popularityEdits||={};let target;
      if(saved.target==='global')target=config.popularityEdits.global||={};
      else{config.popularityEdits.users||={};target=config.popularityEdits.users[saved.target]||={};}
      if(saved.value===null)delete target[saved.articul];else {const {days,...delta}=saved.value;target[saved.articul]={...delta,mode:'adjustment',expiresAt:new Date(Date.now()+days*86400000).toISOString()};}
     }else if(saved.target==='global')config.global=saved.controls;else config.users={[saved.target]:saved.controls};revision+='1';
    }
    const params=new URL(route.request().url()).searchParams;
    if(params.has('articul')){const target=params.get('target'),articul=params.get('articul');data={revision,target,articul,...popularityValues([{articul:'001',orders:2,customers:2,personal_orders:1}],articul,config,target==='global'?user.id:target)};}
    else data={config,revision};
   }
   if(name==='admin/users')data={users:[{...user,role:'client'}]};
   if(name==='admin/receipt-control')data={};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.waitForFunction(()=>catalogLoaded);await page.evaluate(()=>{ZZWS_STOREFRONT.navigate('catalog');ZZWS_DEALER.setView('table');toggleMobileFilters(true);});
  assert.equal(await page.locator('#tableBody .purchase-badge').count(),2);
  await capture('01-catalogue-purchase-badges','#catalogContent');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>!desktopMQ.matches);await page.evaluate(()=>rerenderVisible());await page.locator('#mobileCardsContainer .purchase-badge').first().waitFor();assert.equal(await page.locator('#mobileCardsContainer .purchase-badge').count(),2);
  await capture('01b-mobile-purchase-badges','#mobileCardsContainer');
  await page.screenshot({path:path.join(root,'work/catalog-controls-mobile.png'),fullPage:true});
  if(screenDir)fs.copyFileSync(path.join(root,'work/catalog-controls-mobile.png'),path.join(screenDir,'01b-mobile-purchase-badges.png'));
  await page.setViewportSize({width:1440,height:950});await page.waitForFunction(()=>desktopMQ.matches);
  await page.evaluate(()=>{
   selectedBrands=['unavailable'];selectedCategories=['unavailable'];document.getElementById('searchInput').value='not found';
   for(const id of ['favOnlyFilter','promoOnlyFilter','stockOnlyFilter','wholesaleOnlyFilter'])document.getElementById(id).checked=true;
   document.getElementById('sortBy').value='priceDesc';
   ZZWS_CATALOG_CONTROLS.apply({controls:{search:false,brand:false,category:false,favorites:false,promo:false,stock:false,wholesale:false,sorting:false,popular:false,personalPopular:false},popularity:{'001':{popular:true,personalPopular:true}}});
  });
  await page.locator('#tableBody tr[data-art]').first().waitFor();assert.equal(await page.locator('#tableBody tr[data-art]').count(),1);
  assert.equal(await page.locator('.purchase-badge').count(),0);
  assert.equal(await page.locator('#brandInput').isVisible(),false);
  assert.equal(await page.locator('#searchInput').isVisible(),false);
  await page.evaluate(()=>{ZZWS_CATALOG_CONTROLS.apply({controls:{},popularity:{'001':{popular:true,personalPopular:true}}});});
  assert.equal(await page.locator('#brandInput').isVisible(),true);
  await page.locator('#tableBody .purchase-badge').first().waitFor();assert.equal(await page.locator('#tableBody .purchase-badge').count(),2);
  await page.waitForFunction(()=>ZZWS_DEALER.facts()['001']);
  await page.locator('#dealerTechFilters').evaluate(e=>e.open=true);await page.locator('[data-tech-filter=widthMax]').fill('30');await page.locator('[data-tech-filter=widthMax]').dispatchEvent('change');await page.waitForFunction(()=>filteredProducts.length===0);
  await page.evaluate(()=>ZZWS_CATALOG_CONTROLS.apply({controls:{tech_widthMax:false},popularity:{'001':{popular:true,personalPopular:true}}}));await page.waitForFunction(()=>filteredProducts.length===1);assert.equal(await page.locator('[data-tech-filter=widthMax]').count(),0);
  await page.evaluate(()=>ZZWS_CATALOG_CONTROLS.apply({controls:{},popularity:{'001':{popular:true,personalPopular:true}}}));
  await page.evaluate(()=>ZZWS_CATALOG_CONTROLS.apply({controls:{},popularityRules:{days:30,orders:4,customers:2,personalOrders:2},popularity:{'001':{popular:true,personalPopular:true,popularSource:'manual'}}}));
  await page.locator('#tableBody .purchase-badge').first().waitFor();assert.match(await page.locator('#tableBody .purchase-badge').first().getAttribute('title'),/ադմինիստրատորի/);
  assert.match(await page.locator('#tableBody .purchase-badge-personal').getAttribute('title'),/30.*2/);
  await page.screenshot({path:path.join(root,'work/catalog-controls-desktop.png')});
  await page.evaluate(()=>lockCatalog());assert.equal(await page.evaluate(()=>ZZWS_CATALOG_CONTROLS.badges('001')),'');
  user.role='admin';user.adminScope='owner';user.permissions=['rules'];
  await page.goto(url+'/admin/#tab=catalogControls');await page.locator('#catalogControlFields select').first().waitFor({timeout:10000}).catch(async e=>{console.error({errors,status:await page.locator('#status').textContent(),loader:await page.locator('#sessionLoadingText').textContent()});throw e;});
  await capture('02-admin-global-filters','#catalogControlsForm');
  await page.locator('#technicalControlOptions').evaluate(e=>e.open=true);if(screenDir){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(screenDir,'12-admin-technical-filters.png'),fullPage:true});}await page.locator('#technicalControlOptions').evaluate(e=>e.open=false);
  await page.locator('[data-control=brand]').selectOption('false');await page.locator('#catalogControlsForm button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('պահպանված'));
  assert.equal(saved.target,'global');assert.equal(saved.controls.brand,false);
  await setTarget(user.id);
  assert.match(await page.locator('[data-control=brand] option').first().textContent(),/անջատված/);
  await capture('03-admin-user-filters','#catalogControlsForm');
  await page.locator('[data-control=brand]').selectOption('true');await page.locator('#catalogControlsForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#catalogControlsForm button[type=submit]').disabled);
  assert.equal(saved.target,user.id);assert.deepEqual(saved.controls,{brand:true});
  await page.reload();await page.locator('#catalogControlFields select').first().waitFor();
  await setTarget(user.id);assert.equal(await page.locator('[data-control=brand]').inputValue(),'true');
  await page.locator('[data-control=brand]').selectOption('inherit');await page.locator('#catalogControlsForm button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('#catalogControlsForm button[type=submit]').disabled);assert.deepEqual(saved.controls,{});
  await page.locator('#popularityAdvanced').evaluate(e=>e.open=true);
  await page.locator('#popularityRulesFields [data-popularity-count=days]').fill('30');
  await page.locator('#popularityRulesFields [data-popularity-count=orders]').fill('4');
  await page.locator('#popularityRulesFields [data-popularity-count=customers]').fill('2');
  await page.locator('#popularityRulesForm button').click();await page.waitForFunction(()=>!document.querySelector('#popularityRulesForm button').disabled);
  assert.equal(saved.kind,'popularityRules');assert.equal(config.popularityRules.days,30);await capture('04-automatic-frequency-rules','#popularityRulesForm');
  await setTarget('global');
  const lookup=async()=>{await page.locator('#popularityAdvanced').evaluate(e=>e.open=true);await page.locator('#popularitySku').fill('001');await page.locator('#popularityModelForm button').click();await page.waitForFunction(()=>!!document.querySelector('#popularityEditFields input'));};
  await lookup();assert.match(await page.locator('#popularityStats').textContent(),/Ինքնաշխատ/);
  await page.locator('#popularityEditFields [data-popularity-count=orders]').fill('8');await page.locator('#popularityEditFields [data-popularity-count=customers]').fill('4');await page.locator('#popularityEditReason').fill('Historical import');
  await page.locator('#popularityEditForm button').first().click();await page.waitForFunction(()=>!document.querySelector('#popularityModelForm button').disabled);
  assert.equal(saved.kind,'popularityEdit');assert.deepEqual(saved.value,{orders:8,customers:4,days:30,reason:'Historical import'});
  await page.reload();await page.locator('#catalogControlFields select').first().waitFor();await lookup();
  assert.equal(await page.locator('#popularityEditFields [data-popularity-count=orders]').inputValue(),'8');await capture('05-manual-global-frequency','fieldset:has(#popularityModelForm)');
  assert.match(await page.locator('#popularityStats').textContent(),/Պատվերների թիվ՝ 2/);
  await setTarget(user.id);await lookup();
  await page.locator('#popularityEditFields [data-popularity-count=personal_orders]').fill('6');await page.locator('#popularityEditReason').fill('Historical import');await page.locator('#popularityEditForm button').first().click();await page.waitForFunction(()=>!document.querySelector('#popularityModelForm button').disabled);
  assert.equal(saved.target,user.id);assert.deepEqual(saved.value,{personal_orders:6,days:30,reason:'Historical import'});
  await lookup();await capture('06-manual-user-frequency','fieldset:has(#popularityModelForm)');await page.locator('#popularityEditForm button').last().click();await page.waitForFunction(()=>!document.querySelector('#popularityModelForm button').disabled);
  assert.equal(saved.value,null);await lookup();assert.equal(await page.locator('#popularityEditFields [data-popularity-count=personal_orders]').inputValue(),'0');
  await setTarget('global');await lookup();assert.equal(await page.locator('#popularityEditFields [data-popularity-count=orders]').inputValue(),'8');
  await page.locator('#popularityEditForm button').last().click();await page.waitForFunction(()=>!document.querySelector('#popularityModelForm button').disabled);assert.equal(saved.value,null);
  await page.screenshot({path:path.join(root,'work/catalog-controls-admin.png')});
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile badges, filters, inheritance, editable calculation rules, automatic totals, persistent global/personal corrections and reset');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
