import test from 'node:test';import assert from 'node:assert/strict';
import {sendReportMail} from '../supabase/functions/zzws-api/report-routes.mjs';

test('Resend never exposes a hidden envelope recipient in To or sends the visible primary again',async()=>{
 const env=name=>({ZZWS_REPORT_EMAIL_MODE:'resend',RESEND_API_KEY:'synthetic-test-key'})[name],sent=[];
 const message={from:'sender@example.am',to:['main@example.am'],cc:['copy@example.am'],bcc:['hidden@example.am'],subject:'Report',text:'Test',attachments:[]};
 const fetchImpl=async(url,options)=>{sent.push({body:JSON.parse(options.body),headers:options.headers});return {ok:true,json:async()=>({id:'accepted-test'})};};
 const hidden=await sendReportMail({job:{id:'job-r2'},message:{...message,envelopeTo:['hidden@example.am']},env,fetchImpl});assert.equal(hidden.result,'rejected');assert.equal(hidden.reason,'bcc_transport_unsupported');assert.equal(sent.length,0);
 await sendReportMail({job:{id:'job-r1'},message:{...message,envelopeTo:['copy@example.am']},env,fetchImpl});assert.deepEqual(sent[0].body.to,['copy@example.am']);assert.deepEqual(sent[0].body.cc,[]);assert.equal(sent[0].body.bcc,undefined);assert.equal(sent[0].body.envelopeTo,undefined);assert.ok(!JSON.stringify(sent[0]).includes('hidden@example.am'));assert.equal(sent[0].headers['Idempotency-Key'],'zzws-report/job-r1');
});
