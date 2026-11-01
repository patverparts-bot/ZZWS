import test from 'node:test';import assert from 'node:assert/strict';
import {sendSmtp} from '../supabase/functions/zzws-api/smtp-mail.mjs';
import {sendGmail} from '../supabase/functions/zzws-api/gmail-mail.mjs';
const config={ZZWS_REPORT_EMAIL_MODE:'smtp',ZZWS_ENVIRONMENT:'production',ZZWS_SMTP_HOST:'mail.example.am',ZZWS_SMTP_PORT:'587',ZZWS_SMTP_USER:'sender@example.am',ZZWS_SMTP_PASSWORD:'synthetic-password',ZZWS_SMTP_FROM:'sender@example.am',ZZWS_GMAIL_USER:'sender@example.am',ZZWS_GMAIL_APP_PASSWORD:'synthetic password'};
const env=n=>config[n],job={id:'bcc-test-job'};
const base={from:'sender@example.am',to:['main@example.am'],cc:['visible@example.am'],bcc:['hidden1@example.am','hidden2@example.am'],reply_to:'reply@example.am',subject:'Synthetic report',text:'Report',attachments:[]};
for(const [name,send]of [['SMTP',sendSmtp],['Gmail SMTP',sendGmail]]){
 test(name+' routes each BCC recipient only through its authorized envelope and never passes a Bcc MIME field',async()=>{
  const attempts=[];const createTransport=()=>({sendMail:async mail=>{attempts.push(mail);return {accepted:mail.envelope.to,rejected:[],messageId:mail.messageId};},close(){}});
  for(const recipient of [...base.to,...base.cc,...base.bcc])assert.equal((await send({job:{id:job.id+'-'+recipient},message:{...base,envelopeTo:[recipient]},env,createTransport})).result,'accepted');
  assert.deepEqual(attempts.map(a=>a.envelope.to),[['main@example.am'],['visible@example.am'],['hidden1@example.am'],['hidden2@example.am']]);
  for(const mail of attempts){assert.deepEqual(mail.to,base.to);assert.deepEqual(mail.cc,base.cc);assert.equal(Object.hasOwn(mail,'bcc'),false);assert.equal(Object.hasOwn(mail,'headers'),false);}
 });
 test(name+' makes BCC dominate CC, keeps explicit primary To, deduplicates and supports BCC-only delivery',async()=>{
  let composed;const createTransport=()=>({sendMail:async mail=>{composed=mail;return {accepted:mail.envelope.to,rejected:[],messageId:mail.messageId};},close(){}});
  const message={...base,cc:['visible@example.am','HIDDEN1@example.am','main@example.am'],bcc:['hidden1@example.am','HIDDEN1@example.am','main@example.am']};
  assert.equal((await send({job,message,env,createTransport})).result,'accepted');assert.deepEqual(composed.to,['main@example.am']);assert.deepEqual(composed.cc,['visible@example.am']);assert.deepEqual(composed.envelope.to,['main@example.am','visible@example.am','hidden1@example.am']);assert.equal(Object.hasOwn(composed,'bcc'),false);
  assert.equal((await send({job,message:{...base,to:[],cc:[],bcc:['hidden1@example.am'],envelopeTo:['hidden1@example.am']},env,createTransport})).result,'accepted');assert.deepEqual(composed.to,[]);assert.deepEqual(composed.cc,[]);assert.deepEqual(composed.envelope.to,['hidden1@example.am']);
 });
 test(name+' validates hidden destinations, header safety, exact envelope and total recipient bound before connecting',async()=>{
  const createTransport=()=>{throw Error('Must not connect');};
  for(const bcc of ['hidden@example.am',['bad-address'],['hidden@example.am\r\nCc:exposed@example.am'],Array.from({length:50},(_,i)=>'hidden'+i+'@example.am')])await assert.rejects(send({job,message:{...base,bcc,envelopeTo:['main@example.am']},env,createTransport}));
  await assert.rejects(send({job,message:{...base,envelopeTo:['outsider@example.am']},env,createTransport}));
  await assert.rejects(send({job,message:{...base,envelopeTo:['hidden1@example.am']},env:n=>n==='ZZWS_ENVIRONMENT'?'staging':n==='ZZWS_REPORT_TEST_RECIPIENTS'?'main@example.am':env(n),createTransport}));
 });
 test(name+' continues an independent hidden copy after primary DATA ambiguity without retrying that primary',async()=>{
  const attempts=[];const createTransport=()=>({sendMail:async mail=>{const target=mail.envelope.to[0];attempts.push(target);if(target==='main@example.am')throw Object.assign(Error('Synthetic DATA timeout'),{command:'DATA',code:'ETIMEDOUT',accepted:['main@example.am']});return {accepted:[target],rejected:[],messageId:mail.messageId};},close(){}});
  assert.equal((await send({job,message:{...base,envelopeTo:['main@example.am']},env,createTransport})).result,'unknown');
  assert.equal((await send({job:{id:job.id+'-hidden'},message:{...base,envelopeTo:['hidden1@example.am']},env,createTransport})).result,'accepted');assert.deepEqual(attempts,['main@example.am','hidden1@example.am']);
 });
}
