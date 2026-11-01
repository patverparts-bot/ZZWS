import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('manager removes only own employees; administrator retains immutable deletion and order history',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const x=await call(...args);assert.equal(x.status,200,JSON.stringify(x));return x.data;};
 const adminPassword='24681012',password='Person-2468';
 try{
  const owner=(await ok('login',null,{login:'zzws-test-owner',password:adminPassword})).sessionToken;await ok('account/reauth',owner,{password:adminPassword});
  const created=await ok('admin/users',owner,{intent:'create',client:'Deletion history shop',customerCode:'009988',role:'client',sheet:'Dealers',active:true,allBrands:true,rowsList:[{organization:'Shop',address:'Unchanged warehouse',contact:'Unchanged chief'}]});
  const enroll=async(invite,name)=>{const open=await ok('invitation/open',null,{code:invite.invitation.code});return (await ok('account/password',open.sessionToken,{login:name,password,firstName:name,lastName:'Test',phone:'+37499123456',email:name+'@example.am'})).sessionToken;};
  const manager=await enroll(created,'history.manager'),first=await ok('team/invite',manager,{label:'Active employee'}),employee=await enroll(first,'history.employee'),disabled=await ok('team/invite',manager,{label:'Disabled employee'}),disabledToken=await enroll(disabled,'history.disabled');await ok('team/access',manager,{id:disabled.id,active:false});const pending=await ok('team/invite',manager,{label:'Pending employee'}),pendingOpen=await ok('invitation/open',null,{code:pending.invitation.code});
  const root=(await ok('admin/users',owner)).users.find(u=>u.id===created.id),member=(await ok('team',manager)).members.find(u=>u.id===first.id),payload={id:first.id,expectedProfileRevision:member.profileRevision,password};
  const me=await ok('me',employee),product=(await ok('catalog',employee)).products[0],order=await ok('orders',employee,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  const before=(await r.db.query('select customer,delivery,lines from zzws_orders where id=$1',[order.id])).rows[0];
  const stranger=(await ok('login',null,{login:'zzws-test-dealer',password:adminPassword})).sessionToken;
  for(const token of [employee,owner])assert.equal((await call('team/delete',token,payload)).status,403);
  assert.equal((await call('team/delete',stranger,payload)).status,404);
  assert.equal((await call('team/delete',manager,{...payload,id:created.id})).status,404);
  for(const invalid of [undefined,'wrong-password'])assert.equal((await call('team/delete',manager,{...payload,password:invalid})).status,400);
  assert.equal((await call('team/delete',manager,{...payload,expectedProfileRevision:member.profileRevision+1})).status,409);
  assert.equal((await call('team/delete',manager,{...payload,id:'invalid'})).status,400);assert.equal((await call('me',employee)).status,200);
  await ok('team/delete',manager,payload);
  assert.equal((await call('me',employee)).status,401);assert.equal((await call('login',null,{login:'history.employee',password})).status,401);assert.ok(!(await ok('team',manager)).members.some(u=>u.id===first.id));
  let history=(await ok('admin/users/team?id='+created.id,owner)).members.find(u=>u.id===first.id);assert.equal(history.status,'deleted');assert.equal(history.person.email,'history.employee@example.am');assert.equal(history.deletedBy.id,created.id);assert.equal(history.deletedBy.login,'history.manager');assert.equal(history.deletedBy.name,'history.manager Test');assert.ok(history.deletedAt);const removedAt=history.deletedAt;
  assert.equal((await call('team/delete',manager,payload)).status,404);assert.equal((await call('team/access',manager,{id:first.id,active:true})).status,409);assert.equal((await call('team/invitation',manager,{id:first.id})).status,409);assert.equal((await call('admin/users/team/access',owner,{id:first.id,active:true})).status,409);assert.equal((await call('admin/users/reset-password',owner,{id:first.id})).status,409);
  assert.deepEqual((await r.db.query('select customer,delivery,lines from zzws_orders where id=$1',[order.id])).rows[0],before);assert.equal((await ok('admin/orders/report-options',owner,{orderId:order.id})).recipient,'history.employee@example.am');assert.equal((await ok('orders',manager)).orders[0].id,order.id);
  for(const id of [disabled.id,pending.id]){const m=(await ok('team',manager)).members.find(u=>u.id===id);await ok('team/delete',manager,{id,expectedProfileRevision:m.profileRevision,password});}
  assert.equal((await call('me',disabledToken)).status,401);assert.equal((await call('me',pendingOpen.sessionToken)).status,401);assert.equal((await call('invitation/open',null,{code:pending.invitation.code})).status,401);
  // Historical staff do not block company profile/price changes or consume invitation slots.
  await ok('admin/users',owner,{...root,intent:'update',expectedProfileRevision:root.profileRevision,client:'Updated shop',sheet:'KP'});
  await r.db.query("with ids as materialized(select gen_random_uuid() id from generate_series(1,200)), added as(insert into auth.users(id,email) select id,id::text||'@example.invalid' from ids returning id) insert into zzws_users(id,login,profile,active,customer_id,needs_password_setup,deleted_at) select id,'history-'||id::text,(select profile from zzws_users where id=$1),false,$1,false,now() from added",[created.id]);
  const currentManager=(await ok('login',null,{login:'history.manager',password})).sessionToken;await ok('team/invite',currentManager,{label:'Replacement'});
  const changed=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);await ok('admin/users/archive',owner,{id:created.id,expectedProfileRevision:changed.profileRevision,password:adminPassword,reason:'Temporary closure'});const archived=(await ok('admin/users/archive?search=009988',owner)).rows[0];await ok('admin/users/restore',owner,{id:created.id,expectedProfileRevision:archived.profileRevision,password:adminPassword});
  history=(await ok('admin/users/team?id='+created.id,owner)).members.find(u=>u.id===first.id);assert.equal(history.status,'deleted');assert.equal(history.deletedAt,removedAt);assert.equal(history.deletedBy.login,'history.manager');
  const snapshot=(await r.db.query('select zzws_application_snapshot() data')).rows[0].data;assert.equal(snapshot.tables.users.find(u=>u.id===first.id).deletion_actor.id,created.id);
  const freshRoot=(await ok('admin/users',owner)).users.find(u=>u.id===created.id);await ok('admin/users/delete',owner,{id:created.id,expectedProfileRevision:freshRoot.profileRevision,password:adminPassword});assert.equal((await r.db.query('select deletion_actor,deleted_at::text from zzws_users where id=$1',[first.id])).rows[0].deletion_actor.login,'history.manager');
  assert.equal((await r.db.query("select count(*)::int n from zzws_audit where action='employee_delete'")).rows[0].n,3);
  const privileges=(await r.db.query("select has_function_privilege('anon','public.zzws_team_delete(uuid,text,uuid,bigint)','execute') a,has_function_privilege('authenticated','public.zzws_team_delete(uuid,text,uuid,bigint)','execute') b")).rows[0];assert.ok(!privileges.a&&!privileges.b);
 }finally{await r.close();}
});
