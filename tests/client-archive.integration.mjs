import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('customer archive requires a reason/password, preserves history and restores only previous access',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const x=await call(...args);assert.equal(x.status,200,JSON.stringify(x));return x.data;};
 const password='24681012',personal='Person-2468',reason='Договор приостановлен: 10% задолженности.\nПроверить оплату.';
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password})).sessionToken;
 try{
  const owner=await login('owner');await ok('account/reauth',owner,{password});
  const created=await ok('admin/users',owner,{intent:'create',role:'client',client:'Archive shop',customerCode:'009977',sheet:'Dealers',active:true,allBrands:true,rowsList:[{organization:'Historic shop',address:'Historic warehouse',contact:'Historic chief'}]});
  const enroll=async(invite,name)=>{const open=await ok('invitation/open',null,{code:invite.invitation.code});return (await ok('account/password',open.sessionToken,{login:name,password:personal,firstName:name,lastName:'Test',phone:'+37499123456',email:name+'@example.am'})).sessionToken;};
  const manager=await enroll(created,'archive.manager'),a=await ok('team/invite',manager,{label:'Active'}),employee=await enroll(a,'archive.active'),b=await ok('team/invite',manager,{label:'Disabled'});await enroll(b,'archive.disabled');await ok('team/access',manager,{id:b.id,active:false});
  const pending=await ok('team/invite',manager,{label:'Pending'});const pendingSession=await ok('invitation/open',null,{code:pending.invitation.code});
  const root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id),payload={id:created.id,expectedProfileRevision:root.profileRevision,password,reason};
  const me=await ok('me',employee),product=(await ok('catalog',employee)).products[0];
  const order=await ok('orders',employee,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  const before=(await r.db.query('select customer,delivery,lines from zzws_orders where id=$1',[order.id])).rows[0];
  for(const token of [manager,employee,await login('manager'),await login('viewer')]){assert.equal((await call('admin/users/archive',token,payload)).status,403);assert.equal((await call('admin/users/archive',token)).status,403);assert.equal((await call('admin/users/restore',token,payload)).status,403);}
  for(const invalid of ['', '  ', 'ab', 'x'.repeat(1001),'bad\u0001reason'])assert.equal((await call('admin/users/archive',owner,{...payload,reason:invalid})).status,400);
  for(const invalid of [undefined,'wrong-password'])assert.equal((await call('admin/users/archive',owner,{...payload,password:invalid})).status,400);
  assert.equal((await call('admin/users/archive',owner,{...payload,expectedProfileRevision:root.profileRevision+1})).status,409);
  assert.equal((await call('admin/users/archive',owner,{...payload,id:a.id})).status,403);
  assert.equal((await call('me',employee)).status,200);
  assert.equal((await ok('admin/users/archive',owner,payload)).accounts,4);
  const archived=(await ok('admin/users/archive?search=009977',owner)).rows[0];assert.equal(archived.archiveReason,reason);assert.equal(archived.archivedBy,'ZZWS test owner');assert.equal(archived.employees,3);assert.ok(archived.profileRevision>root.profileRevision);assert.equal(archived.wasActive,true);
  assert.equal((await ok('admin/users/archive?search=%25',owner)).total,1);assert.equal((await ok('admin/users/archive?search=___',owner)).total,0);
  assert.equal((await ok('admin/users/archive?search='+encodeURIComponent('задолженности'),owner)).total,1);
  const people=(await r.db.query('select id,active,archive_active,archived_at,archive_reason from zzws_users where id=$1 or customer_id=$1',[created.id])).rows;assert.ok(people.every(u=>!u.active&&u.archived_at&&u.archive_reason===reason));assert.equal(people.find(u=>u.id===b.id).archive_active,false);
  for(const token of [manager,employee,pendingSession.sessionToken])assert.equal((await call('me',token)).status,401);
  assert.equal((await call('login',null,{login:'archive.manager',password:personal})).status,401);assert.equal((await call('invitation/open',null,{code:pending.invitation.code})).status,401);
  assert.ok(!(await ok('admin/users',owner)).users.some(u=>u.id===created.id));assert.equal((await ok('admin/orders/customers?search=009977',owner)).customers.length,0);
  assert.equal((await call('admin/users',owner,{...root,intent:'update',active:true,expectedProfileRevision:archived.profileRevision})).status,409);
  assert.equal((await call('admin/users/team/access',owner,{id:a.id,active:true})).status,409);
  assert.equal((await call('admin/users/reset-password',owner,{id:created.id})).status,409);
  assert.equal((await call('admin/users/invitation',owner,{id:pending.id})).status,409);
  assert.equal((await call('admin/users/delete',owner,{...payload,expectedProfileRevision:archived.profileRevision})).status,409);
  assert.deepEqual((await r.db.query('select customer,delivery,lines from zzws_orders where id=$1',[order.id])).rows[0],before);
  assert.equal((await ok('admin/orders/report-options',owner,{orderId:order.id})).recipient,'archive.active@example.am');
  const snapshot=(await r.db.query('select zzws_application_snapshot() data')).rows[0].data;assert.equal(snapshot.tables.users.find(u=>u.id===created.id).archive_reason,reason);
  const restore={id:created.id,expectedProfileRevision:archived.profileRevision,password};
  assert.equal((await call('admin/users/restore',owner,{...restore,password:undefined})).status,400);assert.equal((await call('admin/users/restore',owner,{...restore,password:'wrong'})).status,400);
  assert.equal((await call('admin/users/restore',owner,{...restore,expectedProfileRevision:root.profileRevision})).status,409);
  await ok('admin/users/restore',owner,restore);
  const restored=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);assert.equal(restored.active,true);assert.deepEqual(restored.rowsList,root.rowsList);assert.equal(restored.login,root.login);assert.equal((await ok('admin/users/archive',owner)).total,0);
  const employeeFresh=await ok('login',null,{login:'archive.active',password:personal});assert.equal(employeeFresh.archiveReason,undefined);assert.equal((await call('login',null,{login:'archive.disabled',password:personal})).status,401);
  assert.equal((await call('me',employee)).status,401,'old sessions remain revoked after restoration');assert.equal((await call('invitation/open',null,{code:pending.invitation.code})).status,401);
  const newInvite=await ok('admin/users/invitation',owner,{id:pending.id});assert.equal((await ok('invitation/open',null,{code:newInvite.invitation.code})).id,pending.id);
  const audits=(await r.db.query("select action,detail from zzws_audit where action in ('customer_archive','customer_restore') order by id")).rows;assert.equal(audits.length,2);assert.ok(audits.every(x=>JSON.parse(x.detail).reason===reason));
  // Archiving a previously disabled root does not enable it on restoration.
  await ok('admin/users',owner,{...restored,intent:'update',active:false,expectedProfileRevision:restored.profileRevision});
  const inactive=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);await ok('admin/users/archive',owner,{id:inactive.id,expectedProfileRevision:inactive.profileRevision,password,reason:'Ожидание договора'});const inactiveArchive=(await ok('admin/users/archive',owner)).rows[0];assert.ok(inactiveArchive.profileRevision>inactive.profileRevision);await ok('admin/users/restore',owner,{id:inactive.id,expectedProfileRevision:inactiveArchive.profileRevision,password});assert.equal((await ok('admin/users',owner)).users.find(u=>u.id===created.id).active,false);
  // Server-side pagination covers every archived customer, including beyond page 1.
  for(let i=0;i<51;i++){const id=crypto.randomUUID();await r.db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.invalid']);await r.db.query("insert into zzws_users(id,login,profile,active,archived_at,archive_reason,archive_active) values($1,$2,$3,false,now(),'Pagination reason',false)",[id,'archive-page-'+i,JSON.stringify({role:'client',client:'Archive page '+i,customerCode:'',sheet:'Dealers',allBrands:true,rowsList:[]})]);}
  const page1=await ok('admin/users/archive?search=Pagination',owner),page2=await ok('admin/users/archive?search=Pagination&offset=50',owner);assert.equal(page1.total,51);assert.equal(page1.rows.length,50);assert.equal(page2.rows.length,1);assert.ok(!page1.rows.some(x=>x.id===page2.rows[0].id));
  assert.equal((await call('admin/users/archive?offset=-1',owner)).status,400);
  const privileges=(await r.db.query("select has_function_privilege('anon','public.zzws_archive_customer(uuid,text,uuid,bigint,text,boolean)','execute') a,has_function_privilege('authenticated','public.zzws_customer_archive_list(text,integer)','execute') b")).rows[0];assert.ok(!privileges.a&&!privileges.b);
 }finally{await r.close();}
});
