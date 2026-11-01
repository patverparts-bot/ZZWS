import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import X from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {SHEET_COLUMNS} from '../supabase/functions/zzws-api/user-sheet.mjs';

test('client teams: invitation, personal credentials, shared prices, isolated carts, immutable authors and report routing',{timeout:120000},async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const multipart=data instanceof FormData,res=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined||multipart?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:multipart?data:JSON.stringify(data)})}));return {status:res.status,data:await res.json()};};
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const person=(name)=>({firstName:name,lastName:'Test',phone:'+37499123456',email:name.toLowerCase()+'@example.am'});
 const password='Personal-2468';
 const book=rows=>{const b=X.utils.book_new();X.utils.book_append_sheet(b,X.utils.aoa_to_sheet(rows),'Data');return X.write(b,{type:'array',bookType:'xlsx'});};
 try{
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;await ok('account/reauth',owner,{password:'24681012'});
  let ownerProfile=await ok('me',owner);await ok('admin/users',owner,{...ownerProfile,replyToEmail:'reply@example.am',intent:'update',expectedProfileRevision:ownerProfile.profileRevision});
  let settings=await ok('admin/email-settings',owner);const cc=['copy1@example.am','copy2@example.am','copy3@example.am'];await ok('admin/email-settings',owner,{revision:settings.revision,cc,fromEmail:'report@zzws.invalid'});
  const created=await ok('admin/users',owner,{intent:'create',client:'Team shop',customerCode:'001234',role:'client',sheet:'KP',allBrands:true,active:true,companyEmail:'shop@example.am',companyPhone:'+37410123456',rowsList:[{organization:'Team shop',address:'Common address',contact:'Old company contact'},{organization:'Second organization',address:'Second address',contact:'Second chief +37411111112'},{organization:'Third organization',address:'Third address',contact:'Third chief +37411111113'}]});
  const invitation=await ok('invitation/open',null,{code:created.invitation.code});assert.equal(invitation.needsPasswordSetup,true);assert.equal(invitation.clientRole,'manager');
  assert.equal((await call('catalog',invitation.sessionToken)).status,403);
  assert.equal((await call('account/password',invitation.sessionToken,{...person('Armen'),login:'armen.team',password,phone:'bad'})).status,400);
  let manager=(await ok('account/password',invitation.sessionToken,{...person('Armen'),login:'armen.team',password})).sessionToken;
  assert.equal((await call('invitation/open',null,{code:created.invitation.code})).status,401);
  assert.equal((await ok('login',null,{login:'armen.team',password})).id,created.id);
  const first=await ok('team/invite',manager,{label:'Karen'}),second=await ok('team/invite',manager,{label:'David'});
  assert.equal((await ok('admin/users/team?id='+created.id,owner)).members.filter(m=>m.status==='invited').length,2);
  const enroll=async(invite,name,login)=>{const open=await ok('invitation/open',null,{code:invite.invitation.code});return (await ok('account/password',open.sessionToken,{...person(name),login,password})).sessionToken;};
  const employee=await enroll(first,'Karen','karen.team');
  const secondOpen=await ok('invitation/open',null,{code:second.invitation.code});assert.equal((await call('account/password',secondOpen.sessionToken,{...person('David'),login:'karen.team',password})).status,409);
  const other=await enroll(second,'David','david.team');
  assert.equal((await call('team/invite',employee,{})).status,403);
  assert.equal((await call('admin/users',employee)).status,403);
  const stranger=(await ok('login',null,{login:'zzws-test-dealer',password:'24681012'})).sessionToken;
  assert.equal((await call('team/access',stranger,{id:first.id,active:false})).status,404);
  const a=await ok('me',employee),b=await ok('me',other);assert.equal(a.customerId,created.id);assert.equal(a.customerCode,'001234');assert.equal(a.clientRole,'employee');assert.equal(a.rowsList.length,3);assert.deepEqual(a.rowsList,b.rowsList);
  assert.deepEqual((await ok('catalog',employee)).products,(await ok('catalog',manager)).products);
  const carts=await Promise.all([ok('me/state',employee,{section:'cart',version:0,value:{'test-001':{articul:'test-001',qty:1}}}),ok('me/state',other,{section:'cart',version:0,value:{'test-002':{articul:'test-002',qty:2}}})]);assert.equal(carts.length,2);
  assert.ok((await ok('me/state',employee)).data.cart['test-001']);assert.equal((await ok('me/state',employee)).data.cart['test-002'],undefined);
  let root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);
  await ok('admin/users',owner,{...root,intent:'update',expectedProfileRevision:root.profileRevision,sheet:'Dealers',catalogAccess:{mode:'selected',include:[{brand:'Samsung',category:'',categoryMatch:'exact'}],exclude:[]}});
  manager=(await ok('login',null,{login:'armen.team',password})).sessionToken;
  const fresh=await ok('me',employee);assert.equal(fresh.sheet,'Dealers');assert.ok(fresh.profileRevision>a.profileRevision);const products=(await ok('catalog',employee)).products;assert.ok(products.length);assert.ok(products.every(p=>p.brand==='Samsung'));
  const submit=async(token,index=0)=>{const u=await ok('me',token),p=(await ok('catalog',token)).products[0];return ok('orders',token,{requestId:crypto.randomUUID(),profileRevision:u.profileRevision,deliveryVariantId:u.rowsList[index].id,delivery:{method:'Առաքում'},lines:[{articul:p.articul,qty:1,unitPrice:p.wholesale}]});};
  const order=await submit(employee,1),order2=await submit(other,2);assert.equal(order.customer_id,created.id);assert.equal(order.delivery.address,'Second address');assert.equal(order.delivery.contact,'Second chief +37411111112');assert.equal(order2.delivery.address,'Third address');assert.equal(order2.delivery.contact,'Third chief +37411111113');assert.equal(order.delivery.email,undefined);assert.equal(order.customer.author.id,first.id);assert.equal(order.customer.customerCode,'001234');assert.equal(order.customer.login,undefined);
  assert.equal((await ok('orders',employee)).orders.length,1);assert.equal((await ok('orders',manager)).orders.length,2);assert.equal((await call('orders/detail',other,{id:order.id})).status,404);assert.equal((await ok('orders/detail',manager,{id:order.id})).order.id,order.id);
  await ok('account/profile',employee,{...person('Karen'),email:'changed@example.am'});assert.equal((await ok('orders/detail',employee,{id:order.id})).order.customer.author.email,'karen@example.am');
  const options=await ok('admin/orders/report-options',owner,{orderId:order.id});assert.equal(options.recipient,'karen@example.am');assert.equal(options.cc,undefined);assert.deepEqual(options.rows,[]);
  async function report(o,defaults,additional=''){
   const bytes=book([['articul','qty','unitprice'],...o.lines.map(l=>[l.articul,l.qty,l.unitPrice])]);const form=()=>{const f=new FormData();f.set('files',new File([bytes],'վաճառքի_հաշվետվություն.xlsx'));f.set('orderId',o.id);f.set('revision',o.revision);f.set('reportIndex','0');return f;};
   const preview=await ok('admin/orders/report-preview',owner,form()),send=form();send.set('expiry',preview.expiry);send.set('proof',preview.proof);send.set('confirmCustomer','true');send.set('requestId',crypto.randomUUID());send.set('includeDefaults',String(defaults));send.set('additionalCC',additional);send.set('selectedRows','[4]');
   const r=await ok('admin/orders/report-send',owner,send);assert.equal(r.accepted,true);assert.equal(r.completed,true);return runtime.reportEmails.at(-1);
  }
  const sent=await report(order,true,'extra@example.am; second@example.am, EXTRA@example.am');assert.deepEqual(sent.to,['karen@example.am']);assert.deepEqual(sent.cc,[...cc.slice(0,2),'extra@example.am','second@example.am']);assert.deepEqual(sent.bcc,[cc[2]]);
  const sent2=await report(order2,false);assert.deepEqual(sent2.to,['david@example.am']);assert.deepEqual(sent2.cc,[]);
  const counts=(await runtime.db.query('select counts from zzws_report_deliveries where order_id=$1',[order.id])).rows[0].counts;assert.deepEqual(counts.recipients.to,['karen@example.am']);assert.equal(counts.includeDefaults,true);
  // Import by business code must retain the person's chosen login and existing user ID.
  root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);const row={customerCode:'001234',client:'Imported name',sheet:'Dealers',role:'Հաճախորդ'},headers=SHEET_COLUMNS.map(c=>c[1]),values=SHEET_COLUMNS.map(c=>row[c[0]]||'');const upload=new FormData();upload.set('file',new File([book([headers,values])],'clients.xlsx'));const draft=await ok('admin/users/preview',owner,upload);assert.equal(draft.users[0].action,'update');await ok('admin/users/import',owner,{draft:draft.draft});root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);assert.equal(root.login,'armen.team');assert.equal(root.id,created.id);assert.equal(root.client,'Imported name');
  assert.equal((await ok('admin/orders/customers?search=001234',owner)).customers[0].id,created.id);
  // Invitation replacement, revocation and other-customer isolation.
  const nextManager=(await ok('login',null,{login:'armen.team',password})).sessionToken;
  const pending=await ok('team/invite',nextManager,{label:'Waiting'}),renew=await ok('team/invitation',nextManager,{id:pending.id});assert.equal((await call('invitation/open',null,{code:pending.invitation.code})).status,401);assert.equal((await ok('invitation/open',null,{code:renew.invitation.code})).id,pending.id);
  await ok('team/access',nextManager,{id:first.id,active:false});assert.equal((await call('me',employee)).status,401);
  await ok('admin/users',owner,{...root,intent:'update',expectedProfileRevision:root.profileRevision,active:false});assert.equal((await call('me',other)).status,401);
  const privileges=await runtime.db.query("select proname,has_function_privilege('anon',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('zzws_team_create','zzws_team_access','zzws_account_person','zzws_account_activate')");assert.ok(privileges.rows.length===4);assert.ok(privileges.rows.every(r=>!r.allowed));
 }finally{await runtime.close();}
});
