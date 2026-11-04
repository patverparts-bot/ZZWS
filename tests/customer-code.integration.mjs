import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import X from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {SHEET_COLUMNS} from '../supabase/functions/zzws-api/user-sheet.mjs';

test('customer code descriptions retain company, employee, cart, delivery, order and report relationships',{timeout:120000},async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{
  const multipart=data instanceof FormData;
  const res=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined||multipart?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:multipart?data:JSON.stringify(data)})}));
  return {status:res.status,data:await res.json()};
 };
 const ok=async(...args)=>{const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const book=rows=>{const b=X.utils.book_new();X.utils.book_append_sheet(b,X.utils.aoa_to_sheet(rows),'Data');return X.write(b,{type:'array',bookType:'xlsx'});};
 const person=name=>({firstName:name,lastName:'Code test',phone:'+37499123456',email:name.toLowerCase()+'@example.invalid'});
 const password='Code-label-135790';
 try{
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  await ok('account/reauth',owner,{password:'24681012'});
  const created=await ok('admin/users',owner,{intent:'create',client:'Code label shop',customerCode:'001234',role:'client',sheet:'Dealers',allBrands:true,active:true,rowsList:[{organization:'Saved company',address:'Saved warehouse',contact:'Saved receiver'}]});
  const enroll=async(invitation,name,login)=>{const open=await ok('invitation/open',null,{code:invitation.code});return (await ok('account/password',open.sessionToken,{...person(name),login,password})).sessionToken;};
  let manager=await enroll(created.invitation,'Manager','label.manager');
  const invite=await ok('team/invite',manager,{label:'Employee'});
  const employee=await enroll(invite.invitation,'Employee','label.employee');
  const before=await ok('me',employee),variant=before.rowsList[0].id;
  const product=(await ok('catalog',employee)).products[0];
  await ok('me/state',employee,{section:'cart',version:0,value:{[product.articul]:{articul:product.articul,qty:2}}});
  const submit=async()=>{const me=await ok('me',employee);return ok('orders',employee,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:variant,delivery:{method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});};
  const historical=await submit();
  assert.equal(historical.customer.customerCode,'001234');
  const snapshot=structuredClone(historical.customer),delivery=structuredClone(historical.delivery);
  let root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);
  const full='001234 Երևան / Shop (Կենտրոն)';
  await ok('admin/users',owner,{...root,intent:'update',expectedProfileRevision:root.profileRevision,customerCode:full});
  root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);
  assert.equal(root.customerCode,full);
  assert.equal(root.id,created.id);
  assert.equal(root.login,'label.manager');
  assert.equal(root.rowsList[0].id,variant);
  assert.deepEqual(root.rowsList,before.rowsList);
  const after=await ok('me',employee);
  assert.equal(after.customerId,created.id);
  assert.equal(after.customerCode,full);
  assert.equal(after.id,invite.id);
  assert.equal(after.rowsList[0].id,variant);
  assert.equal((await ok('me/state',employee)).data.cart[product.articul].qty,2);
  manager=(await ok('login',null,{login:'label.manager',password})).sessionToken;
  const team=await ok('team',manager);
  assert.ok(team.members.some(member=>member.id===invite.id&&member.login==='label.employee'));
  const saved=(await runtime.db.query('select customer_id,user_id,customer,delivery from zzws_orders where id=$1',[historical.id])).rows[0];
  assert.equal(saved.customer_id,created.id);
  assert.equal(saved.user_id,invite.id);
  assert.deepEqual(saved.customer,snapshot);
  assert.deepEqual(saved.delivery,delivery);
  assert.equal((await ok('orders/detail',employee,{id:historical.id})).order.id,historical.id);
  assert.equal((await ok('orders/detail',manager,{id:historical.id})).order.id,historical.id);
  const report=await ok('admin/orders/report-options',owner,{orderId:historical.id});
  assert.equal(report.recipient,'employee@example.invalid');
  const fresh=await submit();
  assert.equal(fresh.customer.customerCode,full);
  assert.equal(fresh.customer_id,created.id);
  assert.equal(fresh.customer.author.id,invite.id);
  for(const locale of ['hy','ru']){
   const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/orders/export',{method:'POST',headers:{apikey:'offline-public',Authorization:'Bearer '+employee,'Content-Type':'application/json'},body:JSON.stringify({id:fresh.id,locale})}));
   assert.equal(response.status,200,'New order export remains accessible to its author');
   const workbook=X.read(await response.arrayBuffer(),{type:'array'}),rows=X.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:false});
   const column=rows[0].indexOf(locale==='hy'?'Հաճախորդի կոդ':'Код клиента');
   assert.ok(column>=0);
   assert.equal(rows[1][column],full,'Export contains the complete label with leading zeros');
  }
  const customers=await ok('admin/orders/customers?search=001234',owner);
  assert.equal(customers.customers.find(u=>u.id===created.id).customerCode,full);
  // A second card with the same relationship key must fail even when the description differs.
  assert.equal((await call('admin/users',owner,{intent:'create',client:'Duplicate company',customerCode:'001234 Different shop',role:'client',sheet:'Dealers',active:true,allBrands:true,rowsList:[]})).status,409);
  const legacy=await ok('admin/users',owner,{intent:'create',client:'Legacy code company',customerCode:'Legacy.Code',role:'client',sheet:'Dealers',active:true,allBrands:true,rowsList:[]});
  // The database must enforce the prefix too, independently of API duplicate prechecks.
  await assert.rejects(()=>runtime.db.query("update zzws_users set profile=jsonb_set(profile,'{customerCode}',$2::jsonb) where id=$1",[legacy.id,JSON.stringify('001234 Direct SQL')]),error=>error.code==='23505');
  assert.equal((await runtime.db.query('select profile->>\'customerCode\' as code from zzws_users where id=$1',[legacy.id])).rows[0].code,'Legacy.Code');
  const row={customerCode:'001234',client:'Imported label shop',sheet:'Dealers',role:'Հաճախորդ'},headers=SHEET_COLUMNS.map(c=>c[1]);
  const upload=new FormData();upload.set('file',new File([book([headers,SHEET_COLUMNS.map(([key])=>row[key]||'')])],'clients.xlsx'));
  const draft=await ok('admin/users/preview',owner,upload);
  assert.equal(draft.users[0].action,'update');
  await ok('admin/users/import',owner,{draft:draft.draft});
  root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);
  assert.equal(root.customerCode,'001234');
  assert.equal(root.login,'label.manager');
  assert.equal(root.rowsList[0].id,variant);
  assert.equal((await ok('me',employee)).customerId,created.id);
  assert.equal((await ok('orders',employee)).orders.length,2);
  assert.equal((await runtime.db.query("select count(*)::int as total from zzws_users where customer_id is null and profile->>'role'='client' and left(profile->>'customerCode',6)='001234'")).rows[0].total,1);
  assert.equal(runtime.reportEmails.length,0,'Relationship tests do not send reports');
 }finally{await runtime.close();}
});

test('customer code migration refuses historical six-digit collisions without rewriting or merging customer cards',{timeout:120000},async()=>{
 const ids=[crypto.randomUUID(),crypto.randomUUID()],codes=['00432111','00432122'];
 let collisionDatabase,fixtureInserted=false;
 try{
  await assert.rejects(()=>createRuntime({memory:true,beforeSchemaFile:async(file,db)=>{
   if(!file.endsWith('_customer_code_prefix.sql'))return;
   fixtureInserted=true;collisionDatabase=db;
   for(let index=0;index<ids.length;index++){
    await db.query('insert into auth.users(id,email) values($1,$2)',[ids[index],ids[index]+'@example.invalid']);
    await db.query('insert into zzws_users(id,login,profile,active) values($1,$2,$3,true)',[ids[index],'historical-code-'+index,JSON.stringify({role:'client',client:'Historical company '+index,customerCode:codes[index],sheet:'Dealers',allBrands:true,rowsList:[]})]);
   }
  }}),error=>/customer.*code|prefix|կոդ/i.test(error.message));
  assert.equal(fixtureInserted,true,'The migration must be included in the clean schema plan');
  await collisionDatabase.exec('rollback');
  const saved=(await collisionDatabase.query('select id,login,profile,customer_id from zzws_users where id=any($1::uuid[]) order by login',[ids])).rows;
  assert.equal(saved.length,2,'Neither historical company is merged or removed');
  assert.deepEqual(saved.map(row=>row.id),ids);
  assert.deepEqual(saved.map(row=>row.profile.customerCode),codes);
  assert.ok(saved.every(row=>row.customer_id===null));
  const index=(await collisionDatabase.query("select indexdef from pg_indexes where schemaname='public' and indexname='zzws_customer_code_unique'")).rows[0];
  assert.ok(index,'The previous uniqueness index survives the failed migration');
 }finally{
  if(collisionDatabase)await collisionDatabase.close();
 }
});
