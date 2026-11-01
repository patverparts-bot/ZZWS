import test from 'node:test';import assert from 'node:assert/strict';
import {sendSmtp} from '../supabase/functions/zzws-api/smtp-mail.mjs';
import {sendGmail} from '../supabase/functions/zzws-api/gmail-mail.mjs';

const config={ZZWS_REPORT_EMAIL_MODE:'smtp',ZZWS_ENVIRONMENT:'production',ZZWS_SMTP_HOST:'mail.example.am',ZZWS_SMTP_PORT:'587',ZZWS_SMTP_USER:'sender@example.am',ZZWS_SMTP_PASSWORD:'synthetic-password',ZZWS_SMTP_FROM:'sender@example.am',ZZWS_GMAIL_USER:'sender@example.am',ZZWS_GMAIL_APP_PASSWORD:'synthetic app password'};
const env=name=>config[name];
const base={from:'sender@example.am',to:['primary@example.am'],cc:['copy@example.am','second@example.am'],reply_to:'reply@example.am',subject:'Synthetic test',text:'Test',attachments:[{filename:'report.xlsx',content:'dGVzdA=='}]};
const job={id:'11111111-1111-4111-8111-111111111111'};

for(const [name,send]of [['SMTP',sendSmtp],['Gmail',sendGmail]]){
 test(name+' isolates each envelope while preserving the reviewed To/CC headers, files and reply-to',async()=>{
  const messages=[];let closed=0;
  const createTransport=()=>({sendMail:async message=>{messages.push(message);return {accepted:[message.envelope.to[0]],rejected:[],messageId:message.messageId};},close(){closed++;}});
  const result=await send({job,message:{...base,envelopeTo:['COPY@example.am']},env,createTransport});
  assert.equal(result.result,'accepted');assert.deepEqual(messages[0].envelope,{from:base.from,to:['copy@example.am']});assert.deepEqual(messages[0].to,base.to);assert.deepEqual(messages[0].cc,base.cc);assert.equal(messages[0].replyTo,base.reply_to);assert.equal(messages[0].attachments[0].content,'dGVzdA==');assert.equal(messages[0].disableFileAccess,true);assert.equal(messages[0].disableUrlAccess,true);assert.equal(closed,1);
 });
 test(name+' can send valid copies with no valid primary header and primary rejection does not block a copy',async()=>{
  let attempts=0;
  const createTransport=()=>({sendMail:async message=>{attempts++;const target=message.envelope.to[0];if(target==='primary@example.am')throw Object.assign(new Error('Mailbox unavailable'),{command:'RCPT TO',responseCode:550});return {accepted:[target],rejected:[],messageId:message.messageId};},close(){}});
  const rejected=await send({job,message:{...base,envelopeTo:['primary@example.am']},env,createTransport});assert.equal(rejected.result,'rejected');
  const copied=await send({job:{id:'copy-recipient-unique-id'},message:{...base,to:[],envelopeTo:['copy@example.am']},env,createTransport});assert.equal(copied.result,'accepted');assert.equal(attempts,2);
 });
 test(name+' classifies final acceptance, explicit rejection and ambiguous DATA separately',async()=>{
  const outcomes=[
   [{accepted:['copy@example.am'],rejected:[]},'accepted'],
   [{accepted:[],rejected:['copy@example.am']},'rejected'],
   [{accepted:['second@example.am'],rejected:[]},'unknown'],
   [{accepted:['copy@example.am'],rejected:['second@example.am']},'unknown'],
   [{error:{command:'AUTH LOGIN',responseCode:535}},'rejected'],
   [{error:{command:'CONN',code:'ETIMEDOUT'}},'rejected'],
   [{error:{command:'RCPT TO',responseCode:550}},'rejected'],
   [{error:{command:'DATA',responseCode:550}},'rejected'],
   [{error:{command:'DATA',code:'ETIMEDOUT',accepted:['copy@example.am']}},'unknown'],
   [{error:{command:'DATA',code:'ECONNRESET'}},'unknown']
  ];
  for(const [outcome,expected]of outcomes){let closed=false;const createTransport=()=>({sendMail:async()=>{if(outcome.error)throw Object.assign(new Error('Synthetic mail failure'),outcome.error);return {...outcome,messageId:'synthetic-id'};},close(){closed=true;}});const result=await send({job,message:{...base,envelopeTo:['copy@example.am']},env,createTransport});assert.equal(result.result,expected,JSON.stringify(outcome));assert.equal(closed,true);}
 });
 test(name+' rejects invalid or unrelated envelope recipients before connecting and enforces the deployment allowlist',async()=>{
  const createTransport=()=>{throw Error('Must not connect');};
  for(const envelopeTo of [[],['copy@example.am','second@example.am'],['bad-address'],['copy@example.am\r\nBcc:evil@example.am'],['outside@example.am'],'copy@example.am'])await assert.rejects(send({job,message:{...base,envelopeTo},env,createTransport}));
  await assert.rejects(send({job,message:{...base,envelopeTo:['copy@example.am']},env:n=>n==='ZZWS_ENVIRONMENT'?'staging':n==='ZZWS_REPORT_TEST_RECIPIENTS'?'primary@example.am':env(n),createTransport}));
  let delivered;
  const allowed=n=>n==='ZZWS_ENVIRONMENT'?'staging':n==='ZZWS_REPORT_TEST_RECIPIENTS'?'copy@example.am':env(n);
  const result=await send({job,message:{...base,envelopeTo:['copy@example.am']},env:allowed,createTransport:()=>({sendMail:async message=>{delivered=message.envelope.to;return {accepted:delivered,rejected:[],messageId:'id'};},close(){}})});
  assert.equal(result.result,'accepted');assert.deepEqual(delivered,['copy@example.am']);
 });
 test(name+' keeps legacy whole-envelope rejection/partial-acceptance behavior unchanged',async()=>{
  let legacy;
  const result=await send({job,message:base,env,createTransport:()=>({sendMail:async message=>{legacy=message;return {accepted:['primary@example.am'],rejected:['copy@example.am','second@example.am']};},close(){}})});
  assert.equal(result.result,'unknown');assert.equal(Object.hasOwn(legacy,'envelope'),false);
  await assert.rejects(send({job,message:{...base,to:[]},env,createTransport:()=>{throw Error('Must not connect');}}));
 });
}
