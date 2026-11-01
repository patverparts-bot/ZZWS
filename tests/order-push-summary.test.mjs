import test from 'node:test';import assert from 'node:assert/strict';
import {orderSummary,readOrderSummary} from '../supabase/functions/_shared/fcm/order-summary.mjs';
import {fcmTransport} from '../supabase/functions/_shared/fcm/transport.mjs';
import {runAndroidBatch} from '../supabase/functions/_shared/fcm/worker.mjs';
const id='11111111-1111-4111-8111-111111111111',job={id,leaseToken:id,token:'synthetic-device-token-12345',eventId:id,orderId:id,userId:id,revision:1,kind:'order.created'};
const summary={customerName:'Test LTD',number:18,total:1015000};
test('new-order projection includes only the client name, order number and total',()=>{
 assert.deepEqual(orderSummary({number:18,total:1015000,customer:{client:' Test\nLTD ',author:{email:'PRIVATE_EMAIL'}},lines:[{cost:10}]}),summary);
 for(const value of [null,{}, {number:18,total:-1,customer:{client:'Test'}},{number:18,total:Infinity,customer:{client:'Test'}},{number:18,total:10,customer:{client:''}}])assert.equal(orderSummary(value),null);
});
test('the amount and company come from the immutable creation event at the leased revision',async()=>{
 const filters={},client={from(table){assert.equal(table,'zzws_order_activity');return {select(columns){assert.equal(columns,'order_number,customer,snapshot');return this;},eq(key,value){filters[key]=value;return this;},async maybeSingle(){return {data:{order_number:18,customer:{client:'Test LTD'},snapshot:{total:1015000}},error:null};}};}};
 assert.deepEqual(await readOrderSummary(client,id,1),summary);assert.deepEqual(filters,{order_id:id,revision:1,event_type:'order.created'});
});
test('FCM sends the bounded summary only for its authorized recipient and new-order kind',async()=>{
 let packet,calls=0;const send=fcmTransport({projectId:'zzws-test',enabled:true,accessToken:async()=>'test-token',fetchImpl:async(url,request)=>{calls++;packet=JSON.parse(request.body);return {status:200,json:async()=>({name:'projects/zzws-test/messages/test'})};}});
 assert.equal((await send({...job,orderSummary:{...summary,author:'PRIVATE_AUTHOR'},privateKey:'PRIVATE_SECRET'})).state,'sent');assert.equal(packet.message.data.customerName,'Test LTD');assert.equal(packet.message.data.orderNumber,'18');assert.equal(packet.message.data.orderTotal,'1015000');assert.equal(packet.message.data.userId,id);assert.equal(packet.message.notification,undefined);assert.ok(!JSON.stringify(packet).includes('PRIVATE_'));
 for(const change of [{userId:undefined},{orderSummary:{...summary,total:NaN}},{orderSummary:{...summary,customerName:'spoof\nmessage'}}])assert.equal((await send({...job,orderSummary:summary,...change})).state,'dead');assert.equal(calls,1);
 await send({...job,kind:'order.status',orderSummary:summary});assert.equal(packet.message.data.customerName,undefined);assert.equal(packet.message.data.orderTotal,undefined);
});
test('worker reads a summary only after the existing recipient/lease gate permits delivery',async()=>{
 let claims=0,reads=0,seen;const acknowledgements=[];
 const store={rpc:async(name,args)=>{if(name==='zzws_claim_android')return claims++?null:job;if(name==='zzws_begin_android')return job;acknowledgements.push(args);return true;},orderSummary:async order=>{assert.equal(order,id);reads++;return summary;}};
 assert.equal((await runAndroidBatch({store,send:async value=>{seen=value;return {state:'sent',messageId:'fake'};},enabled:true})).sent,1);assert.equal(reads,1);assert.deepEqual(seen.orderSummary,summary);assert.equal(acknowledgements[0].p_result,'sent');
 reads=0;await runAndroidBatch({store:{rpc:async name=>name==='zzws_claim_android'?job:null,orderSummary:async()=>{reads++;throw Error('forbidden');}},send:async()=>{throw Error('must not send');},enabled:true});assert.equal(reads,0);
});
test('failed summary reads retry without contacting FCM or marking a delivery sent',async()=>{
 let claimed=false,called=false,finished;const store={rpc:async(name,args)=>{if(name==='zzws_claim_android'){if(claimed)return null;claimed=true;return job;}if(name==='zzws_begin_android')return job;finished=args;return true;},orderSummary:async()=>{throw Error('temporary database failure');}};
 const result=await runAndroidBatch({store,send:async()=>{called=true;return {state:'sent'};},enabled:true});assert.equal(result.retry,1);assert.equal(called,false);assert.equal(finished.p_result,'retry');
});
