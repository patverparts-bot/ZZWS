const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const prepareOnly=process.argv.includes('--prepare-only');
const cached=path.join(process.env.USERPROFILE||'C:/Users/levon','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chromium=prepareOnly?null:require(process.env.ZZWS_PLAYWRIGHT||(fs.existsSync(cached)?cached:'playwright')).chromium;
(async()=>{
 const {createRuntime}=await import('../support/runtime.mjs');
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')();
 const base=new URL(process.env.ZZWS_TEST_URL||site.url),runtime=await createRuntime({memory:true,debug:true,origin:base.origin,sourceRoot:process.env.ZZWS_API_SOURCE_ROOT});
 let browser,heldRead=null,releaseHeldRead=null;const posts=[],errors=[],requests=[];
 const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
 const within=(promise,message)=>{let timeout;return Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(message)),20000);})]).finally(()=>clearTimeout(timeout));};
 const api=async(route,token,value)=>{
  const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+route,base),{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));
  const data=await response.json();assert.equal(response.status,200,route+': '+JSON.stringify(data));return data;
 };
 try{
  const tokens={};for(const role of ['owner','manager','price','dealer'])tokens[role]=(await api('login',null,{login:'zzws-test-'+role,password:'24681012'})).sessionToken;
  const owner=await api('me',tokens.owner),client=await api('me',tokens.dealer),state=(await runtime.db.query('select version,rules_revision from zzws_state where id')).rows[0];
  const product=(await api('catalog',tokens.dealer)).products.find(item=>item.articul==='900002');assert.ok(product,'The isolated dealer catalogue contains 900002');
  const lines=[{articul:product.articul,name:product.name,qty:1,unitPrice:product.wholesale}],fixtures={};
  await runtime.db.exec('begin');
  try{
   for(const status of ['new','confirmed','in_progress','completed','received','rejected']){
    const id=crypto.randomUUID(),received=status==='received'?new Date().toISOString():null;
    const row=(await runtime.db.query('insert into zzws_orders(id,user_id,request_id,customer,delivery,delivery_variant_id,lines,original_lines,total,status,received_at,received_by,receipt,comment) values($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13) returning *',[id,client.id,crypto.randomUUID(),JSON.stringify({id:client.id,client:client.client,role:'client',customerCode:client.customerCode}),JSON.stringify({organization:'Owner overview fixture',address:'Isolated warehouse',contact:'Isolated receiver',method:'Առաքում',profileRevision:client.profileRevision}),client.rowsList[0].id,JSON.stringify(lines),product.wholesale,status,received,received?client.id:null,JSON.stringify(received?{statement:'Isolated received-order fixture'}:{}),'Isolated owner overview fixture'])).rows[0];
    await runtime.db.query('insert into zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context) values($1,1,1,$2,$3,$4,$5,$6,$7,$8)',[id,state.version,state.rules_revision,client.sheet,client.profileRevision,JSON.stringify(lines),product.wholesale,'{}']);
    fixtures[status]=row;
   }
   await runtime.db.query("select set_config('zzws.source','approval_requested',true)");
   await runtime.db.query('update zzws_orders set approval=$2,revision=revision+1,updated=now() where id=$1',[fixtures.confirmed.id,JSON.stringify({id:crypto.randomUUID(),state:'pending',lines,reviewRequestedMinutes:60,remindAfter:new Date(Date.now()+3600000).toISOString()})]);
   await runtime.db.query('insert into zzws_receipt_notices(order_id,number,customer,revision,received_at) values($1,$2,$3,$4,$5)',[fixtures.received.id,fixtures.received.number,JSON.stringify(fixtures.received.customer),fixtures.received.revision,fixtures.received.received_at]);
   await runtime.db.query('insert into zzws_admin_order_reads(user_id,order_id,revision) values($1,$2,1)',[owner.id,fixtures.rejected.id]);
   await runtime.db.exec('commit');
  }catch(error){await runtime.db.exec('rollback');throw error;}
  const snapshot=async()=>({summary:await api('admin/orders/summary',tokens.owner),dashboard:await api('admin/dashboard',tokens.owner),receipts:await api('admin/orders/receipt-notifications',tokens.owner),orders:await api('admin/orders',tokens.owner)});
  const initial=await snapshot();
  assert.equal(initial.summary.unreadCount,5,'One of six orders is already read by this owner');assert.equal(initial.dashboard.counts.approval_pending,1,'Deferred approval remains pending');assert.equal(initial.receipts.unreadCount,1,'One actual receipt notice is unread');
  assert.equal(initial.orders.orders.length,6);assert.equal(runtime.reportEmails.length,0);
  async function simulateReceipt(){
   await runtime.db.exec('begin');try{
    await runtime.db.query("select set_config('zzws.source','receipt',true),set_config('zzws.actor',$1,true)",[client.id]);
    const received=(await runtime.db.query("update zzws_orders set status='received',received_at=now(),received_by=$2,receipt=$3,revision=revision+1,updated=now() where id=$1 returning *",[fixtures.completed.id,client.id,JSON.stringify({statement:'Local receipt simulation',actor:{id:client.id}})])).rows[0];
    await runtime.db.query('insert into zzws_receipt_notices(order_id,number,customer,revision,received_at) values($1,$2,$3,$4,$5)',[received.id,received.number,JSON.stringify(received.customer),received.revision,received.received_at]);await runtime.db.exec('commit');
   }catch(error){await runtime.db.exec('rollback');throw error;}
  }
  async function simulateReopen(){
   await runtime.db.exec('begin');try{await runtime.db.query("select set_config('zzws.source','closed_order_reopened',true),set_config('zzws.actor',$1,true)",[owner.id]);await runtime.db.query("update zzws_orders set status='in_progress',received_at=null,received_by=null,receipt='{}',revision=revision+1,updated=now(),comment='Local reason-audited reopen simulation' where id=$1",[fixtures.completed.id]);await runtime.db.exec('commit');}catch(error){await runtime.db.exec('rollback');throw error;}
  }
  if(prepareOnly){
   await simulateReceipt();assert.equal((await api('admin/orders?status=unfinished',tokens.owner)).orders.length,3,'Receipt removes the delivered fixture from current');
   await simulateReopen();assert.equal((await api('admin/orders?status=unfinished',tokens.owner)).orders.length,4,'Reopening returns the fixture to current');
   console.log('PASS fixtures: six lifecycle statuses, initial unread=5/approval_pending=1/receipt notices=1, receipt/reopen group transitions; actual isolated API/SQL, no browser or orders API submission.');return;
  }
  const {createTrackedApkRuntime}=await import('../support/apk-runtime.mjs'),apk=createTrackedApkRuntime(runtime,{origin:base.origin});
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function pageFor(role){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(20000);
   await context.addInitScript(token=>{sessionStorage.clear();sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','ru');},tokens[role]);
   await context.route('**/js/api-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
   for(const service of ['zzws-api','zzws-apk'])await context.route('**/functions/v1/'+service+'/**',async route=>{
    const request=route.request(),name=new URL(request.url()).pathname.split('/'+service+'/')[1];requests.push({role,service,name,method:request.method()});
    if(request.method()==='POST')posts.push({role,service,name});
    const response=await (service==='zzws-api'?runtime:apk).handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));
    if(role==='owner'&&service==='zzws-api'&&name==='admin/orders/read'&&heldRead&&request.postDataJSON()?.id===heldRead.id){const pending=heldRead;heldRead=null;pending.entered.resolve();await pending.release.promise;}
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(role+': '+error.message));await page.goto(new URL('admin/',base).href);await page.locator('#workspace:visible').waitFor();await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-session-pending'));
   return {page,context};
  }
  async function tab(page,id){
   const button=page.locator('[data-tab="'+id+'"]');assert.equal(await button.count(),1,'One navigation target '+id);
   await page.evaluate(value=>window.ZZWS_ADMIN_MENU?.reveal(value),id);
   if(!await button.isVisible()){const more=page.locator('#adminMoreMenu');if(!await more.evaluate(element=>element.open))await more.locator(':scope > summary').click();}
   await button.click();await page.locator('#'+id+':visible').waitFor();
  }
  async function settledOverview(page){await page.locator('#dashboard:visible').waitFor();await page.waitForFunction(()=>document.getElementById('dashboard').getAttribute('aria-busy')==='false'&&!!document.querySelector('[data-overview-metric=unread][data-state=ready]'));}
  async function exactCounts(page,expected){
   await settledOverview(page);
   for(const [metric,value]of Object.entries(expected))assert.equal(Number((await page.locator('[data-overview-metric="'+metric+'"] .owner-overview-count').innerText()).replace(/\D/g,'')),value,'Actual '+metric+' overview count');
   assert.equal(await page.locator('#dashboardMetrics > button').count(),3,'Overview contains exactly three operational counts');
  }
  async function fits(page,label,root){for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' page fits '+width);if(root)assert.equal(await page.locator(root).evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,label+' content fits '+width);}await page.setViewportSize({width:1440,height:1000});}
  async function settledList(page,view){await page.locator('#'+view+':visible').waitFor();await page.waitForFunction(id=>document.getElementById(id).getAttribute('aria-busy')==='false',view==='manager'?'managerQueue':'adminOrderList');}
  async function ids(page,view){await settledList(page,view);return (await page.locator(view==='manager'?'#managerQueue [data-manager-order]':'#adminOrderList [data-admin-order-read]').evaluateAll(nodes=>nodes.map(node=>node.dataset.managerOrder||node.dataset.adminOrderRead))).sort();}
  async function sameIds(page,view,expected,label){assert.deepEqual(await ids(page,view),expected.map(row=>row.id).sort(),label);}
  const sessions={};for(const role of ['owner','manager','price'])sessions[role]=await pageFor(role);
  const ownerPage=sessions.owner.page;
  for(const [role,landing]of [['owner','dashboard'],['manager','manager'],['price','price']]){
   const page=sessions[role].page;
   assert.equal(await page.evaluate(()=>ZZWS_ADMIN_HOME.landingTab()),landing,role+' default landing');assert.equal(await page.locator('#'+landing).isVisible(),true,role+' sees default landing');
   const expected={orderSettings:role==='owner',mobileApp:role==='owner',accountSettings:true};
   for(const [target,allowed]of Object.entries(expected)){assert.equal(await page.locator('[data-tab="'+target+'"]').evaluate(button=>!button.hidden),allowed,role+' navigation permission '+target);assert.equal(await page.evaluate(id=>ZZWS_ADMIN_HOME.can(id),target),allowed,role+' route permission '+target);}
   if(role!=='owner'){await page.evaluate(()=>selectAdminTab('dashboard'));assert.equal(await page.locator('#dashboard').isVisible(),false,role+' cannot enter owner overview');await page.evaluate(()=>selectAdminTab('mobileApp'));assert.equal(await page.locator('#mobileApp').isVisible(),false,role+' cannot enter APK publication');}
   await tab(page,'accountSettings');assert.equal(await page.locator('#accountSettings #dashboardProtection').count(),1,role+' security moved into account');assert.equal(await page.locator('#accountSettings #adminResourcesPanel').count(),1,role+' resources moved into account');
  }
  await tab(ownerPage,'orderSettings');assert.equal(await ownerPage.locator('#orderSettings #receiptGlobalPanel').count(),1);assert.equal(await ownerPage.locator('#receiptGlobalControls select').count(),1);
  await tab(ownerPage,'mobileApp');assert.equal(await ownerPage.locator('#mobileApp #apkUploadPanel').count(),1);
  for(const id of ['dashboardProtection','adminResourcesPanel','receiptGlobalPanel','receiptGlobalControls','apkUploadPanel','backupHelp','adminOrderEditor','dashboardMetrics'])assert.equal(await ownerPage.locator('#'+id).count(),1,'Relocation preserves unique '+id);
  assert.equal(await ownerPage.locator('#operations #backupHelp').count(),1);assert.equal(await ownerPage.locator('#dashboard #receiptGlobalPanel,#dashboard #dashboardProtection,#dashboard #adminResourcesPanel,#dashboard #apkUploadPanel,#dashboard #backupHelp').count(),0,'Overview no longer embeds settings forms');
  await tab(ownerPage,'dashboard');await exactCounts(ownerPage,{unread:5,approval_pending:1,receipts:1});
  const metadata=initial.orders.orders.some(order=>Object.hasOwn(order,'adminReadRevision')||typeof order.unread==='boolean');
  if(!metadata){assert.equal(await ownerPage.locator('#ownerOverviewListTitle').innerText(),'Последние заказы');assert.match(await ownerPage.locator('#ownerOverviewList .owner-overview-note').innerText(),/сведения о просмотре отдельных заказов сервер не передал/i);}
  else{assert.equal(await ownerPage.locator('#ownerOverviewListTitle').innerText(),'Непросмотренные заказы');assert.equal(await ownerPage.locator('[data-overview-order="'+fixtures.rejected.id+'"]').count(),0,'Read order is absent from an actual unread list');}
  for(const [language,title]of [['hy','Ամփոփում'],['ru','Обзор']]){await ownerPage.evaluate(value=>ZZWS_I18N.setLanguage(value),language);assert.equal(await ownerPage.locator('#dashboard > h1').evaluate(element=>{const title=element.cloneNode(true);title.querySelectorAll('.context-help').forEach(help=>help.remove());return title.textContent.trim();}),title);await exactCounts(ownerPage,{unread:5,approval_pending:1,receipts:1});await fits(ownerPage,'Overview '+language,'#dashboard');}
  const output=path.resolve(process.env.ZZWS_SCREENSHOT_DIR||'output/owner-overview');fs.mkdirSync(output,{recursive:true});
  assert.equal(await ownerPage.locator('#dashboardPrice').isVisible(),false,'Legacy price text does not duplicate the overview price panel');
  await ownerPage.locator('#dashboard').screenshot({path:path.join(output,'overview-desktop.png')});await ownerPage.screenshot({path:path.join(output,'shell-desktop.png')});await ownerPage.setViewportSize({width:390,height:1000});await ownerPage.locator('#dashboard').screenshot({path:path.join(output,'overview-mobile.png')});await ownerPage.screenshot({path:path.join(output,'shell-mobile.png')});await ownerPage.setViewportSize({width:1440,height:1000});
  await ownerPage.locator('[data-overview-metric=receipts]').click();assert.equal(await ownerPage.locator('[data-overview-order="'+fixtures.received.id+'"]').count(),1,'Actual receipt notice is available in the receipt panel');
  await ownerPage.locator('[data-overview-metric=unread]').click();await ownerPage.locator('[data-overview-order="'+fixtures.completed.id+'"]').click();await ownerPage.locator('#adminOrderEditor:visible').waitFor();assert.ok((await ownerPage.locator('#selectedOrderTitle').innerText()).includes(String(fixtures.completed.number)),'Overview opens the shared order editor');assert.equal(await ownerPage.locator('#adminOrderEditor').count(),1);
  await ownerPage.locator('#closeAdminOrder').click();await tab(ownerPage,'dashboard');await exactCounts(ownerPage,{unread:4,approval_pending:1,receipts:1});
  await ownerPage.evaluate(()=>{document.getElementById('orderSearch').value='No match';document.getElementById('orderDatefrom').value='2000-01-01';document.getElementById('orderDateto').value='2000-01-02';});
  await ownerPage.locator('[data-overview-metric=approval_pending]').click();await sameIds(ownerPage,'orders',[fixtures.confirmed],'Approval metric filters actual pending approvals');assert.equal(await ownerPage.locator('#orderStatusFilter').inputValue(),'approval_pending');assert.equal(await ownerPage.locator('#orderSearch').inputValue(),'');assert.equal(await ownerPage.locator('#orderDatefrom').inputValue(),'');
  await ownerPage.locator('#orders [data-order-group=unfinished]').click();await sameIds(ownerPage,'orders',['new','confirmed','in_progress','completed'].map(status=>fixtures[status]),'Current table includes delivered orders awaiting receipt');
  await ownerPage.locator('#orders [data-order-status=completed]').click();await sameIds(ownerPage,'orders',[fixtures.completed],'Delivered-awaiting-receipt status is a current subfilter');
  await ownerPage.locator('#adminOrdersHub [data-orders-view=manager]').click();await sameIds(ownerPage,'manager',[fixtures.completed],'Queue preserves the delivered status filter');assert.equal(await ownerPage.locator('#managerStatusFilter').inputValue(),'completed');
  await ownerPage.locator('#manager [data-order-group=finished]').click();await sameIds(ownerPage,'manager',[fixtures.received,fixtures.rejected],'Finished queue contains only received/rejected');
  await ownerPage.locator('#adminOrdersHub [data-orders-view=orders]').click();await sameIds(ownerPage,'orders',[fixtures.received,fixtures.rejected],'Table preserves finished group');assert.equal(await ownerPage.locator('#orderStatusFilter').inputValue(),'finished');
  // Simulate receipt through controlled local SQL, with the same trusted source flags as receipt/reopen transactions.
  await simulateReceipt();
  await ownerPage.locator('#refreshAdminOrders').click();await sameIds(ownerPage,'orders',[fixtures.completed,fixtures.received,fixtures.rejected],'Receipt moves delivered order to finished table');
  await ownerPage.locator('#orders [data-order-group=unfinished]').click();await sameIds(ownerPage,'orders',['new','confirmed','in_progress'].map(status=>fixtures[status]),'Received order is removed from current');
  await simulateReopen();
  await ownerPage.locator('#refreshAdminOrders').click();await sameIds(ownerPage,'orders',['new','confirmed','in_progress','completed'].map(status=>fixtures[status]),'Reopened order returns to current table');
  await ownerPage.locator('#adminOrdersHub [data-orders-view=manager]').click();await sameIds(ownerPage,'manager',['new','confirmed','in_progress','completed'].map(status=>fixtures[status]),'Reopened order appears in the same current queue');
  await ownerPage.locator('#manager [data-order-group=finished]').click();await sameIds(ownerPage,'manager',[fixtures.received,fixtures.rejected],'Reopened order is absent from finished');
  await ownerPage.locator('#managerSearch').fill('NO-MATCH-owner-overview-fixture');
  await ownerPage.waitForFunction(()=>document.getElementById('managerQueue').getAttribute('aria-busy')==='false'&&document.querySelectorAll('#managerQueue [data-manager-order]').length===0);
  await ownerPage.evaluate(()=>{document.getElementById('orderSearch').value='NO-MATCH-owner-overview-fixture';document.getElementById('orderDatefrom').value='2000-01-01';document.getElementById('orderDateto').value='2000-01-02';});
  await tab(ownerPage,'dashboard');await settledOverview(ownerPage);
  await ownerPage.locator('#ownerOverviewList').getByRole('button',{name:'Открыть заказы',exact:true}).click();
  await sameIds(ownerPage,'manager',['new','confirmed','in_progress','completed'].map(status=>fixtures[status]),'Open orders explicitly resets the remembered finished/search state to current');
  for(const id of ['managerSearch','orderSearch','orderDatefrom','orderDateto'])assert.equal(await ownerPage.locator('#'+id).inputValue(),'','Open orders clears '+id);
  assert.equal(await ownerPage.locator('#managerStatusFilter').inputValue(),'unfinished');assert.equal(await ownerPage.locator('#orderStatusFilter').inputValue(),'unfinished');
  // Reuse the same document to ensure leaving the owner session removes its rendered order data.
  await tab(ownerPage,'dashboard');await settledOverview(ownerPage);
  assert.ok(await ownerPage.locator('#ownerOverviewRows [data-overview-order]').count()>0,'Owner data is actually rendered before the session switch');
  const delayedAck={id:fixtures.new.id,entered:deferred(),release:deferred()};heldRead=delayedAck;releaseHeldRead=delayedAck.release.resolve;
  await ownerPage.evaluate(id=>{window.__pendingOverviewOpen=ZZWS_OVERVIEW_NAV.openOrder(id).then(()=>({settled:true}),error=>({settled:true,error:error?.message,staleSession:error?.staleSession===true}));},fixtures.new.id);
  await within(delayedAck.entered.promise,'The real order-read acknowledgement did not reach the held response');
  await ownerPage.evaluate(()=>{ZZWS.clearSession();showLogin();});
  assert.equal(await ownerPage.locator('#ownerOverviewRows [data-overview-order]').count(),0,'showLogin removes stale owner rows before another account enters');
  assert.equal(await ownerPage.locator('#dashboardMetrics [data-overview-metric]').count(),0,'showLogin clears owner counters');
  await ownerPage.evaluate(async token=>{sessionStorage.setItem('zzws_session_v3',token);sessionStorage.removeItem('zzws_admin_tab_v1');history.replaceState(null,'',location.pathname+location.search);await enter();},tokens.price);
  await ownerPage.locator('#price:visible').waitFor();
  assert.equal(await ownerPage.evaluate(()=>ZZWS_ADMIN_HOME.landingTab()),'price','The same page re-enters with the actual price account');
  assert.equal(await ownerPage.locator('#ownerOverviewRows [data-overview-order]').count(),0,'Price account does not inherit owner rows in hidden DOM');
  assert.equal(await ownerPage.locator('#dashboardMetrics [data-overview-metric]').count(),0,'Price account does not inherit owner counters');
  assert.equal(await ownerPage.locator('[data-tab=dashboard]').evaluate(button=>button.hidden),true,'Overview remains inaccessible after the role switch');
  delayedAck.release.resolve();releaseHeldRead=null;
  const lateOpen=await ownerPage.evaluate(()=>window.__pendingOverviewOpen);assert.equal(lateOpen.settled,true);if(lateOpen.error)assert.equal(lateOpen.staleSession,true,'Only the expected stale-session rejection is allowed');
  assert.equal(await ownerPage.locator('#price').isVisible(),true,'Late owner read acknowledgement cannot navigate the price account');
  assert.equal(await ownerPage.evaluate(()=>ZZWS_HELP_USER.adminScope),'price','The active actor remains the price account');
  assert.equal(await ownerPage.locator('#managerCustomer').innerText(),'','Late owner continuation cannot repaint the customer in hidden DOM');
  assert.equal(await ownerPage.locator('#managerQueue [data-manager-order],#adminOrderList [data-admin-order-read]').count(),0,'Owner order rows stay cleared after late acknowledgement');
  assert.equal(await ownerPage.locator('#adminOrderEditor').isVisible(),false,'Late owner continuation cannot reopen the shared editor');
  assert.equal(await ownerPage.evaluate(()=>ZZWS_ADMIN_ORDERS.context()?.id||null),null,'No owner order is selected in the price session');
  assert.equal(await ownerPage.evaluate(()=>ZZWS_ADMIN_WORKBENCH.navigationState().selectedId||null),null,'No stale customer is selected by the workbench');
  assert.deepEqual(errors,[]);assert.ok(posts.every(post=>post.service==='zzws-api'&&['admin/orders/detail','admin/orders/read'].includes(post.name)),'Only ordinary order-open/read POSTs are allowed: '+JSON.stringify(posts));assert.equal(runtime.reportEmails.length,0);assert.equal((await runtime.db.query('select count(*)::int n from zzws_orders')).rows[0].n,6,'Browser navigation never creates orders');
  console.log('PASS: actual owner/manager/price landings and permissions, relocated settings, honest overview counters/fallback, HY/RU desktop/mobile, shared queue/table filters and receipt/reopen lifecycle groups.');
 }finally{releaseHeldRead?.();await browser?.close();await runtime.close();if(site)await site.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
