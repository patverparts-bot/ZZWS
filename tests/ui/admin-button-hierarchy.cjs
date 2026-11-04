const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const cached=path.join(process.env.USERPROFILE||'C:/Users/levon','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||(fs.existsSync(cached)?cached:'playwright'));
const customerCodePrefix=process.env.ZZWS_CUSTOMER_CODE_PREFIX==='enabled';
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs');
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')();
 const base=new URL(process.env.ZZWS_TEST_URL||site.url),runtime=await createRuntime({memory:true,debug:true,origin:base.origin});
 let browser,releaseWarehouse;
 const direct=async(p,token,data)=>{
  const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+p,base),{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));
  const value=await response.json();assert.equal(response.status,200,p+': '+JSON.stringify(value));return value;
 };
 try{
  const owner=(await direct('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  await direct('account/reauth',owner,{password:'24681012'});
  const ownerId=(await direct('me',owner)).id;
  const created=await direct('admin/users',owner,{intent:'create',client:'Button hierarchy fixture',customerCode:customerCodePrefix?'001234 Button check':'001234',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[{organization:'Local fixture',address:'Local address',contact:'Local receiver'}]});
  const customer=(await direct('admin/users',owner)).users.find(user=>user.id===created.id),cartId=crypto.randomUUID();
  await runtime.db.query('insert into zzws_saved_carts(id,user_id,title,cart,request_id) values($1,$2,$3,$4,$5)',[cartId,customer.id,'Button test basket',JSON.stringify({'900002':{articul:'900002',qty:1}}),crypto.randomUUID()]);
  const proposalId='b'.repeat(64),proposalLines=[{articul:'900002',name:'Local proposal fixture',quantity:1,price:101000,special:false}];
  await runtime.db.query("insert into zzws_proposals(token_hash,owner_id,customer_id,lines,price_mode,expires_at) values($1,$2,$3,$4,'Dealers',now()+interval '7 days')",[proposalId,ownerId,customer.id,JSON.stringify(proposalLines)]);
  const originalProposal=(await runtime.db.query('select lines,revision,revoked_at from zzws_proposals where token_hash=$1',[proposalId])).rows[0];
  const originalProfile=(await runtime.db.query('select profile,active,profile_revision from zzws_users where id=$1',[customer.id])).rows[0];
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),errors=[],mutations=[],browserPosts=[];
  context.setDefaultTimeout(20000);context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  let holdWarehouse=false,warehouseEntered;
  await context.route('**/js/api-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),pathname=new URL(request.url()).pathname;
   if(request.method()==='POST')browserPosts.push(pathname);
   if(request.method()==='POST'&&/\/(delete|archive|purge|reset-password|restore|send|save|publish|import|clear)(\/|$)/.test(pathname))mutations.push({path:pathname,method:request.method()});
   if(holdWarehouse&&request.method()==='GET'&&pathname.endsWith('/admin/warehouses')){holdWarehouse=false;warehouseEntered();await new Promise(resolve=>{releaseWarehouse=resolve;});}
   const response=await runtime.handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();
  await page.addInitScript(token=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','hy');},owner);
  await page.goto(new URL('admin/#tab=users',base).href);
  async function navigate(id){
   const button=page.locator('[data-tab="'+id+'"]');
   if(!await button.isVisible())await page.evaluate(tab=>window.ZZWS_ADMIN_MENU?.reveal(tab),id);
   if(!await button.isVisible()){const more=page.locator('#adminMoreMenu');if(!await more.evaluate(element=>element.open))await more.locator(':scope > summary').click();}
   await button.click();
  }
  const form=page.locator('#userForm'),save=form.locator('.user-card-actions button[type=submit],.user-card-actions button:not([type])');
  async function tone(locator,value,label){
   await locator.waitFor({state:'attached'});
   await locator.evaluate((button,expected)=>new Promise((resolve,reject)=>{
    if(button.dataset.actionTone===expected){resolve();return;}
    const started=Date.now(),check=()=>{if(button.dataset.actionTone===expected){observer.disconnect();resolve();}else if(Date.now()-started>10000){observer.disconnect();reject(Error('Expected '+expected+', got '+button.dataset.actionTone));}},observer=new MutationObserver(check);observer.observe(button,{attributes:true,attributeFilter:['data-action-tone']});setTimeout(check,10020);
   }),value);
   assert.equal(await locator.getAttribute('data-action-tone'),value,label);
  }
  async function byId(id,value){await tone(page.locator('#'+id),value,id);}
  async function navigationIntact(){
   const buttons=await page.locator('.admin-navigation [data-tab]').evaluateAll(nodes=>nodes.map(button=>({tab:button.dataset.tab,tone:button.dataset.actionTone||null,type:button.type,text:button.textContent.trim()})));
   assert.ok(buttons.length>=15,'Navigation tabs remain present');
   assert.equal(new Set(buttons.map(button=>button.tab)).size,buttons.length,'Navigation targets remain unique');
   assert.ok(buttons.every(button=>button.tone===null&&button.text),'Navigation tabs keep their own presentation and accessible labels');
   assert.equal(await page.locator('.context-help[data-action-tone],[data-sort-column][data-action-tone],.column-sort-button[data-action-tone]').count(),0,'Context help and table sorting keep their dedicated controls');
  }
  async function fits(label,root='main'){
   for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+': page fits '+viewport.width+'px');
    assert.equal(await page.locator(root).evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,label+': controls fit '+viewport.width+'px');
   }
   await page.setViewportSize({width:1440,height:1100});
  }
  await page.locator('#userList tr').filter({hasText:'Button hierarchy fixture'}).getByRole('button').click();
  assert.equal(await save.count(),1,'Customer card has one common save action');
  await tone(save,'primary','Save customer');
  for(const id of ['cancelUser','previewUserAccess','managerRefresh','warehouseReload','previewGroupRules','reloadGroupRules','catalogControlsReload','operationsRefresh','refreshAdminOrders','templateCancel','templateRefresh','userTemplate','previewFinalFile','previewFinalPaste','cancelConfirmation'])await byId(id,'secondary');
  for(const id of ['publish','warehouseSave','offerSave','manualOrderSave','applyConfirmation','saveAdminScope','saveAdminChannels','saveAdminPolling','templateSave','importUsers'])await byId(id,'primary');
  for(const id of ['deleteClient','offerDelete'])await byId(id,'danger');
  for(const id of ['archiveClient','resetUserPassword','issueInvitation'])await byId(id,'warning');
  await tone(page.locator('#priceForm').locator('button[type=submit],button:not([type])'),'secondary','Price file inspection is a preview');
  await tone(page.locator('#usersImportForm').locator('button[type=submit],button:not([type])'),'secondary','User import inspection is a preview');
  assert.equal(await form.locator('.user-card-actions [data-action-tone=primary]').count(),1,'Save has a single visual emphasis in the common card footer');
  await navigationIntact();
  const appearance=async locator=>locator.evaluate(button=>{const style=getComputedStyle(button);return [style.backgroundColor,style.color,style.borderColor].join('|');});
  assert.notEqual(await appearance(save),await appearance(page.locator('#cancelUser')),'Primary and secondary actions are visually distinct');
  assert.notEqual(await appearance(page.locator('#deleteClient')),await appearance(page.locator('#cancelUser')),'Destructive actions are visually distinct');
  assert.notEqual(await appearance(page.locator('#archiveClient')),await appearance(page.locator('#cancelUser')),'Warnings are visually distinct');
  for(const language of ['ru','hy']){
   await page.evaluate(value=>ZZWS_I18N.setLanguage(value),language);
   await tone(save,'primary','Save after language switch');await byId('cancelUser','secondary');await byId('deleteClient','danger');await byId('archiveClient','warning');await navigationIntact();
  }
  await fits('Customer actions','#userForm');
  const output=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'output/admin-button-hierarchy');fs.mkdirSync(output,{recursive:true});
  await form.screenshot({path:path.join(output,'customer-actions-desktop.png')});
  await page.setViewportSize({width:390,height:844});await form.screenshot({path:path.join(output,'customer-actions-mobile.png')});await page.setViewportSize({width:1440,height:1100});
  // Open review dialogs without ever submitting a destructive action.
  for(const [mode,expected] of [['delete','danger'],['archive','warning'],['restore','primary']]){
   await page.evaluate(({user,mode})=>{const api=ZZWS_CLIENT_DELETION;api[mode==='delete'?'open':mode](user,()=>{});},{user:customer,mode});
   const dialog=page.locator('#clientDeletionDialog');await dialog.waitFor({state:'visible'});
   await tone(dialog.locator('#confirmClientDeletion'),expected,'Client '+mode+' confirmation');
   await tone(dialog.locator('button[type=button]'),'secondary','Client '+mode+' cancellation');
   assert.equal(await dialog.locator('#confirmClientDeletion').isDisabled(),true,'Styling cannot bypass '+mode+' confirmation guards');
   await dialog.locator('#clientDeletionPassword').fill('Local-only-test-password');
   if(mode==='archive')await dialog.locator('#clientArchiveReason').fill('Isolated preview only');
   assert.equal(await dialog.locator('#confirmClientDeletion').isEnabled(),true,'Existing '+mode+' validation remains active');
   await dialog.locator('#clientDeletionPassword').fill('');
   assert.equal(await dialog.locator('#confirmClientDeletion').isDisabled(),true,'Empty password still blocks '+mode);
   await fits('Client '+mode+' dialog','#clientDeletionDialog');
   await dialog.locator('button[type=button]').click();
  }
  // Both real security dialogs are cancelled before any authentication request.
  for(const mode of ['mfa','reauth']){
   await page.evaluate(kind=>{
    window.__buttonHierarchySecurity=null;
    const pending=kind==='mfa'?completeSecureLogin({mfaRequired:true,challengeToken:'isolated-not-submitted'}):requireReauthentication();
    pending.then(()=>{window.__buttonHierarchySecurity={resolved:true};},error=>{window.__buttonHierarchySecurity={cancelled:true,message:error.message};});
   },mode);
   const dialog=page.locator('dialog[open]');await dialog.waitFor({state:'visible'});
   const confirm=dialog.locator('form button:not([type]),form button[type=submit]'),cancel=dialog.locator('button[type=button]');
   assert.equal(await confirm.count(),1,mode+': exactly one confirmation action');
   await tone(confirm,'primary',mode+' confirmation');await tone(cancel,'secondary',mode+' cancellation');
   assert.notEqual(await appearance(confirm),await appearance(cancel),mode+': confirmation and cancellation are visually distinct');
   const input=dialog.locator(mode==='mfa'?'input[name=code]':'input[type=password]');
   assert.equal(await input.getAttribute('required')!==null,true,mode+': the original validation remains required');
   assert.equal(await input.evaluate(field=>field.checkValidity()),false,mode+': empty input still fails validation');
   await input.fill(mode==='mfa'?'123456':'Isolated-not-submitted');
   assert.equal(await input.evaluate(field=>field.checkValidity()),true,mode+': valid input still passes native validation');
   if(mode==='mfa'){await input.fill('123');assert.equal(await input.evaluate(field=>field.checkValidity()),false,'MFA keeps its six-digit validation');}
   await fits(mode+' security dialog','dialog[open]');
   await cancel.click();await page.waitForFunction(()=>window.__buttonHierarchySecurity?.cancelled===true);
   assert.equal(await page.locator('dialog[open]').count(),0,mode+': cancellation closes the real dialog');
  }
  // Read-only GET suspension exercises busy/disabled controls without sending a save request.
  await navigate('warehouses');
  await page.locator('#warehouseRows tr').first().waitFor();
  await page.waitForFunction(()=>!document.getElementById('warehouseReload').disabled);
  await byId('warehouseSave','primary');assert.equal(await page.locator('#warehouseSave').isDisabled(),true,'Clean warehouse form cannot be saved');
  const entered=new Promise(resolve=>{warehouseEntered=resolve;});holdWarehouse=true;
  await page.locator('#warehouseReload').click();await entered;
  assert.equal(await page.locator('#warehouseReload').isDisabled(),true,'Refresh remains disabled during its pending GET');
  assert.equal(await page.locator('#warehouseSave').isDisabled(),true,'Save remains disabled during refresh');
  await byId('warehouseReload','secondary');await byId('warehouseSave','primary');
  releaseWarehouse();releaseWarehouse=null;
  await page.waitForFunction(()=>!document.getElementById('warehouseReload').disabled);
  assert.equal(await page.locator('#warehouseSave').isDisabled(),true,'Refresh does not dirty or enable save');
  await fits('Warehouse actions','#warehouses');
  await navigate('templates');
  await page.locator('#templateCustomer').selectOption(customer.id);
  const basket=page.locator('.admin-template-card').filter({hasText:'Button test basket'});await basket.waitFor();
  await tone(basket.locator('.storage-danger'),'danger','Dynamically loaded basket deletion');
  assert.equal(await basket.locator('button').filter({hasText:/Խմբագրել|Редактировать/}).count(),1,'Basket editing remains available');
  await fits('Saved basket actions','#templates');await navigationIntact();
  // Reading an actual stored proposal renders its actions; only its editor is opened.
  await page.evaluate(()=>ZZWS_PROPOSAL_MANAGEMENT.loadAll());
  const proposals=page.locator('#proposalManagementDialog');await proposals.waitFor({state:'visible'});
  const proposal=page.locator('#proposalManagementList > section').filter({hasText:'Button hierarchy fixture'});await proposal.waitFor();
  await tone(proposal.getByRole('button',{name:'Հետ կանչել առաջարկը',exact:true}),'warning','Proposal revocation');
  await tone(proposal.getByRole('button',{name:'Ջնջել առաջարկը',exact:true}),'danger','Proposal deletion');
  const openProposal=proposal.getByRole('button',{name:'Բացել և խմբագրել',exact:true});await tone(openProposal,'secondary','Open proposal editor');await openProposal.click();
  const proposalEditor=page.locator('#proposalManagementEditor'),proposalSave=proposalEditor.getByRole('button',{name:'Պահպանել փոփոխությունները',exact:true});
  await tone(proposalSave,'primary','Save proposal changes');
  assert.equal(await proposalEditor.locator('button[data-action-tone=primary]').count(),1,'Proposal editor keeps one save emphasis');
  await tone(proposalEditor.getByRole('button',{name:'Հեռացնել',exact:true}),'secondary','Removing an unsaved proposal row is a local edit');
  await fits('Proposal action hierarchy','#proposalManagementDialog');
  await proposals.getByRole('button',{name:'Փակել',exact:true}).click();
  await navigate('catalogControls');
  await page.waitForFunction(()=>!document.getElementById('catalogControlsReload').disabled);
  const autoReset=page.locator('#popularityEditForm button[type=button]');
  await tone(autoReset,'warning','Reset popularity adjustment to automatic calculation');
  assert.equal(await autoReset.isDisabled(),true,'No loaded popularity model can be reset');
  await navigationIntact();
  assert.deepEqual(errors,[]);
  assert.deepEqual(mutations,[],'No delete, archive, purge, reset, send, save, publication, import or cleanup was submitted');
  assert.deepEqual(browserPosts,[],'Security, proposal and catalogue checks submit no POST requests');
  assert.deepEqual((await runtime.db.query('select profile,active,profile_revision from zzws_users where id=$1',[customer.id])).rows[0],originalProfile,'Inspecting actions preserves customer data and access');
  assert.equal((await runtime.db.query('select count(*)::int count from zzws_saved_carts where id=$1',[cartId])).rows[0].count,1,'The inspected basket was never deleted');
  assert.deepEqual((await runtime.db.query('select lines,revision,revoked_at from zzws_proposals where token_hash=$1',[proposalId])).rows[0],originalProposal,'Reading proposal actions neither edits, revokes nor deletes the proposal');
  assert.equal((await runtime.db.query('select count(*)::int count from zzws_orders')).rows[0].count,0);assert.equal(runtime.reportEmails.length,0);
  console.log('PASS: primary/secondary/warning/danger hierarchy, dynamic confirmation modes, language changes and navigation retain their semantics; busy/disabled guards and desktop/mobile layout survive without dangerous submissions.');
 }finally{releaseWarehouse?.();await browser?.close();await runtime.close();if(site)await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
