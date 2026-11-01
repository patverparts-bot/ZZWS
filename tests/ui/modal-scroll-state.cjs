// Focused state regression for the shared modal scroll containment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'output/mobile-window-scroll');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')(),base=new URL(process.env.ZZWS_TEST_URL||site.url),{createRuntime}=await import('../support/runtime.mjs'),runtime=await createRuntime({memory:true,debug:true,origin:base.origin});
 let browser;const checks=[],errors=[];let submitted=0,saved=0;
 const api=async(route,token,value)=>{const response=await runtime.handle(new Request(new URL('functions/v1/zzws-api/'+route,base),{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));const data=await response.json();assert.equal(response.status,200,route+': '+JSON.stringify(data));return data;};
 const frame=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 try{
  const token=(await api('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken,products=(await api('catalog',token)).products;
  await api('me/state',token,{section:'cart',version:0,value:Object.fromEntries(products.map(p=>[p.articul,{articul:p.articul,qty:1,addedPrice:p.wholesale}]))});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const modes=(process.env.ZZWS_SCROLL_MODES||'web,embedded').split(','),widths=(process.env.ZZWS_SCROLL_WIDTHS||'320,390').split(',').map(Number);
  for(const mode of modes)for(const width of widths){
   assert.ok(['web','embedded'].includes(mode)&&[320,390].includes(width));
   const context=await browser.newContext({viewport:{width,height:mode==='embedded'?692:740},isMobile:true,hasTouch:true});context.setDefaultTimeout(10000);
   await context.addInitScript(token=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1','ru');},token);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/js/api-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
   await page.route('https://www.zigzag.am/**',route=>route.fulfill({status:404,body:''}));
   await page.route('**/functions/v1/zzws-api/**',async route=>{const q=route.request(),name=new URL(q.url()).pathname.split('/zzws-api/')[1];if(name==='orders'&&q.method()==='POST')submitted++;if(name==='me/carts'&&q.method()==='POST')saved++;const response=await runtime.handle(new Request(q.url(),{method:q.method(),headers:q.headers(),...(!['GET','HEAD'].includes(q.method())?{body:q.postDataBuffer()}:{})}));await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
   await page.goto(base.href);await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded&&Object.keys(cart).length>5);
   if(mode==='embedded')await page.evaluate(fs.readFileSync(path.join(root,process.env.ZZWS_ANDROID_SOURCE||'android','assets/partner-navigation.js'),'utf8'));
   await page.evaluate(()=>ZZWS_STOREFRONT.navigate('catalog'));await frame(page);
   const before=await page.evaluate(()=>{window.scrollTo(0,180);return {y:scrollY,max:document.documentElement.scrollHeight-innerHeight};});assert.ok(before.max>250,'Actual catalogue must provide a scrollable background');assert.ok(before.y>0);
   await page.evaluate(()=>{openOrderModal();ZZWS_CHECKOUT.go(1);document.getElementById('savedCartsPanel').open=true;});
   await page.locator('#savedCartTitle').fill('UNSAVED scroll state '+mode+' '+width);
   await page.locator('#modalBody').evaluate(n=>{n.scrollTop=Math.min(240,n.scrollHeight-n.clientHeight);});
   const parentBefore=await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,title:document.getElementById('savedCartTitle').value,y:scrollY}));assert.ok(parentBefore.top>0,'Parent checkout must already be scrolled');
   await page.evaluate(()=>ZZWS_CONTEXT_HELP.open('saved-carts'));await page.locator('#contextHelpDialog>div section').waitFor();
   const inner=page.locator('#contextHelpDialog>div');await inner.evaluate(n=>{n.scrollTop=n.scrollHeight;});const rect=await inner.boundingBox();assert.ok(rect);await page.mouse.move(rect.x+rect.width/2,Math.min(page.viewportSize().height-3,rect.y+rect.height-5));await page.mouse.wheel(0,700);await frame(page);
   const afterWheel=await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,title:document.getElementById('savedCartTitle').value,y:scrollY}));assert.deepEqual(afterWheel,parentBefore,'Top dialog wheel cannot move parent or discard unsaved text');
   await page.locator('#contextHelpDialog header button').click();await page.locator('#contextHelpDialog').waitFor({state:'detached'});await frame(page);
   assert.equal(await page.locator('#orderModal').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('zzws-modal-scroll-lock')),true,'Closing child must keep parent modal locked');
   assert.deepEqual(await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,title:document.getElementById('savedCartTitle').value,y:scrollY})),parentBefore,'Closing child preserves parent position and unsaved text');
   checks.push({name:'nested parent scroll and unsaved field',mode,width,passed:true});console.log('PASS nested parent scroll and unsaved field '+mode+' '+width);
   await page.locator('#orderModal button[onclick="closeOrderModal()"]').first().click();await page.locator('#orderModal').waitFor({state:'hidden'});await frame(page);
   assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('zzws-modal-scroll-lock')),false,'Last modal closure must unlock the page');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<=1,'Last modal closure restores exact page position');
   assert.equal(await page.locator('#savedCartTitle').inputValue(),parentBefore.title,'Last closure retains the unsubmitted field');
   const moved=await page.evaluate(()=>{const y=scrollY;window.scrollBy(0,80);return {before:y,after:scrollY};});assert.ok(moved.after>moved.before,'Page scroll must work again after closing last modal');
   await page.evaluate(()=>openOrderModal());assert.equal(await page.locator('#savedCartTitle').inputValue(),parentBefore.title,'Reopening retains unsaved text');await page.evaluate(()=>closeOrderModal());
   checks.push({name:'last modal position restoration and unlock',mode,width,passed:true});console.log('PASS last modal position restoration and unlock '+mode+' '+width);
   // Bulk entry is an actual nested fixed overlay, unlike native HTML dialogs.
   // Its layer must stay above the still-open checkout, not merely above headers.
   await page.evaluate(()=>{openOrderModal();ZZWS_CHECKOUT.go(1);document.getElementById('savedCartsPanel').open=true;});
   await page.locator('#savedCartTitle').fill('UNSAVED nested bulk '+mode+' '+width);
   await page.locator('#modalBody').evaluate(n=>{n.scrollTop=30;});
   const beforeBulk=await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,title:document.getElementById('savedCartTitle').value,step:document.getElementById('orderModal').dataset.checkoutStep,cart:JSON.stringify(cart)}));assert.ok(beforeBulk.top>0);
   await page.locator('#orderModal .checkout-preparation-actions button').nth(1).click();
   await page.locator('#bulkAddInput').click();await page.locator('#bulkAddInput').fill('test-002\t2');
   assert.equal(await page.locator('#orderModal').isVisible(),true,'Checkout stays behind the nested bulk window');
   assert.ok(await page.locator('#bulkAddInput').evaluate(n=>{const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===n||n.contains(hit);}), 'Nested bulk input must actually receive the pointer above checkout');
   const bulkScroller=page.locator('#bulkAddModal>div');await bulkScroller.evaluate(n=>{n.scrollTop=n.scrollHeight;});
   const beforeBulkWheel=await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,y:scrollY})),bulkRect=await bulkScroller.boundingBox();assert.ok(bulkRect);await page.mouse.move(bulkRect.x+bulkRect.width/2,Math.min(page.viewportSize().height-3,bulkRect.y+bulkRect.height-5));await page.mouse.wheel(0,700);await frame(page);
   assert.equal(await page.locator('#bulkAddModal').isVisible(),true);assert.deepEqual(await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,y:scrollY})),beforeBulkWheel,'Bulk bottom-edge wheel cannot scroll checkout or the page');
   await page.locator('#bulkAddModal button[onclick="closeBulkAddModal()"]').first().click();await page.locator('#bulkAddModal').waitFor({state:'hidden'});await frame(page);
   assert.equal(await page.locator('#orderModal').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('zzws-modal-scroll-lock')),true);
   assert.deepEqual(await page.evaluate(()=>({top:document.getElementById('modalBody').scrollTop,title:document.getElementById('savedCartTitle').value,step:document.getElementById('orderModal').dataset.checkoutStep,cart:JSON.stringify(cart)})),beforeBulk,'Closing bulk preserves checkout position, stage, unsaved field and cart');
   await page.locator('#orderModal button[onclick="closeOrderModal()"]').first().click();await frame(page);assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('zzws-modal-scroll-lock')),false);
   checks.push({name:'actual checkout to bulk layering and parent state',mode,width,passed:true});console.log('PASS actual checkout to bulk layering and parent state '+mode+' '+width);
   // A real reload restores the modal before restoring document scroll. Closing
   // that restored modal must retain the saved catalogue background, not y0.
   await page.waitForFunction(()=>window.ZZWS_PAGE_STATE?.ready);
   const reloadBefore=await page.evaluate(async()=>{ZZWS_STOREFRONT.navigate('catalog');window.scrollTo(0,180);openOrderModal();ZZWS_CHECKOUT.go(1);ZZWS_MEMORY.capture();await ZZWS_MEMORY.flush();ZZWS_PAGE_STATE.save();const state=JSON.parse(sessionStorage.getItem('zzws_page_v1'));return {y:scrollY,savedY:state.scrollY,overlay:state.overlay,step:document.getElementById('orderModal').dataset.checkoutStep};});assert.ok(reloadBefore.y>=120);assert.equal(reloadBefore.savedY,reloadBefore.y);assert.equal(reloadBefore.overlay,'cart');
   await page.reload();await page.waitForFunction(()=>window.ZZWS_PAGE_STATE?.ready&&!document.getElementById('orderModal').classList.contains('hidden')&&Object.keys(cart).length>5);await frame(page);
   if(mode==='embedded')await page.evaluate(fs.readFileSync(path.join(root,process.env.ZZWS_ANDROID_SOURCE||'android','assets/partner-navigation.js'),'utf8'));
   assert.equal(await page.evaluate(()=>document.getElementById('orderModal').dataset.checkoutStep),reloadBefore.step);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-reloadBefore.y)<=1,'Reload restores the catalogue background while checkout is open');
   await page.locator('#orderModal button[onclick="closeOrderModal()"]').first().click();await page.locator('#orderModal').waitFor({state:'hidden'});await frame(page);
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-reloadBefore.y)<=1,'Closing checkout after actual reload retains the saved catalogue position');assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('zzws-modal-scroll-lock')),false);
   checks.push({name:'actual modal-open reload preserves catalogue background after close',mode,width,passed:true});console.log('PASS actual modal-open reload preserves catalogue background after close '+mode+' '+width);
   await context.close();
  }
  assert.equal(submitted,0);assert.equal(saved,0);assert.equal(runtime.reportEmails.length,0);assert.deepEqual(errors,[]);
 }finally{
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'modal-state-'+Date.now()+'.json'),JSON.stringify({checks,errors,submitted,saved,productionWrites:0,realOutboundMessages:0},null,2)+'\n');await browser?.close();await runtime.close();if(site)await site.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
