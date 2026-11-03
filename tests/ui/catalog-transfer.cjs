const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/levon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?{url:process.env.ZZWS_TEST_URL,close:async()=>{}}:await require('../support/serve-site.cjs')();
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture=new URL('animation-fixture',site.url).href;
  await page.route(fixture,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html data-session-pending><head><link rel="stylesheet" href="js/loading-scenes.css?v=20261103-matched-targets-1"></head><body style="margin:0"><div id="sessionLoader" class="session-loader"><div class="session-loader-card" style="margin:auto"><div id="sessionSpinner"></div><p id="sessionLoadingText"></p></div></div><script>window.ZZWS_I18N={t:v=>v};</script><script src="js/loading-scenes.js?v=20261103-matched-targets-1"></script></body></html>`}));
  await page.goto(fixture);await page.waitForFunction(()=>!!window.ZZWS_LOADING_SCENES);
  fs.mkdirSync('output/loading-scenes',{recursive:true});
  for(const width of [320,390,1280])for(const dark of [false,true]){
   await page.setViewportSize({width,height:900});await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
   for(const type of ['fridge','washer','tv']){
    const sample=await page.evaluate(type=>{
     const moving=document.querySelector('.transfer-'+type),target=document.querySelector('.target-'+type),a=moving.getAnimations()[0];a.pause();
     const timing=a.effect.getTiming(),read=phase=>{a.currentTime=timing.delay+timing.duration*phase;const m=moving.getCTM(),t=target.getCTM();return{dx:m.e-t.e,dy:m.f-t.f,sx:m.a-t.a,sy:m.d-t.d,opacity:Number(getComputedStyle(moving).opacity)};};
     return{arrival:read(.72),fade:read(.85),iterations:timing.iterations};
    },type);
    for(const point of [sample.arrival,sample.fade])for(const field of ['dx','dy','sx','sy'])assert(Math.abs(point[field])<.01,`${type} ${field} must align with its own target at ${width}px`);
    assert.equal(sample.arrival.opacity,1);assert.equal(sample.iterations,Infinity);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`output/loading-scenes/matched-targets-${width}-${dark?'dark':'light'}.png`});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.catalog-transfer:visible').count(),0);assert.equal(await page.locator('.catalog-target:visible').count(),3);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.documentElement.removeAttribute('data-session-pending'));assert.equal(await page.locator('#sessionSpinner').evaluate(e=>e.getAnimations({subtree:true}).length),0);
  assert.deepEqual(errors,[]);console.log('Each appliance aligns with its own catalogue target without shrinking; 320/390/1280px, light/dark, reduced motion and loading-state stop passed');
 }finally{await browser.close();await site.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
