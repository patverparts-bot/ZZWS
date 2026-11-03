const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?{url:process.env.ZZWS_TEST_URL,close:async()=>{}}:await require('../support/serve-site.cjs')(),browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const [width,lang]of [[390,'hy'],[1440,'ru']]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],posts=[],reads=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const user={id:'11111111-1111-4111-8111-111111111111',login:'approval',client:'Review customer',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[]},before=['A','B','C'].map((articul,i)=>({articul,name:['TV','Fridge','Washer'][i],qty:2,unitPrice:100+i*10}));
  const makeOrder=number=>({id:'order-'+number,number,user_id:user.id,status:'confirmed',revision:2,created:new Date().toISOString(),updated:new Date().toISOString(),lines:before,original_lines:before,total:660,delivery:{},approval:{id:'proposal-'+number,state:'pending',beforeLines:before,lines:[{...before[0],qty:3,unitPrice:90},before[2]],comment:'Review changes'}});
  let orders=[makeOrder(42)],events=[{id:'event-42',order_id:'order-42',revision:2,detail:{number:42,status:'confirmed',kind:'approval_requested'},created:new Date().toISOString()}];
  await page.addInitScript(lang=>{sessionStorage.setItem('zzws_session_v3','a'.repeat(64));localStorage.setItem('zzws_language_v1',lang);},lang);
  await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(!url.pathname.includes('/zzws-api/')){if(url.origin!==new URL(site.url).origin)return route.fulfill({json:{}});return route.continue();}
   const name=url.pathname.split('/zzws-api/')[1],body=req.method()==='POST'?req.postDataJSON():null;let data={};
   if(name==='me')data=user;if(name==='catalog')data={products:[],version:'approval'};if(name==='catalog/version')data={version:'approval'};if(name==='me/state')data={data:{},versions:{}};if(name==='me/carts')data={carts:[]};if(name==='me/bulletins')data={bulletins:[]};
   if(name==='orders/receipt-state')data={enabled:true,blocked:false,pendingCount:1,remaining:2};if(name==='orders/notifications')data={events};
   if(name==='orders/approval-pending')data={orders:orders.filter(o=>o.approval.state==='pending').map(o=>({id:o.id,number:o.number,revision:o.revision,proposalId:o.approval.id,reminderDue:false}))};
   if(name==='orders')data={orders:url.searchParams.has('receiptPending')||url.searchParams.has('search')?[]:orders};if(name==='orders/detail')data={order:orders.find(o=>o.id===body.id),events:[]};
   if(name==='orders/read'){reads.push(body);events=events.filter(e=>e.order_id!==body.orderId);data={ok:true};}
   if(name==='orders/approval'){posts.push(body);const order=orders.find(o=>o.id===body.orderId);assert.equal(body.revision,order.revision);assert.equal(body.proposalId,order.approval.id);assert.equal(body.decision,'accept');assert.equal(body.declinedArticuls.length,0);order.lines=order.approval.lines;order.total=order.lines.reduce((n,l)=>n+l.qty*l.unitPrice,0);order.approval.state='approved';order.revision++;events=events.filter(e=>e.order_id!==order.id);data={order};}
   return route.fulfill({json:data});
  });
  await page.goto(site.url);await page.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded);const notice=page.locator('#orderNotificationNotice');await notice.waitFor({state:'visible'});assert((await notice.innerText()).includes('42'));assert.equal(await notice.evaluate(e=>e.tagName),'DIV');
  await page.evaluate(()=>{document.getElementById('pendingReceiptOnly').checked=true;document.getElementById('serverOrderSearch').value='unrelated filter';});
  await notice.locator('button').click();const selected=page.locator('#orderNotificationList');await selected.locator('.order-approval[data-approval-state=pending]').waitFor();assert((await selected.innerText()).includes('42'));assert.equal(await selected.locator('.order-approval .comparison-removed').count(),1);assert.equal(await selected.locator('.order-approval [data-approval-articul]').count(),2);
  await page.waitForFunction(()=>document.querySelector('#orderNotificationNotice')?.hidden===false);assert.equal(posts.length,0);assert(reads.some(r=>r.orderId==='order-42'));assert(await notice.isVisible(),'Reading must not hide a pending decision');
  orders.push(makeOrder(43));await page.evaluate(()=>ZZWS_ORDERS.openNotice());assert.equal(await selected.locator('[data-pending-approval-order]').count(),2);await selected.locator('[data-pending-approval-order=order-43]').click();await selected.locator('.order-approval[data-approval-id=proposal-43]').waitFor();
  await selected.locator('[data-approval-accept]').click();await page.waitForFunction(()=>document.querySelector('#orderNotificationList .order-approval')?.dataset.approvalState==='approved');assert.equal(posts.length,1);assert.equal(posts[0].orderId,'order-43');assert(await notice.isVisible());
  await page.evaluate(()=>ZZWS_ORDERS.openNotice());await selected.locator('.order-approval[data-approval-id=proposal-42]').waitFor();fs.mkdirSync('output/approval-notice',{recursive:true});await page.screenshot({path:`output/approval-notice/direct-${width}-${lang}.png`});
  await selected.locator('[data-approval-accept]').click();await notice.waitFor({state:'hidden'});assert.equal(posts.length,2);assert.equal(posts[1].orderId,'order-42');assert.equal(orders[0].total,510);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Direct pending-order banner works through unrelated filters; actual pending list, multiple orders, read without approval, exact response payload, final disappearance, HY/RU and mobile passed');
 }finally{await browser.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
