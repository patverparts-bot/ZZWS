const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.ZZWS_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../..');
const publicRoot = process.env.ZZWS_UI_ROOT ? path.resolve(process.env.ZZWS_UI_ROOT) : root;

(async () => {
  const {answerQuestion} = await import('../../supabase/functions/zzws-api/assistant.mjs');
  const knowledge = JSON.parse(fs.readFileSync(path.join(root,'supabase/functions/zzws-api/assistant-knowledge.json'),'utf8'));
  const rows = Object.entries(knowledge.products).filter(([, row]) => row[0].startsWith('Panasonic')).slice(0, 3);
  assert.equal(rows.length, 3);
  const products = rows.map(([articul, row]) => ({articul, name:row[0], brand:'Panasonic', category:'TV', retail:100000, wholesale:90000, marginVal:10, stockStatus:'Առկա է', hasWholesale:true}));
  const washerRows=Object.entries(knowledge.products).filter(([,row])=>row[3].some(([name])=>name==='Load Capacity (kg)')&&row[3].some(([name,value])=>name==='Dimensions(HxWxD)'&&/85.*60.*45.*cm/.test(value))).slice(0,3);
  assert.equal(washerRows.length,3);
  // Synthetic nearby width tests group ordering; no production knowledge is changed.
  const nearbySku=washerRows[2][0];knowledge.products[nearbySku]=JSON.parse(JSON.stringify(knowledge.products[nearbySku]));
  knowledge.products[nearbySku][3]=knowledge.products[nearbySku][3].map(([name,value])=>[name,name==='Dimensions(HxWxD)'?'85 x 61 x 45 cm':value]);
  products.push(...washerRows.map(([articul,row],i)=>({articul,name:row[0],brand:row[0].split(' ')[0],category:'Լվացքի մեքենաներ',retail:300000,wholesale:[150000,190000,180000][i],marginVal:10,stockStatus:'Առկա է',hasWholesale:true})));
  const managerSkus=['9ui-retail-1','9ui-retail-2'];
  for(const [i,articul] of managerSkus.entries()){
    const name='Samsung REF'+(i+1),row=JSON.parse(JSON.stringify(knowledge.products[washerRows[0][0]]));
    row[0]=name;row[3]=row[3].map(([key,value])=>[key,key==='Dimensions(HxWxD)'?'85 x '+(i?59.8:60)+' x 45 cm':value]);knowledge.products[articul]=row;
    products.push({articul,name,brand:'Samsung',category:'Լվացքի մեքենաներ',retail:50000+i*10000,wholesale:0,hasWholesale:false,stockStatus:'Ճշտել'});
  }
  const publicCatalog={products:{'9ui-public-1':'washer','9ui-public-2':'washer'}};
  for(const [i,noise] of [42,35,38,39,40].entries()){
    const articul='9ui-fridge-'+i,name='Bosch FRIDGE'+i;
    knowledge.products[articul]=[name,'https://www.zigzag.am/en/'+articul+'.html','2026-11-01T00:00:00Z',[['Noise level (dB)',String(noise)],['Total volume(l)',String(300+i*50)],['Refrigerator','NoFrost'],['Freezer','NoFrost']]];
    products.push({articul,name,brand:'Bosch',category:'Սառնարաններ',retail:400000,wholesale:150000+i*20000,stockAvailable:true,stockStatus:'Առկա է',hasWholesale:true});
  }
  for(const [i,articul] of Object.keys(publicCatalog.products).entries()){
    const row=JSON.parse(JSON.stringify(knowledge.products[washerRows[0][0]]));
    row[0]='Samsung OUTSIDE'+(i+1);row[3]=row[3].map(([key,value])=>[key,key==='Dimensions(HxWxD)'?'85 x '+(i?61:60)+' x 45 cm':value]);knowledge.products[articul]=row;
  }
  // Serve only public files used by the application; no repository/private data access.
  const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
  const server = http.createServer((req,res) => {
    const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
    let file = path.resolve(publicRoot,name);
    if (!file.startsWith(publicRoot + path.sep) || (!name.startsWith('js/') && !['index.html','styles.css','zigzag-avatar.svg','logo.svg','logo-dark.svg','favicon.svg','favicon-32.png','apple-touch-icon.png','bg-warehouse-login.webp'].includes(name))) {res.writeHead(404).end();return;}
    if(!fs.existsSync(file)&&['logo.svg','logo-dark.svg','favicon.svg','favicon-32.png','apple-touch-icon.png','bg-warehouse-login.webp'].includes(name))file=path.join(root,name);
    fs.readFile(file,(error,data) => {if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(name)] || 'application/octet-stream'}).end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const errors=[],violations=[],user={id:'assistant-ui',login:'demo',client:'Demo',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[]};
  let requests=0, failNext=false, delayNext=false, orderSubmissions=0,enablePublicOffers=false,holdNext=false,releaseHeld,heldReady;const missingPhotos=new Set();
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(/violates.*directive|Refused to|Content Security Policy/.test(message.text()))violations.push(message.text());});
    await page.addInitScript(()=>sessionStorage.setItem('zzws_session_v3','a'.repeat(64)));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(window.__clipboardFail)throw Error('test failure');window.__managerInquiry=value;}}}));
    await page.route('https://www.zigzag.am/**',async route=>{
      if([...missingPhotos].some(code=>route.request().url().includes(code))){await route.fulfill({status:404,body:''});return;}
      await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><rect x="61" y="27" width="118" height="185" rx="10" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3"/><circle cx="120" cy="131" r="43" fill="#dbeafe" stroke="#64748b" stroke-width="6"/><circle cx="120" cy="131" r="29" fill="#93c5fd"/><path d="M68 75h104" stroke="#94a3b8" stroke-width="3"/><rect x="75" y="43" width="43" height="15" rx="3" fill="#cbd5e1"/><circle cx="154" cy="51" r="9" fill="#94a3b8"/></svg>'});
    });
    await page.route('**/functions/v1/zzws-api/**',async route=>{
      const req=route.request(),name=new URL(req.url()).pathname.split('/zzws-api/')[1];let data={};
      if(name==='orders'&&req.method()==='POST')orderSubmissions++;
      if(name==='me')data=user;
      if(name==='me/state')data=req.method()==='POST'?{version:1}:{data:{},versions:{}};
      if(name==='catalog')data={products,version:'assistant-ui',updated:'30/10/2026'};
      if(name==='catalog/version')data={version:'assistant-ui'};
      if(name==='orders/notifications')data={events:[]};
      if(name==='orders/receipt-state')data={enabled:false,blocked:false,outstanding:[],pendingCount:0};
      if(name==='assistant/chat') {
        requests++;
        if(holdNext){holdNext=false;await new Promise(resolve=>{releaseHeld=resolve;heldReady?.();});}
        if(failNext){failNext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'unavailable'})});return;}
        if(delayNext){delayNext=false;await new Promise(resolve=>setTimeout(resolve,250));}
        data=await answerQuestion(req.postDataJSON(),products,knowledge,{fetcher:async()=>new Response('Challenge',{status:403}),orderPriceMode:user.role==='admin'&&req.postDataJSON().orderPriceMode==='KP'?'KP':'WS',...(enablePublicOffers?{publicCatalog}:{})});
        // Deliberately put reference offers first in the transport, so the UI
        // must independently use the actual shared-cart price checks.
        if(data.recommendations)data.recommendations.sort((a,b)=>(b.orderability.status==='manager')-(a.orderability.status==='manager'));
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(n=>catalogLoaded && allProducts.length===n,products.length);
    await page.locator('#mainApp').waitFor({state:'visible'});
    await page.locator('#zigzagLauncher').click();
    assert.equal(await page.locator('.zigzag-toolbar select').count(),0);
    assert.equal(await page.locator('#zigzagAssistant').getAttribute('lang'),'hy');
    assert.equal(await page.locator('.zigzag-send').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(37, 99, 235)');
    assert.ok(await page.locator('.zigzag-welcome').innerText().then(s=>s.includes('Բարև')));
    assert.equal(await page.locator('.zigzag-welcome h3').innerText(),'Բարև, ես ԶիգԶագ AI եմ։');
    fs.mkdirSync(path.join(root,'work'),{recursive:true});
    await page.screenshot({path:path.join(root,'work/zigzag-welcome-desktop.png')});
    await page.locator('.zigzag-close').click();
    await page.locator('#zigzagLauncher').click();await page.locator('#zigzagInput').fill('Характеристики '+products[0].articul);await page.locator('.zigzag-send').click();
    await page.waitForFunction(()=>document.querySelectorAll('.zigzag-product').length===1);
    await page.locator('.zigzag-pending').waitFor({state:'detached'});
    assert.equal(await page.locator('.zigzag-source a').getAttribute('href'),rows[0][1][1]);
    assert.ok(await page.locator('.zigzag-source').innerText().then(s=>s.includes('Պահպանված տվյալներ')));
    assert.equal(await page.locator('.zigzag-mode').innerText(),'Բնութագրերի որոնում');
    const submit=async text=>{const prior=await page.locator('.zigzag-message:not(.zigzag-message-user)').count();await page.locator('#zigzagInput').fill(text);await page.locator('.zigzag-send').click();await page.waitForFunction(n=>document.querySelectorAll('.zigzag-message:not(.zigzag-message-user)').length>n,prior);await page.locator('.zigzag-pending').waitFor({state:'detached'});};
    await submit('А какой вес?');
    assert.equal(await page.locator('.zigzag-product').count(),2);
    await submit('Сравни '+products[0].articul+' и '+products[1].articul);
    assert.equal(await page.locator('.zigzag-message:not(.zigzag-message-user)').last().locator('.zigzag-product').count(),2);
    await page.screenshot({path:path.join(root,'work/zigzag-comparison-desktop.png')});
    await page.locator('.zigzag-refresh').last().click();
    await page.waitForFunction(()=>document.querySelector('.zigzag-message:last-child')?.textContent.includes('Կայքն այժմ հասանելի չէ'));
    await page.locator('.zigzag-pending').waitFor({state:'detached'});
    await submit('<img src=x onerror="window.assistantXSS=true">');
    assert.equal(await page.evaluate(()=>window.assistantXSS),undefined);
    assert.equal(await page.locator('.zigzag-message img[src="x"]').count(),0);
    await page.locator('.zigzag-toolbar button').click();
    await submit('Panasonic');
    assert.equal(await page.locator('.zigzag-choices>.zigzag-product').count(),3);assert.equal(await page.locator('.zigzag-choices .zigzag-product-photo img').count(),3);assert.ok(await page.locator('.zigzag-choices .zigzag-highlights span').count()>0);
    await page.locator('.zigzag-choices>.zigzag-product').nth(0).locator('.zigzag-choice[aria-pressed]').click();
    await page.locator('.zigzag-choices>.zigzag-product').nth(1).locator('.zigzag-choice[aria-pressed]').click();
    await page.locator('.zigzag-context button').last().click();
    await page.waitForFunction(()=>document.querySelector('.zigzag-message:last-child')?.querySelectorAll('.zigzag-product').length===2);
    await page.locator('.zigzag-pending').waitFor({state:'detached'});
    for(const dark of [false,true])for(const width of [390,768,1440]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(value=>document.documentElement.classList.toggle('dark',value),dark);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      assert.equal(await page.locator('.zigzag-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      const box=await page.locator('.zigzag-input-row').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y+box.height<=844);
      if(width===390)await page.screenshot({path:path.join(root,'work/zigzag-mobile-'+(dark?'dark':'light')+'.png')});
    }
    await page.locator('.zigzag-toolbar button').click();
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
    await submit('Мне нужна стиральная машина недорогая, 60 сантиметров');
    const lastReply=()=>page.locator('.zigzag-message:not(.zigzag-message-user)').last();
    assert.ok((await lastReply().innerText()).includes('լայնությո՞ւնն'));
    assert.equal(await page.locator('.zigzag-product').count(),0);
    const quick=async text=>{const prior=await page.locator('.zigzag-message:not(.zigzag-message-user)').count();await lastReply().locator('.zigzag-quick-replies button').getByText(text,{exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.zigzag-message:not(.zigzag-message-user)').length>n,prior);await page.locator('.zigzag-pending').waitFor({state:'detached'});};
    await quick('Լայնություն');assert.ok((await lastReply().innerText()).includes('բյուջե'));
    await submit('До 200 тысяч');assert.equal(await lastReply().locator('.zigzag-recommendations .zigzag-product').count(),5);
    assert.equal(await lastReply().locator('.zigzag-group-orderable .zigzag-group-exact .zigzag-product').count(),2);assert.equal(await lastReply().locator('.zigzag-group-orderable .zigzag-group-near .zigzag-product').count(),1);
    assert.ok((await lastReply().locator('.zigzag-group-orderable .zigzag-match-near').innerText()).includes('+1 սմ'));
    assert.equal(await lastReply().locator('.zigzag-availability-group').first().getAttribute('class'),'zigzag-availability-group zigzag-group-orderable');
    const managerGroup=lastReply().locator('.zigzag-group-manager');assert.equal(await managerGroup.locator('.zigzag-product').count(),2);
    assert.ok((await managerGroup.innerText()).includes('Գինը և պատվերի պայմանները կարող եք ճշտել մենեջերի հետ։'));
    assert.equal(await managerGroup.locator('.zigzag-cart-actions:visible').count(),0);
    assert.equal(await managerGroup.locator('.zigzag-add-to-cart:enabled').count(),0);
    assert.ok((await managerGroup.locator('.zigzag-offer-price small').first().innerText()).includes('որպես տեղեկություն'));
    const firstPrice=await lastReply().locator('.zigzag-offer-price').first().boundingBox(),logBox=await page.locator('.zigzag-messages').boundingBox();assert.ok(firstPrice.y>=logBox.y&&firstPrice.y+firstPrice.height<=logBox.y+logBox.height,'first orderable offer price is visible immediately');
    const managerCard=managerGroup.locator('.zigzag-product').first(),managerSku=await managerCard.getAttribute('data-articul');
    const mail=new URL(await managerCard.locator('.zigzag-contact-manager').getAttribute('href'));
    assert.equal(mail.protocol,'mailto:');assert.equal(mail.pathname,'levon.grigoryan@zigzag.am');
    assert.ok(mail.searchParams.get('body').includes('Արտիկուլ՝ '+managerSku));assert.ok(mail.searchParams.get('body').includes('Մոդել՝ '+products.find(p=>p.articul===managerSku).name));
    await managerCard.locator('.zigzag-copy-inquiry').click();assert.equal(await page.evaluate(()=>window.__managerInquiry),mail.searchParams.get('body'));
    assert.ok((await managerCard.locator('.zigzag-inquiry-status').innerText()).includes('պատճենված'));
    const managerRequests=requests;await managerGroup.locator('.zigzag-offer-details').first().click();
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-cart-actions').isVisible(),false);
    assert.ok((await page.locator('#zigzagProductDetails .zigzag-cart-status').innerText()).includes('մենեջերի հետ'));
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-contact-manager').getAttribute('href'),mail.href);
    assert.equal(requests,managerRequests);await page.locator('.zigzag-details-close').click();
    assert.ok((await lastReply().innerText()).includes('150'));assert.equal(await page.locator('.zigzag-mode').innerText(),'Տեխնիկայի ընտրություն');
    assert.ok((await page.locator('.zigzag-context').textContent()).includes('60 սմ'));
    assert.equal(await lastReply().locator('.zigzag-specs').count(),0,'compact cards have no nested specification scrollers');
    assert.equal(/[а-яё]/i.test(await lastReply().innerText()),false);
    const offer=lastReply().locator('.zigzag-product').first(),sku=await offer.getAttribute('data-articul'),quantity=offer.locator('.zigzag-cart-quantity input');
    assert.equal(await offer.locator('.zigzag-product-photo img').getAttribute('alt'),washerRows[0][1][0]);
    await offer.locator('.zigzag-product-photo img').evaluate(async img=>{if(!img.complete)await new Promise(resolve=>img.addEventListener('load',resolve,{once:true}));});
    assert.ok(await offer.locator('.zigzag-product-photo img').evaluate(img=>img.naturalWidth>=160));
    await quantity.fill('2');await offer.locator('.zigzag-add-to-cart').click();
    assert.equal(await page.evaluate(id=>cart[id]?.qty,sku),2);assert.ok((await offer.locator('.zigzag-cart-status').innerText()).includes('2 հատ'));
    await offer.locator('.zigzag-add-to-cart').click();assert.equal(await page.evaluate(id=>cart[id]?.qty,sku),4);
    const cartItem=await page.evaluate(id=>cart[id],sku);assert.equal(cartItem.addedPrice,products.find(p=>p.articul===sku).wholesale);assert.equal(cartItem.addedPriceMode,'WS');
    await quantity.fill('0');await offer.locator('.zigzag-add-to-cart').click();assert.equal(await page.evaluate(id=>cart[id]?.qty,sku),4);
    await quantity.fill('1');await page.evaluate(id=>productIndex.delete(id),sku);await offer.locator('.zigzag-add-to-cart').click();
    assert.equal(await offer.locator('.zigzag-add-to-cart').isDisabled(),true);assert.equal(await page.evaluate(id=>cart[id]?.qty,sku),4);
    await page.evaluate(id=>productIndex.set(id,allProducts.find(p=>p.articul===id)),sku);
    await page.locator('.zigzag-close').click();await page.locator('#zigzagLauncher').click();assert.equal(await offer.locator('.zigzag-add-to-cart').isEnabled(),true);
    missingPhotos.add(sku);await offer.locator('.zigzag-product-photo img').evaluate((img,id)=>{img.src='https://www.zigzag.am/'+id+'.jpg?missing-test';},sku);
    await page.waitForFunction(id=>document.querySelector('.zigzag-recommendations .zigzag-product[data-articul="'+id+'"] .zigzag-product-photo')?.textContent.includes('Նկար չկա'),sku);
    assert.equal(await offer.locator('.zigzag-add-to-cart').isEnabled(),true);assert.equal(orderSubmissions,0);
    const requestsBeforeDetails=requests;
    await offer.locator('.zigzag-offer-details').click();await page.locator('#zigzagProductDetails').waitFor({state:'visible'});
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-spec-row dt').first().innerText(),'Արտադրող');
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-specs').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
    await page.locator('#zigzagProductDetails .zigzag-cart-quantity input').fill('3');await page.locator('#zigzagProductDetails .zigzag-add-to-cart').click();assert.equal(await page.evaluate(id=>cart[id].qty,sku),7);
    for(const width of [360,390,768,1440]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.locator('#zigzagProductDetails').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      assert.equal(await page.locator('.zigzag-details-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
      assert.ok(await page.locator('#zigzagProductDetails .zigzag-spec-row').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=14));
      if(width===390)await page.screenshot({path:path.join(root,'work/zigzag-product-details-mobile.png')});
    }
    await page.screenshot({path:path.join(root,'work/zigzag-product-details-desktop.png')});
    await page.locator('.zigzag-details-close').click();assert.equal(requests,requestsBeforeDetails,'opening details preserves the conversation without another API call');
    assert.ok((await offer.locator('.zigzag-cart-status').innerText()).includes('7 հատ'));
    await page.setViewportSize({width:1440,height:1000});
    missingPhotos.delete(sku);
    // Rebuild the offers with working images for responsive layout checks and previews.
    await submit('Նույն տարբերակները');
    const photoOffer=lastReply().locator('.zigzag-product').first();await photoOffer.locator('.zigzag-product-photo img').waitFor();
    await page.screenshot({path:path.join(root,'work/zigzag-advisor-offers-desktop.png')});
    await submit('Бюджет до 1000 драм');assert.equal(await lastReply().locator('.zigzag-product').count(),0);assert.ok((await lastReply().innerText()).includes('հստակեցնենք'));
    await quick('Փոխել բյուջեն');await submit('200000');assert.equal(await lastReply().locator('.zigzag-product').count(),5);assert.ok((await page.locator('.zigzag-context').textContent()).includes('60 սմ'));
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.zigzag-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.screenshot({path:path.join(root,'work/zigzag-advisor-offers-mobile.png')});
    await lastReply().locator('.zigzag-offer-details').first().click();await page.locator('#zigzagProductDetails').waitFor({state:'visible'});
    assert.equal(await page.locator('.zigzag-mode').innerText(),'Տեխնիկայի ընտրություն');
    assert.equal(await page.locator('.zigzag-context .zigzag-requirements').count(),1);await page.locator('.zigzag-details-close').click();
    await lastReply().locator('.zigzag-group-manager').scrollIntoViewIfNeeded();
    assert.equal(await lastReply().locator('.zigzag-group-manager').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.screenshot({path:path.join(root,'work/zigzag-manager-offers-mobile.png')});
    await submit('Бюджет до 60000 драм');
    assert.equal(await lastReply().locator('.zigzag-group-orderable').count(),0);
    assert.equal(await lastReply().locator('.zigzag-group-manager .zigzag-product').count(),2);
    assert.equal(await lastReply().locator('.zigzag-add-to-cart:visible').count(),0);
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:path.join(root,'work/zigzag-manager-offers-desktop.png')});
    enablePublicOffers=true;await submit('Բյուջե մինչև 200000 դրամ');
    const external=lastReply().locator('.zigzag-group-public');assert.equal(await external.locator('.zigzag-product').count(),2);
    assert.deepEqual(await lastReply().locator('.zigzag-availability-group').evaluateAll(nodes=>nodes.map(n=>n.classList.contains('zigzag-group-orderable')?'orderable':n.classList.contains('zigzag-group-manager')?'manager':'public')),['orderable','manager','public']);
    assert.ok((await external.locator('.zigzag-manager-note').innerText()).includes('պատվերի պայմանները'));
    assert.equal(await external.locator('.zigzag-offer-price').count(),0);assert.equal(await external.locator('.zigzag-budget-unconfirmed').count(),2);
    assert.equal(await external.locator('.zigzag-add-to-cart:visible').count(),0);assert.equal(await external.locator('.zigzag-product-photo img').count(),2);
    const externalCard=external.locator('.zigzag-product').first(),externalSku=await externalCard.getAttribute('data-articul');
    assert.equal(await page.evaluate(id=>!!getProduct(id),externalSku),false);
    const externalMail=new URL(await externalCard.locator('.zigzag-contact-manager').getAttribute('href'));
    assert.ok(externalMail.searchParams.get('body').includes('Մոդել՝ Samsung OUTSIDE1'));assert.ok(externalMail.searchParams.get('body').includes('Արտիկուլ՝ 9ui-public-1'));
    await externalCard.locator('.zigzag-copy-inquiry').click();assert.equal(await page.evaluate(()=>window.__managerInquiry),externalMail.searchParams.get('body'));
    await page.evaluate(()=>window.__clipboardFail=true);await externalCard.locator('.zigzag-copy-inquiry').click();assert.ok((await externalCard.locator('.zigzag-inquiry-status').innerText()).includes('Չհաջողվեց'));await page.evaluate(()=>window.__clipboardFail=false);
    const outsideRequests=requests;await externalCard.locator('.zigzag-offer-details').click();
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-contact-manager').getAttribute('href'),externalMail.href);
    assert.equal(await page.locator('#zigzagProductDetails .zigzag-cart-actions').isVisible(),false);assert.ok((await page.locator('#zigzagProductDetails .zigzag-cart-status').innerText()).includes('պատվերի պայմանները'));
    assert.equal(requests,outsideRequests);assert.equal(await page.evaluate(id=>cart[id],externalSku),undefined);
    for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('#zigzagProductDetails').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);}
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'work/zigzag-public-details-mobile.png')});await page.locator('.zigzag-details-close').click();
    await external.locator('.zigzag-availability-title').evaluate(el=>{const log=el.closest('.zigzag-messages');log.scrollTo({top:log.scrollTop+el.getBoundingClientRect().top-log.getBoundingClientRect().top-12,behavior:'instant'});});
    await page.screenshot({path:path.join(root,'work/zigzag-public-offers-mobile.png')});assert.equal(orderSubmissions,0);
    await page.setViewportSize({width:1440,height:1000});await external.locator('.zigzag-availability-title').evaluate(el=>{const log=el.closest('.zigzag-messages');log.scrollTo({top:log.scrollTop+el.getBoundingClientRect().top-log.getBoundingClientRect().top-12,behavior:'instant'});});await page.screenshot({path:path.join(root,'work/zigzag-public-offers-desktop.png')});
    enablePublicOffers=false;await page.locator('.zigzag-toolbar button').click();
    await submit('Самый лучший холодильник предложи');assert.equal(await lastReply().locator('.zigzag-product').count(),0);
    await quick('Ավելի լուռ');assert.equal(await lastReply().locator('.zigzag-product').first().getAttribute('data-articul'),'9ui-fridge-1');
    assert.ok((await lastReply().locator('.zigzag-reasons').first().innerText()).includes('35 dB'));
    assert.equal(await lastReply().locator('.zigzag-reasons').count(),3);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await lastReply().evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await lastReply().locator('.zigzag-reasons').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,'work/assistant-learning/quiet-fridges-mobile.png')});
    await quick('Ցույց տալ ավելին');assert.equal(await lastReply().locator('.zigzag-product').count(),2);
    await submit('Сравни эти модели');assert.equal(await lastReply().locator('.zigzag-product').count(),2);
    await page.locator('.zigzag-toolbar button').click();await submit('Непонятная абракадабра');assert.ok((await lastReply().innerText()).includes('սովորում եմ'));
    await submit('Холодильник ширина до 1 см');assert.equal(await lastReply().locator('.zigzag-product').count(),0);assert.ok((await lastReply().innerText()).includes('հստակեցնենք'));
    assert.equal(/չգտնվ|կատալոգում չկա|товар.*не найден/i.test(await lastReply().innerText()),false);
    const held=new Promise(resolve=>heldReady=resolve);holdNext=true;
    await page.locator('#zigzagInput').fill('Բարև');await page.locator('.zigzag-send').click();await held;
    assert.equal(await page.locator('.zigzag-pending[role="status"]').count(),1);assert.equal(await page.locator('.zigzag-typing-dots i').count(),3);
    await page.waitForFunction(()=>{const p=document.querySelector('.zigzag-pending')?.getBoundingClientRect(),m=document.querySelector('.zigzag-messages')?.getBoundingClientRect();return p&&m&&p.top>=m.top-1&&p.bottom<=m.bottom+1;},{},{timeout:3000}).catch(async error=>{console.log(await page.evaluate(()=>({pending:document.querySelector('.zigzag-pending')?.getBoundingClientRect().toJSON(),log:document.querySelector('.zigzag-messages')?.getBoundingClientRect().toJSON(),scroll:document.querySelector('.zigzag-messages')?.scrollTop,height:document.querySelector('.zigzag-messages')?.scrollHeight})));throw error;});
    assert.equal(await page.locator('.zigzag-chat-status').innerText(),'ԶիգԶագ AI-ն գրում է');assert.equal(await page.locator('.zigzag-send').isDisabled(),true);
    assert.equal(await page.locator('.zigzag-typing-dots i').first().evaluate(el=>getComputedStyle(el).animationName),'zigzag-typing');
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.zigzag-typing-dots i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.screenshot({path:path.join(root,'work/assistant-learning/typing-mobile.png')});releaseHeld();await page.locator('.zigzag-pending').waitFor({state:'detached'});
    await page.waitForFunction(()=>!document.querySelector('.zigzag-messages').hasAttribute('aria-busy'));
    assert.equal(await page.locator('.zigzag-chat-status').innerText(),'Սպասում եմ ձեր հարցին');assert.equal(await page.locator('.zigzag-send').isDisabled(),false);
    failNext=true;await submit('Больше подробностей');
    assert.equal(await page.locator('.zigzag-message-error').count(),1);
    await page.locator('.zigzag-message-error button').click();await page.locator('.zigzag-pending').waitFor({state:'detached'});
    delayNext=true;await page.locator('#zigzagInput').fill('А цвет?');await page.locator('.zigzag-send').click();
    await page.evaluate(()=>lockCatalog());
    assert.equal(await page.locator('#zigzagAssistant').isVisible(),false);
    assert.equal(await page.locator('.zigzag-message').count(),0);
    assert.equal(await page.locator('#zigzagLauncher').isVisible(),false);
    await page.waitForTimeout(350);assert.equal(await page.locator('.zigzag-message').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
    console.log(JSON.stringify({pass:true,requests,checks:'manager email draft and copied inquiry include exact SKU/model/source, clipboard failure fallback, separate public references without private prices or basket actions, public photos and cached details, unconfirmed budget explanation, orderable before retail reference offers, responsive dialogs and shared-cart safeguards, no order submission, follow-up, comparison, retry and logout cancellation',browserErrors:errors.length,cspViolations:violations.length}));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
