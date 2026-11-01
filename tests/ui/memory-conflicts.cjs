const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')(),base=new URL(process.env.ZZWS_TEST_URL||site.url);
 const {createRuntime}=await import('../support/runtime.mjs'),runtime=await createRuntime({memory:true,origin:base.origin});let browser;
 const errors=[],prompts=[],requests=[],checks=[];let mode=null,holdStarted,holdRelease,answer=false;
 const direct=async(path,token,data)=>{const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+path,base),{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));const value=await response.json();assert.equal(response.status,200,path+': '+JSON.stringify(value));return value;};
 const record=name=>{checks.push({name,result:'passed'});console.log('PASS '+name);};
 try{
  const token=(await direct('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken,owner=(await direct('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  const me=await direct('me',token),product=(await direct('catalog',token)).products.find(p=>p.articul==='900002'),sku=product.articul;
  browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1280,height:900}});context.setDefaultTimeout(15000);
  await context.addInitScript(t=>{sessionStorage.setItem('zzws_session_v3',t);localStorage.setItem('zzws_language_v1','ru');const interval=window.setInterval;window.setInterval=(fn,ms,...args)=>ms===1200?0:interval(fn,ms,...args);},token);
  await context.route('**/js/api-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('https://www.zigzag.am/**',route=>route.fulfill({status:404,body:''}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname.split('/zzws-api/')[1],payload=request.method()==='POST'?request.postDataJSON():null;
   const response=await runtime.handle(new Request(request.url(),{method:request.method(),headers:request.headers(),...(!['GET','HEAD'].includes(request.method())?{body:request.postDataBuffer()}:{})}));
   const body=Buffer.from(await response.arrayBuffer());
   if(path==='me/state'&&payload?.section==='cart'){
    requests.push({payload,status:response.status,response:JSON.parse(body.toString())});
    if(mode==='lose'&&response.status===200){mode=null;await route.abort('failed');return;}
    if(mode==='hold'&&response.status===409){mode=null;holdStarted();await new Promise(resolve=>{holdRelease=resolve;});}
   }
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{if(dialog.type()==='confirm'){prompts.push(dialog.message());await (answer?dialog.accept():dialog.dismiss());}else await dialog.accept();});
  const open=async()=>{await page.goto(base.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded&&window.ZZWS_MEMORY);};
  const flush=()=>page.evaluate(()=>ZZWS_MEMORY.flush());
  const setQty=qty=>page.evaluate(({sku,qty})=>{setDirectQty(sku,qty);ZZWS_MEMORY.capture();},{sku,qty});
  const pending=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('zzws_pending_'+id)||'{}'),me.id);
  const current=()=>direct('me/state',token);
  const cartValue=qty=>({[sku]:{articul:sku,qty,addedPrice:product.wholesale,addedPriceMode:'WS'}});
  await open();

  // Server commits, but the browser never receives its acknowledgement. Reload
  // restores the persisted pending request with the pre-commit section version.
  mode='lose';await setQty(2);await flush();const lost=requests.at(-1);assert.equal(lost.status,200);assert.equal((await pending()).cart.version,lost.payload.version);assert.equal((await current()).data.cart[sku].qty,2);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded&&window.ZZWS_MEMORY);await flush();
  assert.equal(prompts.length,0);assert.equal((await pending()).cart,undefined);assert.equal(await page.evaluate(sku=>cart[sku].qty,sku),2);assert.equal((await current()).versions.cart,lost.response.version);
  const replay=requests.findLast(r=>r.status===409);assert.ok(replay);assert.deepEqual(replay.response.value,replay.payload.value);assert.notEqual(JSON.stringify(replay.response.value),JSON.stringify(replay.payload.value),'SQL JSONB key order differs, so equality must not depend on serialization order');
  record('committed cart with lost response survives reload and stale-version retry without a false other-device prompt or extra server write');

  // While the identical-value conflict response is delayed, a genuinely newer
  // local edit must retain its value and advance to the acknowledged version.
  mode='lose';await setQty(3);await flush();const committed=(await current()).versions.cart;
  const held=new Promise(resolve=>{holdStarted=resolve;});mode='hold';const inflight=flush();await held;await setQty(4);holdRelease();await inflight;
  const newer=(await pending()).cart;assert.equal(newer.value[sku].qty,4);assert.equal(newer.version,committed);assert.equal(prompts.length,0);assert.equal((await current()).data.cart[sku].qty,3);
  await flush();assert.equal((await pending()).cart,undefined);assert.equal((await current()).data.cart[sku].qty,4);assert.equal((await current()).versions.cart,committed+1);
  record('identical acknowledged payload advances a newer pending cart edit without deleting it; next save uses the new version');

  // Another device changes the value, so the conflict must still be visible.
  let state=await current();await direct('me/state',token,{section:'cart',version:state.versions.cart,value:cartValue(8)});await setQty(5);answer=false;await flush();
  assert.equal(prompts.length,1);assert.equal(await page.evaluate(sku=>cart[sku].qty,sku),8);assert.equal((await pending()).cart,undefined);assert.equal((await current()).data.cart[sku].qty,8);
  record('different remote cart still prompts; choosing server data preserves the competing edit');

  state=await current();await direct('me/state',token,{section:'cart',version:state.versions.cart,value:cartValue(9)});await setQty(6);answer=true;await flush();
  assert.equal(prompts.length,2);assert.equal((await pending()).cart.value[sku].qty,6);assert.equal((await current()).data.cart[sku].qty,9);await flush();assert.equal((await current()).data.cart[sku].qty,6);assert.equal((await pending()).cart,undefined);assert.equal(prompts.length,2);
  record('different remote cart still prompts; explicit keep-local choice retains the edit and resubmits with the remote version');

  // Administrator clear wins even when the submitted local value is also empty.
  await setQty(0);await direct('account/reauth',owner,{password:'24681012'});const report=await direct('admin/storage',owner),row=report.users.find(u=>u.id===me.id);await direct('admin/storage/clear',owner,{targetId:me.id,section:'cart',revision:row.revision,confirm:true});await flush();
  assert.equal(prompts.length,2);assert.equal((await pending()).cart,undefined);assert.deepEqual(await page.evaluate(()=>cart),{});assert.match(await page.locator('#memoryStatus').innerText(),/администратор|Ադմինիստրատոր/i);
  record('administrator-clear conflict keeps its priority over equal-value acknowledgement');

  // Delay an actual, fully parsed API conflict until a different authenticated
  // account has started. This covers the gap after the API client's token check.
  const otherToken=(await direct('login',null,{login:'zzws-test-kp',password:'24681012'})).sessionToken,otherMe=await direct('me',otherToken);
  await direct('me/state',otherToken,{section:'cart',version:0,value:cartValue(11)});
  await page.evaluate(()=>{const original=ZZWS;window.ZZWS={...original,json:async(...args)=>{try{return await original.json(...args);}catch(e){if(window.__holdParsedConflict&&args[0]==='me/state'&&args[1]?.method==='POST'&&e.status===409){window.__holdParsedConflict=false;window.__parsedConflictReady=true;await new Promise(resolve=>{window.__releaseParsedConflict=resolve;});}throw e;}}};});
  const switchAccount=async(next,session)=>page.evaluate(async({next,session})=>{ZZWS_MEMORY.stop();sessionStorage.setItem('zzws_session_v3',session);serverIdentity=next;authorizedClient=next.client;clientRowsData=next.rowsList;userSheetType=next.sheet;await ZZWS_MEMORY.start(next);document.getElementById('memoryStatus').textContent='NEW ACCOUNT READY';},{next,session});
  await setQty(3);state=await current();await direct('me/state',token,{section:'cart',version:state.versions.cart,value:cartValue(8)});
  await page.evaluate(()=>{window.__holdParsedConflict=true;window.__parsedConflictReady=false;});let oldFlush=flush();await page.waitForFunction(()=>window.__parsedConflictReady);await switchAccount(otherMe,otherToken);await page.evaluate(()=>window.__releaseParsedConflict());await oldFlush;
  assert.equal(prompts.length,2);assert.equal(await page.evaluate(sku=>cart[sku].qty,sku),11);assert.equal(await page.locator('#memoryStatus').innerText(),'NEW ACCOUNT READY');assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('zzws_pending_'+id)||'{}').cart,otherMe.id),undefined);
  record('delayed genuine conflict from the old account cannot prompt or apply its cart after another account starts');

  await setQty(0);const storage=await direct('admin/storage',owner),otherRow=storage.users.find(u=>u.id===otherMe.id);await direct('admin/storage/clear',owner,{targetId:otherMe.id,section:'cart',revision:otherRow.revision,confirm:true});
  await page.evaluate(()=>{window.__holdParsedConflict=true;window.__parsedConflictReady=false;});oldFlush=flush();await page.waitForFunction(()=>window.__parsedConflictReady);await switchAccount(me,token);const ownPending=await pending();assert.equal(ownPending.cart.value[sku].qty,3);await page.evaluate(()=>window.__releaseParsedConflict());await oldFlush;
  assert.equal(prompts.length,2);assert.equal(await page.evaluate(sku=>cart[sku].qty,sku),3);assert.deepEqual(await pending(),ownPending);assert.equal(await page.locator('#memoryStatus').innerText(),'NEW ACCOUNT READY');
  record('delayed cleared-state conflict cannot clear a new account cart or its pending edits');
  assert.deepEqual(errors,[]);await context.close();
 }finally{
  fs.mkdirSync('work/full-diagnostics',{recursive:true});fs.writeFileSync('work/full-diagnostics/memory-conflicts-results.json',JSON.stringify({checks,prompts:prompts.length,errors,cartRequests:requests,productionMutations:0},null,2));await browser?.close();await runtime.close();await site?.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
