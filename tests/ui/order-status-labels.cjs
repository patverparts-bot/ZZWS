const assert=require('node:assert/strict'),{chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')(),base=process.env.ZZWS_TEST_URL||site.url;let browser;
 const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');const errors=[];
 const customer={id:'11111111-1111-4111-8111-111111111111',role:'client',login:'status-client',client:'Status buyer',customerCode:'610000',sheet:'Dealers',active:true,allBrands:true,rowsList:[],person:{firstName:'Test',lastName:'Buyer',phone:'+37499123456',email:'test@example.am'}};
 const order={id:'22222222-2222-4222-8222-222222222222',user_id:customer.id,number:18,revision:4,status:'in_progress',customer,lines:[],original_lines:[],total:0,delivery:{},created:new Date().toISOString(),updated:new Date().toISOString(),events:[]};
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  async function open(role){const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{sessionStorage.setItem('zzws_session_v3','a'.repeat(64));localStorage.setItem('zzws_language_v1','ru');});
   await page.route('**/functions/v1/zzws-api/**',async route=>{const name=new URL(route.request().url()).pathname.split('/zzws-api/')[1];let data={};
    if(name==='me')data=role==='admin'?{...customer,id:'33333333-3333-4333-8333-333333333333',role:'admin',adminScope:'owner',permissions:['orders:read','orders:write','price:read','users','rules','audit','storage','security']}:customer;
    if(name==='catalog')data={products:[],version:'status',updated:'01/11/2026'};if(name==='catalog/version')data={version:'status'};if(name==='me/state')data={data:{},versions:{}};if(name==='me/carts')data={carts:[]};if(name==='orders/receipt-state')data={enabled:false,blocked:false,pendingCount:0};if(name==='orders/notifications')data={events:[]};if(name==='orders')data={orders:[order]};if(name==='orders/detail')data={order,events:[]};
    if(name==='admin/dashboard')data={counts:{in_progress:1}};if(name==='admin/orders')data={orders:[order]};if(name==='admin/orders/detail')data=order;if(name==='admin/orders/summary')data={version:1,unreadCount:0};if(name==='admin/catalog-options')data={pairs:[]};if(name==='admin/users')data={users:[]};if(name==='admin/price/versions')data={versions:[]};if(name==='admin/rules')data={rules:defaultRules(),defaults:defaultRules(),revision:'test'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   });return page;
  }
  const admin=await open('admin');await admin.goto(new URL('admin/?lang=ru#tab=dashboard',base).href);await admin.locator('[data-metric=in_progress]').waitFor();
  for(const [language,label]of [['ru','Оформлен'],['hy','Ձևակերպված է']]){await admin.evaluate(v=>ZZWS_I18N.setLanguage(v),language);assert.ok((await admin.locator('[data-metric=in_progress]').innerText()).includes(label));for(const selector of ['#orderStatusFilter','#managerStatusFilter','#editOrderStatus']){const select=admin.locator(selector);assert.equal(await select.locator('option[value=in_progress]').textContent(),label);}assert.equal(await admin.locator('[data-metric=in_progress]').getAttribute('data-metric'),'in_progress');}
  await admin.evaluate(()=>selectAdminTab('orders'));await admin.locator('#adminOrderList').getByText('Ձևակերպված է',{exact:true}).waitFor();
  const client=await open('client');await client.goto(base);await client.waitForFunction(()=>typeof catalogLoaded!=='undefined'&&catalogLoaded);await client.evaluate(()=>openPersonalCabinet());await client.locator('.server-order-card').first().waitFor();assert.ok((await client.locator('.server-order-card').first().innerText()).includes('Оформлен'));await client.evaluate(()=>ZZWS_I18N.setLanguage('hy'));assert.ok((await client.locator('.server-order-card').first().innerText()).includes('Ձևակերպված է'));assert.deepEqual(errors,[]);
  console.log('PASS: in_progress retains its canonical code while dashboard, admin filters/order list and customer history display Ձևակերպված է / Оформлен.');
 }finally{await browser?.close();await site?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
