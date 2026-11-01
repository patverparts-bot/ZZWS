const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {chromium}=require(process.env.ZZWS_PLAYWRIGHT||'playwright');
(async()=>{
 const site=process.env.ZZWS_TEST_URL?null:await require('../support/serve-site.cjs')();
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.ZZWS_ANDROID_CHROME?'chrome':'msedge',headless:true});
  const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');
  const id='11111111-1111-4111-8111-111111111111',proposalId=crypto.randomUUID(),deferRequestId=crypto.randomUUID();
  let due=false,answered=false,prepareCount=0,savedPayload=null;
  const phones=['+37491123456','+37493123456','+37494123456','+37495123456','+37496123456'];
  const owner={id:'admin',role:'admin',login:'owner',client:'Owner',active:true,adminScope:'owner',profileRevision:1,permissions:['orders:read','orders:write','price:read','price:write','users','rules','storage','audit','security']};
  const names=['Арам','Анна','Гор','Лилит','Карен'];
  let buyer={id:'buyer',login:'buyer',client:'Тестовый клиент с длинным названием организации',role:'client',active:true,sheet:'Dealers',allBrands:true,brands:[],rowsList:[],contacts:phones.map((phone,i)=>({name:names[i],phone,email:'person'+i+'@example.am'})),managerPhone:'+37477123456',profileRevision:1};
  const reminder={id,number:42,revision:3,customer:{client:buyer.client,login:'buyer'},proposalId,deferRequestId,minutes:1,remindAfter:new Date(Date.now()-1000).toISOString()};
  const page=await browser.newPage({viewport:{width:390,height:844},...(process.env.ZZWS_ANDROID_CHROME?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'}:{})}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{sessionStorage.setItem('zzws_session_v3','a'.repeat(64));localStorage.setItem('zzws_language_v1','ru');Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.__clipboardDenied)throw Error('Denied');window.__copied=text;}}});});
  await page.route('**/functions/v1/zzws-api/**',async route=>{
   const request=route.request(),p=new URL(request.url()).pathname.split('/zzws-api/')[1];let data={};
   if(p==='me')data=owner;
   if(p==='admin/catalog-options')data={pairs:[]};
   if(p==='admin/users'&&request.method()==='GET')data={users:[buyer,owner]};
   if(p==='admin/users'&&request.method()==='POST'){savedPayload=request.postDataJSON();buyer={...buyer,...savedPayload};data={id:buyer.id};}
   if(p==='admin/price/versions')data={versions:[]};
   if(p==='admin/rules')data={rules:defaultRules(),defaults:defaultRules(),revision:'test'};
   if(p==='admin/dashboard')data={counts:{new:1}};
   if(p==='admin/orders')data={orders:[]};
   if(p==='admin/orders/summary')data={unreadCount:0,version:'1',refreshSeconds:5};
   if(p==='admin/orders/approval-reminders')data={serverTime:new Date().toISOString(),orders:due&&!answered?[reminder]:[]};
   if(p==='admin/orders/approval-reminder/snooze'){const payload=request.postDataJSON();assert.equal(payload.includeClient,false);reminder.snoozedUntil=payload.until;data={ok:true};}
   if(p==='admin/orders/approval-reminder'){
    prepareCount++;assert.equal(request.postDataJSON().deferRequestId,reminder.deferRequestId);
    if(answered){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Заказ уже изменился'})});return;}
    data={orderId:id,number:42,customer:buyer.client,contacts:buyer.contacts.filter(c=>c.phone).map(({name,phone})=>({name,phone})),managerPhone:buyer.managerPhone};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(new URL('admin/#tab=users',process.env.ZZWS_TEST_URL||site.url).href);
  await page.locator('#userList button').first().click();
  assert.equal(await page.locator('#userPhoneSettings input[type=tel]:visible').count(),1);assert.equal(await page.locator('#userPhoneSettings input[type=email]:visible').count(),1);assert.equal(await page.locator('#companyPhone').inputValue(),phones[0]);assert.equal(await page.locator('#userEmailSettings').isVisible(),false);await page.locator('#companyPhone').fill('+37498123456');await page.locator('#companyEmail').fill('aram@example.am');
  await fs.mkdir('output/approval-reminders',{recursive:true});
  await page.locator('#userPhoneSettings').scrollIntoViewIfNeeded();await page.screenshot({path:'output/approval-reminders/client-phones-mobile.png'});
  await page.setViewportSize({width:1400,height:1000});
  assert.equal(await page.locator('#userPhoneSettings input:visible').count(),2);
  await page.locator('#userPhoneSettings').scrollIntoViewIfNeeded();await page.locator('#userPhoneSettings').screenshot({path:'output/approval-reminders/client-contacts-desktop-ru.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#userForm').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>document.getElementById('userForm').hidden);
  assert.equal(savedPayload.companyPhone,'+37498123456');assert.equal(savedPayload.companyEmail,'aram@example.am');assert.equal(savedPayload.contacts,undefined);assert.equal(savedPayload.managerPhone,undefined);assert.equal(buyer.contacts.length,5);
  assert.equal(await page.locator('#adminApprovalReminderDialog').count(),0);
  due=true;await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.refresh());
  const dialog=page.locator('#adminApprovalReminderDialog');await dialog.locator('#approvalReminderPhone').waitFor();
  assert.ok((await dialog.innerText()).includes('Время клиента на раздумье истекло'));
  assert.equal(await dialog.locator('option').count(),5);
  assert.equal(await dialog.locator('option').last().innerText(),'Карен — '+phones[4]);
  await dialog.locator('select').selectOption(phones[4]);
  const text=await dialog.locator('textarea').inputValue();assert.ok(text.includes('№42'));assert.ok(text.includes(buyer.managerPhone));assert.ok(/[\u0531-\u0587]/.test(text));assert.ok(text.includes(new URL('./',process.env.ZZWS_TEST_URL||site.url).href));
  const expected='viber://forward?text='+encodeURIComponent(text);
  assert.equal(await page.locator('#approvalReminderViber').getAttribute('href'),expected);
  await dialog.getByText(/Viber не выбирает получателя автоматически/).waitFor();
  await page.locator('#approvalReminderCopyPhone').click();assert.equal(await page.evaluate(()=>window.__copied),phones[4]);
  await page.locator('#approvalReminderCopyText').click();assert.equal(await page.evaluate(()=>window.__copied),text);
  await dialog.getByText('Сообщение скопировано. Оно ещё не отправлено.',{exact:true}).waitFor();
  await page.evaluate(()=>window.__clipboardDenied=true);await page.locator('#approvalReminderCopyText').click();
  await dialog.getByText('Не удалось скопировать. Выделите текст или номер и скопируйте вручную.',{exact:true}).waitFor();
  assert.equal(await page.locator('#approvalReminderViber').getAttribute('href'),expected);
  assert.equal(await page.locator('#approvalReminderText').evaluate(el=>el.selectionEnd-el.selectionStart),text.length);
  // Capture the single click without launching Viber or sending any real message.
  await page.evaluate(()=>document.addEventListener('click',e=>{const link=e.target.closest('#approvalReminderViber');if(link){window.__viberLaunch=link.href;e.preventDefault();}},true));
  await page.locator('#approvalReminderViber').click();assert.equal(await page.evaluate(()=>window.__viberLaunch),expected);assert.equal(prepareCount,1);
  const updatedText=text+'\nA&B ? #42 + товар';await dialog.locator('textarea').fill(updatedText);
  let uri=new URL(await page.locator('#approvalReminderViber').getAttribute('href'));assert.equal(uri.searchParams.get('text'),updatedText);assert.deepEqual([...uri.searchParams.keys()],['text']);
  await dialog.locator('textarea').fill('a'.repeat(201));await dialog.getByText(/Viber может обрезать текст/).waitFor();
  await dialog.locator('textarea').fill('');assert.equal(await page.locator('#approvalReminderViber').getAttribute('href'),null);await dialog.locator('textarea').fill(text);
  assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'output/approval-reminders/reminder-mobile-ru.png'});
  await page.setViewportSize({width:1400,height:1000});await page.screenshot({path:'output/approval-reminders/reminder-desktop-ru.png'});
  await page.evaluate(()=>ZZWS_I18N.setLanguage('hy'));assert.equal(await dialog.locator('textarea').inputValue(),text);await dialog.getByText('Բացել Viber-ը և ընտրել ստացողին',{exact:true}).waitFor();
  await page.evaluate(()=>ZZWS_I18N.setLanguage('ru'));assert.equal(await dialog.locator('textarea').inputValue(),text);
  await dialog.getByRole('button',{name:'Напомнить через 5 минут',exact:true}).click();
  await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.refresh());
  await dialog.waitFor({state:'detached'});assert.equal(await page.locator('#adminApprovalReminders').isVisible(),true);
  await page.reload();await page.locator('#adminApprovalReminders').waitFor();assert.equal(await dialog.count(),0);
  // Explicit reopening always works during local postponement.
  await page.locator('#adminApprovalReminders button').click();await dialog.locator('textarea').waitFor();
  // A response on another device removes both the modal and persistent notice.
  answered=true;await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.refresh());assert.equal(await dialog.count(),0);assert.equal(await page.locator('#adminApprovalReminders').isVisible(),false);
  // Fresh deferrals get a fresh alert. Missing card contacts cannot launch a wrong recipient.
  answered=false;reminder.deferRequestId=crypto.randomUUID();delete reminder.snoozedUntil;buyer.contacts=[{name:'Бухгалтер',phone:'',email:'accounts@example.am'}];
  await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.refresh());await dialog.waitFor();
  await dialog.getByText('В карточке клиента нет телефона. Заполните его и откройте уведомление заново.',{exact:true}).waitFor();
  assert.equal(await page.locator('#approvalReminderViber').getAttribute('href'),null);
  assert.equal(await page.locator('#approvalReminderCopyText').isDisabled(),true);assert.equal(await page.locator('#approvalReminderCopyPhone').isDisabled(),true);
  // Invalid Armenian lengths and a retained trunk zero cannot become a recipient.
  await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.reset());reminder.deferRequestId=crypto.randomUUID();
  buyer.contacts=[{name:'Invalid',phone:'+374091123456'},{name:'Local',phone:'091 123456'}];
  await page.evaluate(user=>ZZWS_ADMIN_APPROVAL_REMINDERS.start(user),owner);await dialog.locator('select').waitFor();
  assert.equal(await dialog.locator('option').count(),1);assert.equal(await dialog.locator('select').inputValue(),'+37491123456');
  await page.evaluate(()=>ZZWS_ADMIN_APPROVAL_REMINDERS.reset());assert.equal(await dialog.count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: manual Viber recipient selection explained; Armenian message and ZZWS link; complete share text encoding; selected phone/message copying, denied clipboard, >200 warning, mobile/desktop, snooze/reload, cross-device response and missing phones. Real Viber not exercised; no messages sent.');
 }finally{await browser?.close();await site?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
