import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRuntime} from './support/runtime.mjs';

async function fixture(){
 const runtime=await createRuntime({memory:true});
 const call=async(path,token,data)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const response=await call(...args);assert.equal(response.status,200,args[0]+': '+JSON.stringify(response));return response.data;};
 const password='Synthetic-person-2468',person=name=>({firstName:name,lastName:'FallbackFixture',phone:'+12025550101',email:name.toLowerCase()+'@example.invalid'});
 const admin=(await ok('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;
 await ok('account/reauth',admin,{password:'24681012'});
 const company=await ok('admin/users',admin,{intent:'create',client:'Fallback guards fixture',customerCode:'PRIMARY-GUARDS',role:'client',sheet:'Dealers',allBrands:true,active:true,companyEmail:'company@example.invalid',companyPhone:'+12025550101',rowsList:[{organization:'Synthetic company',address:'Synthetic address',contact:'Synthetic contact'}]});
 const open=await ok('invitation/open',null,{code:company.invitation.code});
 const manager=(await ok('account/password',open.sessionToken,{...person('Primary'),login:'fallback-guard-primary',password})).sessionToken;
 const enroll=async name=>{const invite=await ok('team/invite',manager,{label:name}),opened=await ok('invitation/open',null,{code:invite.invitation.code}),token=(await ok('account/password',opened.sessionToken,{...person(name),login:'fallback-guard-'+name.toLowerCase(),password})).sessionToken;return {id:invite.id,token};};
 const author=await enroll('Author'),coworker=await enroll('Coworker'),stranger=(await ok('login',null,{login:'zzws-test-kp',password:'24681012'})).sessionToken;
 const submit=async()=>{const me=await ok('me',author.token),products=(await ok('catalog',author.token)).products.filter(p=>p.wholesale>0&&p.hasMainStock).slice(0,2);assert.equal(products.length,2);return ok('orders',author.token,{requestId:randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Ինքնաառաքում',comment:'Synthetic fallback guards; no shipment'},lines:products.map(p=>({articul:p.articul,qty:1,unitPrice:p.wholesale}))});};
 const detail=async id=>(await ok('orders/detail',manager,{id})).order;
 const propose=async order=>ok('admin/orders/update',admin,{id:order.id,revision:order.revision,status:'confirmed',lines:order.lines.map(line=>({...line,qty:line.qty+1}))});
 const answer=(order,decision='accept',requestId=randomUUID(),declinedArticuls=[])=>({orderId:order.id,revision:order.revision,proposalId:order.approval.id,decision,declinedArticuls,requestId});
 const delay=(order,requestId=randomUUID())=>({orderId:order.id,revision:order.revision,proposalId:order.approval.id,minutes:1,requestId});
 return {runtime,call,ok,password,company,admin,manager,author,coworker,stranger,submit,detail,propose,answer,delay};
}

test('fallback actor provenance is separate from immutable author, private state and other-company authority',{timeout:120000},async()=>{
 const f=await fixture();try{
  const before={profile:await f.ok('me',f.manager),memory:await f.ok('me/state',f.manager),carts:await f.ok('me/carts',f.manager)};
  const created=await f.submit(),author=created.customer.author;let pending=await f.propose(created);
  for(const token of [f.coworker.token,f.stranger]){
   const frozen=await f.detail(pending.id);assert.equal((await f.call('orders/approval',token,f.answer(frozen))).status,404);assert.equal((await f.call('orders/approval-defer',token,f.delay(frozen))).status,404);assert.deepEqual(await f.detail(pending.id),frozen);
  }
  assert.equal((await f.call('orders/approval',f.admin,f.answer(pending))).status,403);assert.equal((await f.call('orders/approval-defer',f.admin,f.delay(pending))).status,403);
  assert.equal((await f.call('orders/approval',f.manager,{...f.answer(pending),actor:{id:f.author.id}})).status,400,'The caller cannot submit their own provenance DTO');
  pending=await f.ok('orders/approval-defer',f.manager,f.delay(pending));
  const actor=pending.approval.deferredBy;assert.equal(actor.id,f.company.id);assert.equal(actor.actingForAuthor,true);assert.deepEqual(Object.keys(actor).sort(),['id','firstName','lastName','login','clientRole','actingForAuthor'].sort());
  assert.equal((await f.ok('orders/approval-pending',f.manager)).orders.length,0);
  let accepted=await f.ok('orders/approval',f.manager,f.answer(pending,'accept',randomUUID(),[pending.approval.lines[1].articul]));assert.equal(accepted.lines.length,1);assert.equal(accepted.approval.response.actor.id,f.company.id);
  assert.equal((await f.ok('orders/detail',f.author.token,{id:accepted.id})).order.approval.response.actor.id,f.company.id);
  accepted=await f.ok('admin/orders/status',f.admin,{id:accepted.id,revision:accepted.revision,status:'completed'});
  assert.equal((await f.ok('orders/receipt-state',f.author.token)).pendingCount,1);assert.equal((await f.ok('orders/receipt-state',f.manager)).pendingCount,0,'Primary has its own receipt gate, not the employee gate');
  for(const token of [f.coworker.token,f.stranger])assert.equal((await f.call('orders/receipt',token,{id:accepted.id,revision:accepted.revision,intact:true})).status,404);
  assert.equal((await f.call('orders/receipt',f.admin,{id:accepted.id,revision:accepted.revision,intact:true})).status,404);
  const received=(await f.ok('orders/receipt',f.manager,{id:accepted.id,revision:accepted.revision,intact:true,actor:{id:f.coworker.id},userId:f.coworker.id})).order;
  assert.equal(received.received_by,f.company.id);assert.equal(received.receipt.actor.id,f.company.id);assert.equal(received.user_id,f.author.id);assert.deepEqual(received.customer.author,author);assert.deepEqual(received.original_lines,created.original_lines);
  assert.deepEqual({profile:await f.ok('me',f.manager),memory:await f.ok('me/state',f.manager),carts:await f.ok('me/carts',f.manager)},before);
  const gate=await f.ok('orders/receipt-state',f.author.token);assert.equal(gate.pendingCount,0);assert.equal(gate.blocked,false);
  for(const action of ['order_approval_deferred','order_approval_response','order_received'])assert.equal((await f.runtime.db.query('select actor from zzws_audit where action=$1 order by id desc limit 1',[action])).rows[0].actor,f.company.id);
  const events=(await f.ok('admin/orders/events?orderId='+received.id,f.admin)).events;assert.equal(events.find(e=>e.revision===received.revision).actor.id,f.company.id);
  assert.equal((await f.call('admin/orders/status',f.admin,{id:received.id,revision:received.revision,status:'rejected'})).status,409,'Fallback receipt does not weaken closed-order reopening rules');
  const acl=(await f.runtime.db.query("select proname,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated,has_function_privilege('service_role',oid,'execute') service from pg_proc where proname in ('zzws_order_response_actor','zzws_closed_order_reason_guard','zzws_respond_order_approval','zzws_defer_order_approval','zzws_confirm_receipt')")).rows;assert.equal(acl.length,5);assert.ok(acl.every(r=>!r.anon&&!r.authenticated&&r.service));assert.equal(f.runtime.reportEmails.length,0);
 }finally{await f.runtime.close();}
});

test('employee-primary competing answers and defers commit once; retries never replace the winning actor',{timeout:120000},async()=>{
 const f=await fixture();try{
  let pending=await f.propose(await f.submit());const request=f.answer(pending),tokens=[f.author.token,f.manager];
  const raced=await Promise.all(tokens.map(token=>f.call('orders/approval',token,request)));assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);const winner=raced.findIndex(r=>r.status===200),accepted=raced[winner].data;
  assert.deepEqual(await f.ok('orders/approval',tokens[winner],request),accepted);assert.equal((await f.call('orders/approval',tokens[1-winner],request)).status,409);assert.equal((await f.call('orders/approval',tokens[winner],{...request,decision:'reject'})).status,409);
  assert.equal(accepted.approval.response.actor.id,winner===0?f.author.id:f.company.id);
  pending=await f.propose(accepted);const deferredRequest=f.delay(pending);const defers=await Promise.all(tokens.map(token=>f.call('orders/approval-defer',token,deferredRequest)));assert.deepEqual(defers.map(r=>r.status).sort(),[200,409]);const deferWinner=defers.findIndex(r=>r.status===200),deferred=defers[deferWinner].data;
  assert.deepEqual(await f.ok('orders/approval-defer',tokens[deferWinner],deferredRequest),deferred);assert.equal((await f.call('orders/approval-defer',tokens[1-deferWinner],deferredRequest)).status,409);assert.equal((await f.call('orders/approval',f.manager,f.answer(pending))).status,409);
  let final=await f.ok('orders/approval',f.manager,f.answer(deferred));final=await f.ok('admin/orders/status',f.admin,{id:final.id,revision:final.revision,status:'completed'});
  const receipt={id:final.id,revision:final.revision,intact:true},receipts=await Promise.all(tokens.map(token=>f.call('orders/receipt',token,receipt)));assert.ok(receipts.every(r=>r.status===200));assert.deepEqual(receipts[0].data.order,receipts[1].data.order);assert.equal((await f.runtime.db.query('select count(*)::int count from zzws_receipt_notices where order_id=$1',[final.id])).rows[0].count,1);assert.deepEqual(receipts[0].data.order.customer.author,accepted.customer.author);
 }finally{await f.runtime.close();}
});

test('company primary can finish a deleted employee order while revoked sessions and other companies remain denied',{timeout:120000},async()=>{
 const f=await fixture();try{
  const created=await f.submit();let pending=await f.propose(created);const member=(await f.ok('team',f.manager)).members.find(m=>m.id===f.author.id);
  await f.ok('team/delete',f.manager,{id:f.author.id,expectedProfileRevision:member.profileRevision,password:f.password});assert.equal((await f.call('me',f.author.token)).status,401);
  pending=await f.ok('orders/approval-defer',f.manager,f.delay(pending));assert.equal(pending.approval.deferredBy.actingForAuthor,true);
  let accepted=await f.ok('orders/approval',f.manager,f.answer(pending));accepted=await f.ok('admin/orders/status',f.admin,{id:accepted.id,revision:accepted.revision,status:'completed'});
  const received=(await f.ok('orders/receipt',f.manager,{id:accepted.id,revision:accepted.revision,intact:true})).order;assert.equal(received.status,'received');assert.equal(received.receipt.actor.id,f.company.id);assert.deepEqual(received.customer.author,created.customer.author);assert.equal((await f.detail(received.id)).user_id,f.author.id);
  assert.equal((await f.call('orders/receipt',f.coworker.token,{id:received.id,revision:received.revision,intact:true})).status,404);assert.equal((await f.call('orders/receipt',f.stranger,{id:received.id,revision:received.revision,intact:true})).status,404);
 }finally{await f.runtime.close();}
});
