const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cached=path.join(process.env.USERPROFILE||'C:/Users/levon','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||(fs.existsSync(cached)?cached:'playwright'));
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs');
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')();
 const base=new URL(process.env.ZZWS_TEST_URL||site.url),runtime=await createRuntime({memory:true,debug:true,origin:base.origin});
 let browser;
 const direct=async(p,token,data)=>{
  const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+p,base),{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));
  const value=await response.json();assert.equal(response.status,200,p+': '+JSON.stringify(value));return value;
 };
 try{
  const owner=(await direct('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  await direct('account/reauth',owner,{password:'24681012'});
  const created=await direct('admin/users',owner,{intent:'create',client:'UI customer code test',customerCode:'001234',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[{organization:'Saved UI company',address:'Saved UI address',contact:'Saved UI receiver'}]});
  const full='001234 Երևան / Shop (Կենտրոն)';
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
  context.setDefaultTimeout(20000);context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
  await context.route('**/js/api-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),response=await runtime.handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const admin=await context.newPage();
  await admin.addInitScript(token=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','hy');},owner);
  await admin.goto(new URL('admin/#tab=users',base).href);
  const row=()=>admin.locator('#userList tr').filter({hasText:'UI customer code test'});
  await row().getByRole('button').click();
  const form=admin.locator('#userForm'),field=form.locator('[name=customerCode]');
  await field.fill(full);
  await admin.evaluate(()=>ZZWS_I18N.setLanguage('ru'));
  assert.equal(await field.inputValue(),full);
  await admin.evaluate(()=>ZZWS_I18N.setLanguage('hy'));
  assert.equal(await field.inputValue(),full);
  await form.locator('button[type=submit],.user-card-actions button:not([type])').first().click();
  await form.waitFor({state:'hidden'});
  await row().getByText(full,{exact:true}).waitFor();
  for(const language of ['ru','hy']){
   await admin.evaluate(value=>ZZWS_I18N.setLanguage(value),language);
   assert.equal(await row().locator('td').first().innerText(),full,'Full customer code in the administrator table must remain untranslated');
  }
  await row().getByRole('button').click();
  assert.equal(await field.inputValue(),full,'Reopened card retains the full value');
  assert.ok((await admin.locator('#userTitle').innerText()).includes(full),'Card heading retains the full value');
  for(const language of ['ru','hy']){
   await admin.evaluate(value=>ZZWS_I18N.setLanguage(value),language);
   assert.equal(await field.inputValue(),full);
   assert.ok((await admin.locator('#userTitle').innerText()).includes(full),'Card heading must protect customer text during language switches');
  }
  const saved=(await direct('admin/users',owner)).users.find(user=>user.id===created.id);
  assert.equal(saved.customerCode,full);
  assert.equal(saved.id,created.id);
  assert.equal(saved.rowsList[0].address,'Saved UI address');
  const catalog=await context.newPage();
  await catalog.addInitScript(token=>sessionStorage.setItem('zzws_session_v3',token),owner);
  await catalog.goto(new URL('#catalog',base).href);
  try{await catalog.locator('#catalogCustomerPanel:visible').waitFor();}catch(error){console.error('Storefront diagnostic',JSON.stringify({url:catalog.url(),errors,text:(await catalog.locator('body').innerText()).slice(0,1800)}));throw error;}
  await catalog.locator('#catalogCustomerSearch').fill('001234');
  await catalog.locator('#catalogCustomerPanel button').first().click();
  await catalog.waitForFunction(id=>window.ZZWS_CATALOG_VIEW?.active()&&ZZWS_CATALOG_VIEW.identity()?.id===id&&typeof catalogLoaded!=='undefined'&&catalogLoaded,created.id);
  assert.equal(await catalog.locator('#catalogCustomerSelect').inputValue(),created.id,'Prefix lookup selects the existing customer id');
  const selected=catalog.locator('#catalogCustomerSelect option:checked');
  assert.ok((await selected.innerText()).includes(full));
  assert.equal(await catalog.evaluate(()=>ZZWS_CATALOG_VIEW.identity().customerCode),full);
  for(const language of ['ru','hy']){
   await catalog.evaluate(value=>ZZWS_I18N.setLanguage(value),language);
   assert.ok((await selected.innerText()).includes(full),'Selected customer option must retain the full untranslated code');
   assert.ok((await catalog.locator('#catalogCustomerStatus').innerText()).includes(full),'Selected customer notice must retain the full untranslated code');
  }
  assert.deepEqual(errors,[]);
  assert.equal(runtime.reportEmails.length,0);
  console.log('PASS: actual card save/reopen retains full customer code; hy/ru data stays unchanged; six-digit catalogue lookup selects the same customer id and displays its full value.');
 }finally{await browser?.close();await runtime.close();if(site)await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
