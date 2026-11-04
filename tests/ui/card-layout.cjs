const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cached=path.join(process.env.USERPROFILE||'C:/Users/levon','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||(fs.existsSync(cached)?cached:'playwright'));
const customerCodePrefix=process.env.ZZWS_CUSTOMER_CODE_PREFIX!=='disabled';
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
  const full=customerCodePrefix?'001234 Երևան / Layout (Կենտրոն)':'001234',editedCode=customerCodePrefix?full+' բաժին':'001235',rows=[1,2,3].map(i=>({organization:'Saved organisation '+i,address:'Saved address '+i,contact:'Saved receiver '+i}));
  const created=await direct('admin/users',owner,{intent:'create',client:'UI layout customer',customerCode:full,role:'client',sheet:'Dealers',allBrands:true,active:true,companyPhone:'+37410123456',companyEmail:'saved@example.invalid',rowsList:rows});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),errors=[];
  context.setDefaultTimeout(20000);context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
  await context.route('**/js/api-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),response=await runtime.handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();
  await page.addInitScript(token=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','hy');},owner);
  await page.goto(new URL('admin/#tab=users',base).href);
  const form=page.locator('#userForm'),field=name=>form.locator('[name="'+name+'"]');
  const allNames=['id','customerCode','login','client','role','sheet','active','allowResale','password','ordersRefreshSeconds',...[1,2,3].flatMap(i=>['organization','address','contact'].map(key=>key+(i===1?'':i)))];
  const allIds=['clientCategory','clientPriceSequence','userAccessEditor','previewUserAccess','companyPhone','companyEmail','managerPhone','adminScope','adminOrdersRefresh','saveAdminScope','mobileAdminEnabled','telegramEnabled','telegramRecipientId','telegramBotUsername','issueInvitation','resetUserPassword','cancelUser','archiveClient','deleteClient'];
  async function assertControls(){
   for(const name of allNames)assert.equal(await field(name).count(),1,'Card field '+name+' occurs exactly once');
   for(const id of allIds)assert.equal(await form.locator('#'+id).count(),1,'Card control '+id+' occurs exactly once');
   const duplicates=await form.evaluate(root=>{const seen=new Set();return [...root.querySelectorAll('[id]')].map(el=>el.id).filter(id=>seen.has(id)||!seen.add(id));});
   assert.deepEqual(duplicates,[],'Reordering must not duplicate any field ids');
   assert.equal(await form.locator('.user-card-actions button').count(),2,'The common action bar contains only Save and Cancel');
   assert.equal(await form.locator('.user-card-actions #cancelUser').count(),1);
   assert.equal(await form.locator('#userSavedBaskets,#userBasketsGroup').count(),0,'Saved baskets belong only to their separate admin section, not the client card');
   assert.equal(await page.locator('[data-tab=templates]').count(),1,'The separate saved-baskets navigation remains available');
   assert.equal(await form.locator('.user-card-actions #archiveClient,.user-card-actions #deleteClient').count(),0,'Specialised actions remain in their own semantic sections');
  }
  function sectionIds(role,existing){
   return role==='admin'?['userAccountGroup','userPhoneSettings','userLoginGroup','userEmailSettings',...(existing?['adminChannelsPanel']:[]),'adminPollingPanel']:['userAccountGroup','userPhoneSettings','deliveryVariants','userCommercialGroup',...(existing?['clientMembers']:[]),'userLoginGroup',...(existing?['clientReceiptControlPanel','userLifecycleGroup']:[])];
  }
  async function assertNumbering(state,role,existing){
   const expected=sectionIds(role,existing);
   await page.waitForFunction(ids=>{
    const visible=[...document.querySelectorAll('#userForm > fieldset[data-card-section]')].filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
    return visible.length===ids.length&&visible.every((node,index)=>node.id===ids[index]&&Number(node.querySelector(':scope > legend')?.textContent.trim().match(/^(\d+)\./)?.[1])===index+1);
   },expected);
   const sections=await form.locator(':scope > fieldset[data-card-section]').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden').map(node=>({id:node.id,title:node.querySelector(':scope > legend')?.textContent.trim()||''})));
   assert.deepEqual(sections.map(section=>section.id),expected,state+': sections follow the agreed task order');
   for(let i=0;i<sections.length;i++)assert.equal(Number(sections[i].title.match(/^(\d+)\./)?.[1]),i+1,state+': visible sections must have consecutive numbers: '+JSON.stringify(sections));
   const labels=sections.map(section=>section.title.replace(/^\d+\.\s*/,''));
   assert.ok(labels.every(label=>label.length>2),state+': section titles describe their contents');
   assert.equal(new Set(labels).size,sections.length,state+': semantic section names are unique');
   if(await page.evaluate(()=>ZZWS_I18N.language==='ru'))assert.ok(labels.every(label=>!/[Ա-և]/u.test(label)),state+': every section heading must have a Russian translation');
   return sections;
  }
  async function assertRole(role,existing){
   assert.equal(await field('customerCode').isVisible(),role==='client');
   assert.equal(await page.locator('#clientPricingFields').isVisible(),role==='client');
   assert.equal(await page.locator('#adminPollingPanel').isVisible(),role==='admin');
   assert.equal(await page.locator('#adminScopePanel').isVisible(),role==='admin'&&existing);
   assert.equal(await page.locator('#adminChannelsPanel').isVisible(),role==='admin'&&existing);
   assert.equal(await page.locator('#userEmailSettings').isVisible(),role==='admin');
   assert.equal(await page.locator('#companyPhone').isVisible(),role==='client');
   assert.equal(await page.locator('#companyEmail').isVisible(),role==='client');
   assert.equal(await page.locator('#managerPhone').isVisible(),role==='admin');
   assert.equal(await page.locator('#copyClientSettings').isVisible(),role==='client'&&!existing,'Copying a template is an optional helper for new customers');
  }
  async function assertFits(state){
   for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    assert.equal(await form.evaluate(root=>root.scrollWidth<=root.clientWidth+1),true,state+': card must fit viewport '+viewport.width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,state+': page must not overflow viewport '+viewport.width);
    assert.equal(await form.evaluate(root=>{const actions=root.querySelector('.user-card-actions').getBoundingClientRect(),sections=[...root.querySelectorAll(':scope > fieldset[data-card-section]')].filter(node=>node.getClientRects().length);return sections.every(section=>actions.top>=section.getBoundingClientRect().bottom-1);}),true,state+': the common action bar must follow the sections without covering their headings or controls');
   }
   await page.setViewportSize({width:1440,height:1100});
  }
  await page.locator('#newUser').click();await form.waitFor({state:'visible'});
  await assertControls();await assertRole('client',false);await assertNumbering('new client','client',false);await assertFits('new client');
  await field('role').selectOption('admin');await assertRole('admin',false);await assertNumbering('new administrator','admin',false);await assertFits('new administrator');
  await field('role').selectOption('client');await assertRole('client',false);await assertNumbering('new client after role switch','client',false);
  await page.locator('#cancelUser').click();
  const getClient=async()=>((await direct('admin/users',owner)).users.find(user=>user.id===created.id));
  const initial=await getClient();
  await page.locator('#userList tr').filter({hasText:'UI layout customer'}).getByRole('button').click();
  await assertControls();await assertRole('client',true);await assertNumbering('existing client','client',true);
  const access={mode:'selected',include:[{brand:'Samsung',category:'',categoryMatch:'exact'}],exclude:[{brand:'LG',category:'',categoryMatch:'exact'}]};
  await field('customerCode').fill(editedCode);await field('sheet').selectOption('KP');await field('allowResale').check();
  await page.locator('#companyPhone').fill('+37499112233');await page.locator('#companyEmail').fill('changed@example.invalid');
  for(let i=1;i<=3;i++)for(const key of ['organization','address','contact'])await field(key+(i===1?'':i)).fill('Changed '+key+' '+i);
  await page.evaluate(value=>userAccessEditor.reset(value),access);
  await field('active').uncheck();await field('active').check();
  for(const language of ['ru','hy']){await page.evaluate(value=>ZZWS_I18N.setLanguage(value),language);await assertNumbering('existing client '+language,'client',true);assert.equal(await field('customerCode').inputValue(),editedCode);}
  await assertFits('existing client');
  const screenshots=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'output/card-layout');fs.mkdirSync(screenshots,{recursive:true});
  await form.screenshot({path:path.join(screenshots,'client-desktop.png')});await page.setViewportSize({width:390,height:844});await form.screenshot({path:path.join(screenshots,'client-mobile.png')});await page.setViewportSize({width:1440,height:1100});
  await form.locator('.user-card-actions button[type=submit],.user-card-actions button:not([type])').first().click();await form.waitFor({state:'hidden'});
  const saved=await getClient();
  assert.equal(saved.id,created.id);assert.equal(saved.customerCode,editedCode);assert.equal(saved.active,true);assert.equal(saved.sheet,'KP');assert.equal(saved.allowResale,true);assert.equal(saved.companyPhone,'+37499112233');assert.equal(saved.companyEmail,'changed@example.invalid');assert.deepEqual(saved.catalogAccess,access);
  assert.deepEqual(saved.rowsList.map(row=>row.id),initial.rowsList.map(row=>row.id));
  assert.deepEqual(saved.rowsList.map(({id,...row})=>row),[1,2,3].map(i=>({organization:'Changed organization '+i,address:'Changed address '+i,contact:'Changed contact '+i})));
  await page.locator('#userList tr').filter({hasText:'UI layout customer'}).getByRole('button').click();
  assert.equal(await field('customerCode').inputValue(),saved.customerCode);assert.equal(await field('sheet').inputValue(),'KP');assert.equal(await field('allowResale').isChecked(),true);assert.equal(await page.locator('#companyPhone').inputValue(),saved.companyPhone);assert.equal(await page.locator('#companyEmail').inputValue(),saved.companyEmail);assert.deepEqual(await page.evaluate(()=>userAccessEditor.read()),access);
  for(let i=1;i<=3;i++)for(const key of ['organization','address','contact'])assert.equal(await field(key+(i===1?'':i)).inputValue(),'Changed '+key+' '+i);
  await page.locator('#cancelUser').click();
  const staff=(await direct('admin/users',owner)).users.find(user=>user.login==='zzws-test-manager');
  assert.equal(staff.adminScope,'manager','The existing administrator fixture must have its assigned manager rights');
  await page.evaluate(user=>editUser(user),staff);
  await assertControls();await assertRole('admin',true);await assertNumbering('existing administrator','admin',true);await assertFits('existing administrator');
  await page.locator('#managerPhone').fill('+37499114455');await page.locator('#userEmailSettings input[type=email]').fill('manager-reply@example.invalid');await field('ordersRefreshSeconds').fill('17');
  for(const language of ['ru','hy']){await page.evaluate(value=>ZZWS_I18N.setLanguage(value),language);await assertNumbering('existing administrator '+language,'admin',true);}
  await form.locator('.user-card-actions button[type=submit],.user-card-actions button:not([type])').first().click();await form.waitFor({state:'hidden'});
  const savedStaff=(await direct('admin/users',owner)).users.find(user=>user.id===staff.id);
  assert.equal(savedStaff.login,staff.login);assert.equal(savedStaff.role,'admin');assert.equal(savedStaff.adminScope,staff.adminScope);assert.equal(savedStaff.managerPhone,'+37499114455');assert.equal(savedStaff.replyToEmail,'manager-reply@example.invalid');assert.equal(savedStaff.ordersRefreshSeconds,17);
  await page.evaluate(user=>editUser(user),savedStaff);assert.equal(await page.locator('#managerPhone').inputValue(),savedStaff.managerPhone);assert.equal(await page.locator('#userEmailSettings input[type=email]').inputValue(),savedStaff.replyToEmail);assert.equal(await field('ordersRefreshSeconds').inputValue(),'17');
  assert.deepEqual(errors,[]);assert.equal(runtime.reportEmails.length,0);assert.equal((await runtime.db.query('select count(*)::int count from zzws_orders')).rows[0].count,0);
  console.log('PASS: new/existing client and administrator cards have unique complete controls and consecutive visible sections; role visibility, contact/pricing/access/delivery save/reopen, hy/ru and desktop/mobile layout retain their data.');
 }finally{await browser?.close();await runtime.close();if(site)await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
