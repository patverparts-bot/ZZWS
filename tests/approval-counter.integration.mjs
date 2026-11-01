import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
test('dashboard counts all pending customer approvals, supports the matching list and drops answered requests',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'content-type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const x=await call(...args);assert.equal(x.status,200,JSON.stringify(x));return x.data;};
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 try{
  const owner=await login('owner'),viewer=await login('viewer'),price=await login('price'),client=await login('dealer'),me=await ok('me',client),p=(await ok('catalog',client)).products[1];await r.db.exec("update zzws_receipt_settings set mode='off'");
  assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,0);assert.equal((await ok('admin/dashboard',price)).counts.approval_pending,undefined);assert.equal((await call('admin/dashboard',client)).status,403);
  const submit=()=>ok('orders',client,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{method:'Առաքում'},lines:[{articul:p.articul,qty:1,unitPrice:p.wholesale}]});
  const original=await submit();await submit();const offer=await ok('admin/orders/update',owner,{id:original.id,revision:original.revision,status:'in_progress',comment:'Review',lines:original.lines.map(l=>({...l,qty:2}))});
  assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,1);assert.equal((await ok('admin/dashboard',viewer)).counts.approval_pending,1);
  const deferred=await ok('orders/approval-defer',client,{orderId:offer.id,revision:offer.revision,proposalId:offer.approval.id,minutes:60,requestId:crypto.randomUUID()});assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,1,'future reminders still count');
  const filtered=await ok('admin/orders?status=approval_pending',viewer);assert.equal(filtered.orders.length,1);assert.equal(filtered.orders[0].id,offer.id);assert.equal((await ok('admin/orders?status=new',owner)).orders.length,2,'real status filter remains independent');
  const accepted=await ok('orders/approval',client,{orderId:deferred.id,revision:deferred.revision,proposalId:deferred.approval.id,decision:'accept',declinedArticuls:[],requestId:crypto.randomUUID()});assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,0);assert.equal((await ok('admin/orders?status=approval_pending',owner)).orders.length,0);
  const next=await ok('admin/orders/update',owner,{id:accepted.id,revision:accepted.revision,status:'in_progress',comment:'Review again',lines:accepted.lines.map(l=>({...l,qty:3}))});assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,1);await ok('orders/approval',client,{orderId:next.id,revision:next.revision,proposalId:next.approval.id,decision:'reject',declinedArticuls:[],requestId:crypto.randomUUID()});assert.equal((await ok('admin/dashboard',owner)).counts.approval_pending,0);
 }finally{await r.close();}
});
