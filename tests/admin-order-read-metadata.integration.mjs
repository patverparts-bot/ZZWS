import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

async function fixture(){
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result));return result.data;};
 const sessions={};for(const name of ['owner','manager','viewer','price','dealer'])sessions[name]=(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 await ok('account/reauth',sessions.owner,{password:'24681012'});await runtime.db.exec("update zzws_receipt_settings set mode='off'");
 const buyer=await ok('me',sessions.dealer),product=(await ok('catalog',sessions.dealer)).products[0];
 const submit=()=>ok('orders',sessions.dealer,{requestId:crypto.randomUUID(),profileRevision:buyer.profileRevision,deliveryVariantId:buyer.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
 return {runtime,call,ok,sessions,submit};
}

test('admin list read markers are per administrator, persist after explicit acknowledgement, and list/detail GET never mark read',async()=>{
 const {runtime,ok,sessions,submit}=await fixture();
 try{
  const first=await submit(),second=await submit();
  const list=async role=>(await ok('admin/orders',sessions[role])).orders;
  for(const role of ['owner','manager','viewer'])for(const row of await list(role)){assert.equal(row.adminReadRevision,0);assert.equal(row.unread,true);}
  await ok('admin/orders/detail',sessions.owner,{id:first.id});await list('owner');
  assert.equal((await runtime.db.query('select count(*)::int as count from zzws_admin_order_reads')).rows[0].count,0,'Fetching details and lists cannot acknowledge an order');
  await ok('admin/orders/read',sessions.owner,{id:first.id,revision:first.revision});
  let rows=await list('owner');assert.equal(rows.find(r=>r.id===first.id).adminReadRevision,first.revision);assert.equal(rows.find(r=>r.id===first.id).unread,false);assert.equal(rows.find(r=>r.id===second.id).adminReadRevision,0);assert.equal(rows.find(r=>r.id===second.id).unread,true);
  for(const role of ['manager','viewer']){const row=(await list(role)).find(r=>r.id===first.id);assert.equal(row.adminReadRevision,0);assert.equal(row.unread,true,'Other administrators keep their own unread state');}
  await ok('admin/orders/read',sessions.viewer,{id:second.id,revision:second.revision});
  rows=await list('owner');assert.equal(rows.find(r=>r.id===second.id).adminReadRevision,0);assert.equal((await list('viewer')).find(r=>r.id===second.id).unread,false);
  const fresh=await ok('admin/orders?status=new&before='+second.number,sessions.owner);assert.equal(fresh.orders.length,1);assert.equal(fresh.orders[0].adminReadRevision,1);assert.equal(fresh.orders[0].unread,false,'A fresh filtered/paginated request retains the persisted marker');
  for(const row of (await ok('orders',sessions.dealer)).orders){assert.equal(Object.hasOwn(row,'adminReadRevision'),false);assert.equal(Object.hasOwn(row,'unread'),false,'Customer lists cannot expose an administrator read marker');}
 }finally{await runtime.close();}
});

test('an older acknowledged revision stays unread after an order changes; stale acknowledgements never lower its marker',async()=>{
 const {runtime,ok,sessions,submit}=await fixture();
 try{
  const order=await submit();await ok('admin/orders/read',sessions.owner,{id:order.id,revision:order.revision});
  const updated=await ok('admin/orders/status',sessions.owner,{id:order.id,revision:order.revision,status:'confirmed',comment:'Synthetic revision change'});assert.ok(updated.revision>order.revision);
  let row=(await ok('admin/orders',sessions.owner)).orders.find(o=>o.id===order.id);assert.equal(row.adminReadRevision,order.revision);assert.equal(row.unread,true,'Reading an old revision cannot mark a newer revision viewed');
  await ok('admin/orders/read',sessions.owner,{id:order.id,revision:updated.revision});await ok('admin/orders/read',sessions.owner,{id:order.id,revision:order.revision});
  row=(await ok('admin/orders',sessions.owner)).orders.find(o=>o.id===order.id);assert.equal(row.adminReadRevision,updated.revision);assert.equal(row.unread,false);
  assert.deepEqual((await ok('admin/orders?status=new',sessions.owner)).orders,[],'Empty list remains compatible');
 }finally{await runtime.close();}
});

test('read metadata follows existing order permissions and ignores a caller-forged administrator identity',async()=>{
 const {runtime,call,ok,sessions,submit}=await fixture();
 try{
  const order=await submit(),manager=await ok('me',sessions.manager);
  for(const role of ['dealer','price']){assert.equal((await call('admin/orders',sessions[role])).status,403);assert.equal((await call('admin/orders/read',sessions[role],{id:order.id,revision:order.revision})).status,403);}
  assert.equal((await call('admin/orders',null)).status,401);
  await ok('admin/orders/read',sessions.owner,{id:order.id,revision:order.revision,userId:manager.id});
  const own=(await ok('admin/orders',sessions.owner)).orders[0],other=(await ok('admin/orders',sessions.manager)).orders[0];assert.equal(own.unread,false);assert.equal(other.adminReadRevision,0);assert.equal(other.unread,true);
  assert.equal((await runtime.db.query('select count(*)::int as count from zzws_admin_order_reads where user_id=$1',[manager.id])).rows[0].count,0,'Authenticated user controls marker ownership');
  assert.equal(runtime.reportEmails.length,0);
 }finally{await runtime.close();}
});
