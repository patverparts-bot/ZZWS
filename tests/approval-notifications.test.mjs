import test from 'node:test';import assert from 'node:assert/strict';
import {fcmTransport} from '../supabase/functions/_shared/fcm/transport.mjs';
import {telegramMessages} from '../work/admin-notifications-stage1/supabase/functions/_shared/telegram/message.mjs';
test('approval push transports only bounded review time and the named approval action',async()=>{
 let packet;const send=fcmTransport({projectId:'zzws-review',enabled:true,accessToken:async()=>'test-token',fetchImpl:async(url,request)=>{packet=JSON.parse(request.body);return {status:200,json:async()=>({name:'projects/zzws-review/messages/42'})};}});
 const base={token:'test-device-token-1234567890',eventId:crypto.randomUUID(),orderId:crypto.randomUUID(),revision:3,kind:'order.status',approvalAction:'deferred',reviewMinutes:60,privateKey:'NEVER_SEND'};assert.equal((await send(base)).state,'sent');assert.equal(packet.message.data.reviewMinutes,'60');assert.equal(packet.message.data.approvalAction,'deferred');assert.ok(!JSON.stringify(packet).includes('NEVER_SEND'));
 for(const minutes of [0,61,1.5,'60'])assert.equal((await send({...base,reviewMinutes:minutes})).state,'dead');assert.equal((await send({...base,approvalAction:'unknown'})).state,'dead');
});
test('administrator Telegram notification describes the exact requested review time',()=>{
 const event={schema_version:1,event_type:'order.updated',order_number:42,occurred_at:new Date().toISOString(),source:'approval_deferred',customer:{client:'Test customer'},actor:{role:'client'},changes:{approval:{}},snapshot:{status:'new',lines:[{articul:'A',name:'TV',qty:1,unitPrice:100}],total:100,approval:{state:'pending',reviewRequestedMinutes:60}}};
 const messages=telegramMessages(event);assert.ok(messages[0].includes('60'));assert.ok(messages[0].includes('ԺԱՄԱՆԱԿ'));assert.ok(messages[0].includes('№42'));assert.throws(()=>telegramMessages({...event,snapshot:{...event.snapshot,approval:{reviewRequestedMinutes:61}}}));
});
