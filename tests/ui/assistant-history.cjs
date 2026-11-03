const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><head></head><body><button data-tab="assistantHistory"></button><section id="assistantHistory"></section></body></html>');
 await page.addStyleTag({path:path.resolve('admin/style.css')});await page.addStyleTag({path:path.resolve('admin/assistant-history.css')});
 const k=JSON.parse(fs.readFileSync('supabase/functions/zzws-api/assistant-knowledge.json','utf8')),sku='5303490',p=k.products[sku];
 const row={id:'00000000-0000-4000-8000-000000000001',created:'2026-11-03T10:00:00Z',actor:{name:'Owner',login:'owner'},conversation_id:'00000000-0000-4000-8000-000000000002',request:{message:'Ներկառուցվող սառնարան <script>bad()</script>'},response:{answer:'Встраиваемые холодильники по вашему запросу',recommendations:[{articul:sku,name:p[0],specifications:p[3].map(([name,value])=>({name,value})),price:{amount:200000}}]},review_status:'unreviewed',review_note:'',revision:0};
 await page.evaluate(row=>{window.ZZWS_I18N={language:'ru'};window.testRow=row;window.calls=[];window.ZZWS={message:e=>e.message,json:async(url,options)=>{window.calls.push({url,body:options?.body});if(options?.method==='POST'){const body=JSON.parse(options.body);Object.assign(window.testRow,{review_status:body.status,review_note:body.note,revision:body.revision+1});return window.testRow;}return {rows:[window.testRow],total:1,offset:0,limit:20};}};},row);
 // An opaque origin has no native sessionStorage; supply the mock through an own property.
 await page.evaluate(()=>Object.defineProperty(window,'sessionStorage',{value:{getItem:()=> 'owner-session'},configurable:true}));
 for(const file of ['js/product-photos.js','js/assistant-product-summary.js','admin/assistant-history.js'])await page.addScriptTag({path:path.resolve(file)});
 await page.evaluate(()=>ZZWS_ASSISTANT_HISTORY.load());
 await page.locator('.assistant-history-entry').waitFor();assert.equal(await page.locator('.assistant-history-photo img').count(),1);assert.ok(await page.locator('.assistant-history-product dl dt').count()>=4);
 assert.ok((await page.locator('.assistant-history-text').first().textContent()).includes('<script>'));assert.equal(await page.evaluate(()=>typeof window.bad),'undefined');
 await page.locator('.assistant-history-review select').selectOption('incorrect');await page.locator('.assistant-history-review textarea').fill('Показал обычный холодильник вместо встраиваемого');await page.locator('.assistant-history-review button').click();await page.getByText('Сохранено',{exact:true}).waitFor();
 assert.equal(await page.locator('.assistant-history-entry').getAttribute('data-review'),'incorrect');
 await page.getByText('Вчера',{exact:true}).click();await page.waitForFunction(()=>window.calls.some(c=>c.url.includes('from=')));assert.ok((await page.evaluate(()=>calls.at(-1).url)).includes('to='));
 await page.screenshot({path:'work/assistant-history/history-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'work/assistant-history/history-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.evaluate(()=>ZZWS_ASSISTANT_HISTORY.reset());assert.equal(await page.locator('.assistant-history-entry').count(),0);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,photos:true,specifications:true,reviewSaved:true,dateFilters:true,mobile:true,logoutClears:true,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
