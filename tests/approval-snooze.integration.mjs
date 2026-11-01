import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('custom reminder postponement is personal, optionally pauses the client, expires and ignores stale approval rounds',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const x=await call(...args);assert.equal(x.status,200,JSON.stringify(x));return x.data;};
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 try{
  const owner=await login('owner'),manager=await login('manager'),viewer=await login('viewer'),client=await login('dealer'),other=await login('kp');
  const me=await ok('me',client),p=(await ok('catalog',client)).products[1];await r.db.exec("update zzws_receipt_settings set mode='off'");
  const initial=await ok('orders',client,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:p.articul,qty:1,unitPrice:p.wholesale}]});
  const offer=await ok('admin/orders/update',owner,{id:initial.id,revision:initial.revision,status:'in_progress',comment:'Review',lines:initial.lines.map(l=>({...l,qty:2}))});
  const defer=await ok('orders/approval-defer',client,{orderId:offer.id,proposalId:offer.approval.id,revision:offer.revision,minutes:1,requestId:crypto.randomUUID()});
  const expire=async()=>r.db.transaction(async tx=>{await tx.query("select set_config('zzws.source','approval_deferred',true)");await tx.query("update zzws_orders set approval=jsonb_set(approval,'{remindAfter}',to_jsonb((now()-interval '1 minute')::text)) where id=$1",[offer.id]);});await expire();
  const due=(await ok('admin/orders/approval-reminders',owner)).orders[0],payload={orderId:due.id,revision:due.revision,proposalId:due.proposalId,deferRequestId:due.deferRequestId,until:new Date(Date.now()+2*86400000).toISOString(),includeClient:false,requestId:crypto.randomUUID()};
  for(const token of [viewer,client,other])assert.equal((await call('admin/orders/approval-reminder/snooze',token,payload)).status,403);
  for(const patch of [{until:'invalid'},{until:'2026-02-30T12:00:00.000Z'},{until:new Date(Date.now()-60000).toISOString()},{includeClient:'true'},{requestId:'invalid'},{recipientId:me.id}])assert.equal((await call('admin/orders/approval-reminder/snooze',owner,{...payload,...patch})).status,400);
  for(const patch of [{revision:due.revision+1},{proposalId:crypto.randomUUID()},{deferRequestId:crypto.randomUUID()}])assert.equal((await call('admin/orders/approval-reminder/snooze',owner,{...payload,...patch})).status,409);
  const before=(await r.db.query('select to_jsonb(o) data from zzws_orders o where id=$1',[offer.id])).rows[0].data;const eventsBefore=(await r.db.query('select count(*)::int n from zzws_order_events')).rows[0].n;
  await ok('admin/orders/approval-reminder/snooze',owner,payload);await ok('admin/orders/approval-reminder/snooze',owner,payload);
  assert.equal(Date.parse((await ok('admin/orders/approval-reminders',owner)).orders[0].snoozedUntil),Date.parse(payload.until));
  assert.equal((await ok('admin/orders/approval-reminders',manager)).orders[0].snoozedUntil,null);
  assert.equal((await ok('orders/approval-pending',client)).orders[0].reminderDue,true,'admin-only snooze leaves client due');
  assert.equal((await r.db.query("select count(*)::int n from zzws_audit where action='approval_reminder_snoozed'")).rows[0].n,1,'same request is idempotent');
  assert.equal((await call('admin/orders/approval-reminder/snooze',owner,{...payload,includeClient:true})).status,409);
  const together={...payload,until:new Date(Date.now()+3*86400000).toISOString(),includeClient:true,requestId:crypto.randomUUID()};await ok('admin/orders/approval-reminder/snooze',owner,together);
  const pending=(await ok('orders/approval-pending',client)).orders[0];assert.equal(pending.reminderDue,false);assert.equal(Date.parse(pending.remindAfter),Date.parse(together.until));
  assert.deepEqual((await r.db.query('select to_jsonb(o) data from zzws_orders o where id=$1',[offer.id])).rows[0].data,before,'postponement never changes commercial order/revision');assert.equal((await r.db.query('select count(*)::int n from zzws_order_events')).rows[0].n,eventsBefore,'no unsolicited order notification/event');
  const unchecked={...payload,until:new Date(Date.now()+86400000).toISOString(),requestId:crypto.randomUUID()};await ok('admin/orders/approval-reminder/snooze',owner,unchecked);assert.equal(Date.parse((await ok('orders/approval-pending',client)).orders[0].remindAfter),Date.parse(together.until),'unchecked leaves any existing client snooze unchanged');
  const snapshot=(await r.db.query('select zzws_application_snapshot() data')).rows[0].data;assert.equal(snapshot.tables.approval_reminder_snoozes.length,2);
  await r.db.exec("update zzws_approval_reminder_snoozes set snoozed_until=now()-interval '1 second'");assert.equal((await ok('orders/approval-pending',client)).orders[0].reminderDue,true);assert.ok(Date.parse((await ok('admin/orders/approval-reminders',owner)).orders[0].snoozedUntil)<=Date.now());
  await ok('admin/orders/approval-reminder/snooze',manager,{...payload,requestId:crypto.randomUUID(),includeClient:true});
  const renewed=await ok('orders/approval-defer',client,{orderId:defer.id,proposalId:defer.approval.id,revision:defer.revision,minutes:1,requestId:crypto.randomUUID()});await expire();
  assert.equal((await ok('orders/approval-pending',client)).orders[0].reminderDue,true,'a new deferral round invalidates old snoozes');assert.equal((await ok('admin/orders/approval-reminders',manager)).orders[0].snoozedUntil,null);assert.equal((await call('admin/orders/approval-reminder/snooze',owner,{...payload,requestId:crypto.randomUUID()})).status,409);
  await ok('orders/approval',client,{orderId:renewed.id,proposalId:renewed.approval.id,revision:renewed.revision,decision:'accept',declinedArticuls:[],requestId:crypto.randomUUID()});assert.equal((await ok('admin/orders/approval-reminders',owner)).orders.length,0);
  const privileges=(await r.db.query("select has_table_privilege('anon','public.zzws_approval_reminder_snoozes','select') a,has_function_privilege('authenticated','public.zzws_snooze_approval_reminder(uuid,uuid,integer,uuid,uuid,timestamptz,boolean,uuid)','execute') b")).rows[0];assert.ok(!privileges.a&&!privileges.b);
 }finally{await r.close();}
});
