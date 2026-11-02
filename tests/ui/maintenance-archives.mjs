import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import {createRuntime,DEMO_PASSWORD} from '../support/runtime.mjs';
async function fixture(origin){
 const r=await createRuntime({memory:true,origin});
 const call=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result.data));return result.data;};
 const owner=(await ok('login',null,{login:'zzws-test-owner',password:DEMO_PASSWORD})).sessionToken;
 const dealer=(await ok('login',null,{login:'zzws-test-dealer',password:DEMO_PASSWORD})).sessionToken;
 const me=await ok('me',dealer);await r.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id)',[JSON.stringify([{articul:'990001',name:'Archive recovery fixture',brand:'LG',category:'TV',retail:150000,base:170000,ws:100000,kp:90000,stocks:{'003':8}}])]);
 const product=(await ok('catalog',dealer)).products[0];const originalOrder=await ok('orders',dealer,{requestId:randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Ինքնաառաքում',comment:'Original archive state'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
 const unlock=(await ok('admin/system-data/unlock',owner,{password:DEMO_PASSWORD})).unlockToken;
 const preview=await ok('admin/system-data/preview',owner,{unlockToken:unlock,categories:['orders']});
 let job=(await ok('admin/system-data/start',owner,{password:DEMO_PASSWORD,unlockToken:unlock,previewId:preview.previewId,fingerprint:preview.fingerprint,requestId:randomUUID(),acknowledge:true})).job;
 for(let i=0;i<3;i++)job=(await ok('admin/system-data/jobs/'+job.id+'/step',owner,{})).job;
 assert.equal(job.state,'awaiting_confirmation');
 const archive=(await ok('admin/system-data/archives',owner)).archives.find(a=>a.id===job.archiveId);assert.ok(archive);
 const downloaded=await call('admin/system-data/archives/'+archive.id+'/download',owner);assert.equal(downloaded.status,200);
 await ok('admin/system-data/jobs/'+job.id+'/cancel',owner,{});
 const remove=(step,confirmationToken,password=DEMO_PASSWORD,token=owner)=>call('admin/system-data/archives/'+archive.id+'/delete',token,{password,unlockToken:unlock,confirmationToken,step});
 return {r,owner,unlock,archive,file:downloaded.data,call,ok,remove,originalOrder};
}

import {createRequire} from 'node:module';import fs from 'node:fs';const require=createRequire(import.meta.url),{chromium}=require('C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.ZZWS_TEST_URL?{url:process.env.ZZWS_TEST_URL,close:async()=>{}}:await require('../../tests/support/serve-site.cjs')(),f=await fixture(new URL(site.url).origin),browser=await chromium.launch({channel:'msedge',headless:true});const errors=[],deleteSteps=[];fs.mkdirSync('work/archive-transfer/screens',{recursive:true});
try{
 for(const lang of ['ru','hy']){
  const context=await browser.newContext({viewport:{width:lang==='ru'?1280:390,height:940}});await context.addInitScript(({token,lang})=>{sessionStorage.setItem('zzws_session_v3',token);localStorage.setItem('zzws_language_v1',lang);},{token:f.owner,lang});
  await context.route('**/js/api-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.ZZWS_CONFIG={api:location.origin+"/functions/v1/zzws-api/",publishableKey:"offline-public"};'}));
  await context.route('**/functions/v1/zzws-api/**',async route=>{const q=route.request(),req=new Request(q.url(),{method:q.method(),headers:q.headers(),...(!['GET','HEAD'].includes(q.method())?{body:q.postDataBuffer()}:{})}),response=await f.r.handle(req);if(q.url().endsWith('/delete'))deleteSteps.push({step:q.postDataJSON().step,status:response.status});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(site.url+'admin/#tab=systemDataReset');await page.locator('#cleanupUnlock').click();
  async function password(value=DEMO_PASSWORD){const dialog=page.locator('dialog.cleanup-password-dialog');await dialog.locator('input[type=password]').fill(value);await dialog.locator('button[type=submit]').click();}
  await password();await page.locator('#cleanupArchiveFile').waitFor();await page.locator('[data-cleanup-category=orders]').check();await page.waitForFunction(()=>document.querySelector('[data-category-id=orders]')?.textContent.includes('('));await page.locator('[data-cleanup-bytes=current]').first().waitFor();await page.screenshot({path:'work/archive-transfer/screens/'+lang+'-category-size.png'});await page.locator('[data-cleanup-category=orders]').uncheck();
  const archive=(await f.ok('admin/system-data/archives',f.owner)).archives[0];const remove=page.locator('[data-archive-delete="'+archive.id+'"]');await remove.click();await password();
  const second=page.locator('dialog.cleanup-password-dialog');await second.locator('h2').filter({hasText:'2'}).waitFor();await second.getByRole('button',{name:lang==='ru'?'Отмена':'Չեղարկել',exact:true}).click();assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);
  await remove.click();await password();await page.locator('dialog.cleanup-password-dialog h2').filter({hasText:'2'}).waitFor();await password();await page.locator('dialog.cleanup-password-dialog h2').filter({hasText:'3'}).waitFor();
  await page.screenshot({path:'work/archive-transfer/screens/'+lang+'-password-3.png'});await password('88888888');await page.locator('dialog.cleanup-password-dialog [role=alert]').filter({hasText:/.+/}).waitFor();assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);assert.equal(await page.locator('dialog.cleanup-password-dialog input[type=password]').inputValue(),'');
  await password();await remove.waitFor({state:'detached'});assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,0);
  await page.locator('#cleanupArchiveFile').setInputFiles({name:'saved-backup.zzwsarchive.json',mimeType:'application/json',buffer:Buffer.from(f.file)});await page.locator('#cleanupArchiveImport').click();
  await page.locator('dialog.cleanup-dialog:not(.cleanup-password-dialog)').waitFor();assert.equal((await f.ok('admin/system-data/archives',f.owner)).archives.length,1);await page.screenshot({path:'work/archive-transfer/screens/'+lang+'-restore-file-preview.png'});
  await page.locator('dialog.cleanup-dialog').getByRole('button',{name:lang==='ru'?'Отмена':'Չեղարկել',exact:true}).click();await page.locator('dialog.cleanup-dialog').waitFor({state:'detached'});
  await page.locator('#cleanupArchiveFile').setInputFiles({name:'damaged.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.locator('#cleanupArchiveImport').click();await page.waitForFunction(()=>document.getElementById('cleanupMessage')?.textContent.includes('повреждён')||document.getElementById('cleanupMessage')?.textContent.includes('վնասված'));
  await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: both languages, three separate passwords, wrong-password retry, cancellation, deleted file reimport, restore preview, malformed file and 320px layout');
 fs.writeFileSync('work/archive-transfer/ui-proof.json',JSON.stringify({errors,deleteSteps},null,2));
}finally{await browser.close();await f.r.close();await site.close();}
