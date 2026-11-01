const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],csp=[];let writes=0,discard=false;
 const customer={id:'11111111-1111-4111-8111-111111111111',login:'demo.customer',client:'Փորձնական երկար անվանումով առևտրային կազմակերպություն ՍՊԸ',active:true};
 const user={id:'admin-mobile',role:'admin',adminScope:'owner',client:'Demo admin',login:'admin',permissions:['orders:read','orders:write','price:read']};
 const longName='Փորձնական շատ երկար անվանումով սարքավորում՝ ճշգրիտ մոդել ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890123456789';
 const base={user_id:customer.id,customer,created:'2026-10-31T10:00:00Z',updated:'2026-10-31T10:10:00Z',revision:2,delivery:{organization:customer.client,contact:'Փորձնական կոնտակտ +374 00 000000',address:'Հայաստան, Երևան, Փորձնական թաղամաս, երկար փողոցի անվանում, շենք 123, տարածք 456',method:'Առաքում',date:'2026-11-03'},lines:[{articul:'001',name:longName,qty:3,unitPrice:127000}],total:381000,comment:'',events:[]};
 const orders=Array.from({length:4},(_,i)=>({...base,id:String(i+1).padStart(8,'0')+'-1111-4111-8111-111111111111',number:100+i,status:i===1?'received':'new',...(i===1?{received_at:'2026-10-31T11:00:00Z',receipt:{statement:'Հաստատում եմ, որ պատվերի ապրանքներն ամբողջությամբ և առանց վնասվածքների ստացել եմ։'}}:{}),original_lines:structuredClone(base.lines)}));
 const dir=path.resolve(__dirname,'../../work/admin-mobile-layout');fs.mkdirSync(dir,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:980,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/Content Security Policy|Refused to/.test(m.text()))csp.push(m.text());});page.on('dialog',d=>discard?d.accept():d.dismiss());
  await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/zzws-api/')[1];let data={};
   if(req.method()==='POST'&&['admin/orders/update','admin/orders/apply','admin/orders/reopen','admin/orders/delete','admin/orders/create','admin/templates/save','admin/templates/delete'].includes(name))writes++;
   if(name==='me')data=user;if(name==='admin/catalog-options')data={pairs:[]};if(name==='admin/price/versions')data={versions:[]};if(name==='admin/dashboard')data={counts:{new:3,received:1}};
   if(name==='admin/orders')data={orders};if(name==='admin/orders/detail')data=orders.find(o=>o.id===req.postDataJSON().id);
   if(name.includes('receipt-notifications'))data={events:[],unreadCount:0};if(name.includes('reopens'))data={events:[]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const url=new URL('admin/#tab=manager',process.env.ZZWS_TEST_URL||'http://127.0.0.1:8080/').href;
  await page.route('**/admin/mobile-orders.css*',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('[data-manager-order]').first().waitFor();await page.locator('[data-manager-order="'+orders[1].id+'"]').click();await page.locator('#selectedOrderReceipt').waitFor({state:'visible'});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(dir,'before-980.png'),fullPage:true});
  await page.unroute('**/admin/mobile-orders.css*');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ZZWS_ADMIN_VIEW_STATE?.ready);await page.locator('#selectedOrderReceipt').waitFor({state:'visible'});assert.equal(await page.locator('.manager-layout>aside').isVisible(),false,'reload retains the focused order');await page.locator('#managerMobileBack').click();await page.locator('[data-manager-order]').first().waitFor();
  for(const width of [320,390,660,768,980]){
   await page.setViewportSize({width,height:950});await page.locator('[data-manager-order="'+orders[1].id+'"]').click();await page.locator('#selectedOrderReceipt').waitFor({state:'visible'});
   assert.equal(await page.locator('.manager-layout>aside').isVisible(),false,'queue hidden in focused order at '+width);assert.equal(await page.locator('#managerMobileBack').isVisible(),true,'back at '+width);
   const layout=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...document.querySelectorAll('#adminOrderEditor>.admin-order-editor-heading>button')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})}));
   if(layout.page>width+1)console.log('Overflow candidates',await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement)if(['auto','hidden','clip','scroll'].includes(getComputedStyle(p).overflowX))return false;return true;}).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1&&e.width>0).slice(0,18)));
   if(layout.page>width+1)console.log('Button styles',await page.locator('.admin-order-editor-heading>button').evaluateAll(items=>items.filter(e=>!e.hidden).map(e=>{const s=getComputedStyle(e);return {html:e.outerHTML,wrap:s.overflowWrap,break:s.wordBreak,whiteSpace:s.whiteSpace,font:s.font,display:s.display};})));
   assert.ok(layout.page<=width+1,'page width '+width+': '+JSON.stringify(layout));for(const b of layout.buttons)assert.ok(b.left>=0&&b.right<=width+1,'action within viewport '+width);
   assert.equal(await page.locator('#manualOrderSave').isVisible(),false);assert.equal(await page.locator('#manualOrderLines input').first().isDisabled(),true);
   assert.equal(await page.locator('.order-workflow-help').isVisible(),false,'closed order must not instruct editing/sending');
   if(width===390){await page.evaluate(()=>{document.getElementById('managerMobileBack').scrollIntoView({block:'start'});document.activeElement?.blur();});await page.screenshot({path:path.join(dir,'order-mobile.png')});await page.locator('.admin-order-editor-heading').screenshot({path:path.join(dir,'order-actions-mobile.png')});}
   await page.locator('#managerMobileBack').click();await page.locator('.manager-layout>aside').waitFor({state:'visible'});assert.equal(await page.locator('[data-manager-order]').count(),4);assert.equal(await page.locator('#adminOrderEditor').isVisible(),false);
   if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(dir,'list-mobile.png')});}
  }
  // Returning to the list uses the existing unsaved-edit confirmation.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-manager-order="'+orders[0].id+'"]').click();await page.locator('#manualOrderLines input').first().fill('4');await page.locator('#manualOrderLines input').first().dispatchEvent('change');await page.locator('#managerMobileBack').click();assert.equal(await page.locator('#adminOrderEditor').isVisible(),true);assert.equal(await page.locator('#manualOrderLines input').first().inputValue(),'4');discard=true;await page.locator('#managerMobileBack').click();await page.locator('.manager-layout>aside').waitFor({state:'visible'});
  await page.setViewportSize({width:1600,height:1100});await page.locator('[data-manager-order="'+orders[1].id+'"]').click();await page.locator('#selectedOrderReceipt').waitFor({state:'visible'});assert.equal(await page.locator('.manager-layout>aside').isVisible(),true);assert.equal(await page.locator('#managerMobileBack').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(dir,'order-desktop.png'),fullPage:true});
  assert.equal(writes,0);assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);console.log('PASS: populated received/editable orders at 320/390/660/768/980/1600px; focused mobile order, full-width actions, long text, local table scrolling, list return with unsaved-edit guard, desktop split view, no order mutations.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
