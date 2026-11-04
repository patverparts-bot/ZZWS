import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';
import X from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {reportRecipientPlan} from '../supabase/functions/zzws-api/report-recipients.mjs';

test('recipient bound and invalid header isolation are exact',()=>{
 const plan=count=>reportRecipientPlan({author:'main@example.am',automatic:['','',''],includeDefaults:false,additional:Array.from({length:count},(_,i)=>'copy'+i+'@example.am').join(','),replyTo:'owner@example.am'});
 assert.equal(plan(49).deliveries.length,50);assert.throws(()=>plan(50));
 const malicious=reportRecipientPlan({author:'bad@example.am\r\nBcc: injected@example.am',automatic:['','',''],includeDefaults:false,additional:'copy@example.am',replyTo:'owner@example.am'});
 assert.deepEqual(malicious.to,[]);assert.deepEqual(malicious.cc,['copy@example.am']);assert.equal(malicious.deliveries[0].state,'invalid');assert.ok(malicious.deliveries.every(r=>!/[\r\n]/.test(r.address)));
});

test('recipient ledger guards proofs, files, actor, leases, retries, concurrency and closed revisions',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const multipart=data instanceof FormData,response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined||multipart?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:multipart?data:JSON.stringify(data)})}));return {status:response.status,data:await response.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result));return result.data;};
 try{
  const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
  const owner=await login('owner'),manager=await login('manager'),client=await login('dealer');
  const admin=await ok('me',owner),other=await ok('me',manager),me=await ok('me',client),product=(await ok('catalog',client)).products.find(p=>p.articul==='900002');
  assert.ok(product&&Number.isFinite(product.wholesale)&&product.wholesale>0,'The isolated dealer catalogue must contain the seeded 900002 product with a valid price');
  await r.db.query("update zzws_users set profile=profile||'{\"replyToEmail\":\"owner@example.am\"}'::jsonb where id=$1",[admin.id]);await r.db.exec("update zzws_receipt_settings set mode='off'");
  await r.db.query('update zzws_users set person=$2 where id=$1',[me.id,JSON.stringify({firstName:'Test',lastName:'Buyer',phone:'+37499123456',email:'main@example.am'})]);
  const create=()=>ok('orders',client,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{...me.rowsList[0],method:'Առաքում'},lines:[{articul:product.articul,qty:1,unitPrice:product.wholesale}]});
  const prepare=async order=>{
   const book=X.utils.book_new();X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([['articul','qty','unitprice'],...order.lines.map(l=>[l.articul,l.qty,l.unitPrice])]),'Report');
   const bytes=X.write(book,{type:'buffer',bookType:'xlsx'}),requestId=crypto.randomUUID();let proof;
   const form=(patch={})=>{const f=new FormData();f.append('files',new File([bytes],patch.filename||'վաճառքի_հաշվետվություն.xlsx'));for(const [key,value]of Object.entries({orderId:order.id,revision:order.revision,reportIndex:'0',confirmCustomer:'true',requestId,includeDefaults:'false',additionalCC:'copy@example.am',selectedRows:'[]',...(proof?{proof:proof.proof,expiry:proof.expiry}:{}),...patch}))if(key!=='filename')f.set(key,String(value));return f;};
   proof=await ok('admin/orders/report-preview',owner,form());return {form,requestId};
  };

  const order=await create(),prepared=await prepare(order),sendCount=()=>r.reportEmails.length;
  for(const patch of [{proof:'AAAA'},{filename:'վաճառքի_հաշվետվություն-changed.xlsx'},{expiry:Date.now()+24*3600000},{confirmCustomer:'false'},{additionalCC:Array.from({length:50},(_,i)=>'too'+i+'@example.am').join(',')}])assert.equal((await call('admin/orders/report-send',owner,prepared.form(patch))).status,400,JSON.stringify(patch));
  assert.equal(sendCount(),0);assert.equal((await r.db.query('select count(*) n from zzws_report_deliveries')).rows[0].n,0);

  const originalSend=r.reportEmailSend;let attempted=[];
  r.reportEmailSend=async(job,message)=>{attempted.push(message.envelopeTo[0]);return message.envelopeTo[0]==='main@example.am'?{result:'rejected'}:originalSend(job,message);};
  const result=await ok('admin/orders/report-send',owner,prepared.form());assert.equal(result.delivery.acceptedCount,1);assert.equal(result.delivery.retryCount,1);
  assert.equal((await call('admin/orders/report-send',owner,prepared.form({additionalCC:'unreviewed@example.am'}))).status,409,'A changed recipient fingerprint cannot reuse the existing delivery');assert.equal(attempted.length,2);
  const job=(await r.db.query('select * from zzws_report_deliveries where id=$1',[result.jobId])).rows[0];
  assert.equal((await call('admin/orders/report-status',manager,{orderId:order.id,jobId:job.id})).status,403);
  const claim=(await r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6) j',[admin.id,order.id,order.revision,job.request_id,job.fingerprint,job.counts])).rows[0].j;
  const rejectCode=code=>error=>error.code===code;
  await assert.rejects(r.db.query('select zzws_report_result($1,$2,$3,$4,$5)',[admin.id,job.id,claim.lease,'accepted','old-batch-result']),rejectCode('PT409'),'Legacy result RPC cannot turn a partial recipient ledger into accepted');
  await assert.rejects(r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4)',[other.id,job.id,claim.lease,'r0']),rejectCode('PT403'));
  await assert.rejects(r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4)',[admin.id,job.id,crypto.randomUUID(),'r0']),rejectCode('PT409'));
  await assert.rejects(r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4)',[admin.id,job.id,claim.lease,'unselected-address']),rejectCode('PT400'));
  assert.equal((await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4) j',[admin.id,job.id,claim.lease,'r1'])).rows[0].j.send,false,'Accepted recipient cannot be claimed again');
  const recipient=(await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4) j',[admin.id,job.id,claim.lease,'r0'])).rows[0].j.recipient;
  await assert.rejects(r.db.query('select zzws_report_recipient_result($1,$2,$3,$4,$5,$6,$7)',[admin.id,job.id,claim.lease,'r0',crypto.randomUUID(),'accepted','wrong-lease']),rejectCode('PT409'));
  await r.db.query('select zzws_report_recipient_result($1,$2,$3,$4,$5,$6,$7)',[admin.id,job.id,claim.lease,'r0',recipient.lease,'rejected',null]);
  assert.equal((await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4) j',[admin.id,job.id,claim.lease,'r0'])).rows[0].j.send,false,'Known failure is bounded to two actual attempts');
  await r.db.query('select zzws_report_recipient_finish($1,$2,$3)',[admin.id,job.id,claim.lease]);
  const closed=await ok('admin/orders/status',owner,{id:order.id,revision:order.revision,status:'rejected'});
  assert.ok(closed.revision>order.revision);assert.equal((await call('admin/orders/report-send',owner,prepared.form({retryRejected:'true'}))).status,409);assert.equal(attempted.length,2);

  const expiryOrder=await create(),entry={id:'r0',address:'main@example.am',role:'to',state:'pending',attempts:0},rawCounts={deliverySchema:1,deliveries:[entry,{...entry,id:'r1',address:'copy@example.am',role:'cc'}]},fingerprint='a'.repeat(64),request=crypto.randomUUID();
  for(const missing of ['role','state','attempts']){const counts=structuredClone(rawCounts);delete counts.deliveries[0][missing];await assert.rejects(r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6)',[admin.id,expiryOrder.id,expiryOrder.revision,request,fingerprint,counts]),rejectCode('PT400'));}
  const duplicated=structuredClone(rawCounts);duplicated.deliveries[1].address='MAIN@example.am';await assert.rejects(r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6)',[admin.id,expiryOrder.id,expiryOrder.revision,request,fingerprint,duplicated]),rejectCode('PT400'));
  const expiring=(await r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6) j',[admin.id,expiryOrder.id,expiryOrder.revision,request,fingerprint,rawCounts])).rows[0].j;
  await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4)',[admin.id,expiring.id,expiring.lease,'r0']);
  await r.db.query("update zzws_report_deliveries set lease_until=now()-interval '1 second' where id=$1",[expiring.id]);
  const expired=(await r.db.query('select zzws_report_recipient_status($1,$2) j',[admin.id,expiring.id])).rows[0].j;
  assert.deepEqual(expired.counts.deliveries.map(d=>[d.state,d.attempts]),[['uncertain',1],['pending',0]]);
  const resumed=(await r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6) j',[admin.id,expiryOrder.id,expiryOrder.revision,request,fingerprint,rawCounts])).rows[0].j;
  assert.equal((await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4) j',[admin.id,resumed.id,resumed.lease,'r0'])).rows[0].j.send,false,'Unknown in-flight target stays quarantined');
  assert.equal((await r.db.query('select zzws_report_recipient_claim($1,$2,$3,$4) j',[admin.id,resumed.id,resumed.lease,'r1'])).rows[0].j.recipient.attempts,1,'Untouched copy resumes as its first attempt');

  const concurrent=await create(),concurrentFiles=await prepare(concurrent);let entered,release;
  const started=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);attempted=[];
  r.reportEmailSend=async(job,message)=>{attempted.push(message.envelopeTo[0]);if(message.envelopeTo[0]==='main@example.am'){entered();await held;}return originalSend(job,message);};
  const first=ok('admin/orders/report-send',owner,concurrentFiles.form());await started;
  const second=await ok('admin/orders/report-send',owner,concurrentFiles.form());assert.equal(second.busy,true);assert.equal(attempted.filter(a=>a==='main@example.am').length,1);
  release();assert.equal((await first).completed,true);assert.equal(attempted.length,2);assert.equal(new Set(attempted).size,2);

  // The result transaction committed, but its acknowledgement was lost. Reconcile
  // its accepted row without sending either already accepted recipient again.
  const acknowledged=await create(),acknowledgedFiles=await prepare(acknowledged);attempted=[];
  r.reportEmailSend=async(job,message)=>{attempted.push(message.envelopeTo[0]);return originalSend(job,message);};
  const realQuery=r.db.query.bind(r.db);let loseResult=true;
  r.db.query=async(sql,args)=>{const value=await realQuery(sql,args);if(loseResult&&String(sql).includes('public."zzws_report_recipient_result"')&&args?.[3]==='r0'){loseResult=false;throw Object.assign(Error('Committed result acknowledgement lost'),{code:'08006'});}return value;};
  const ackLost=await ok('admin/orders/report-send',owner,acknowledgedFiles.form());r.db.query=realQuery;
  assert.equal(ackLost.busy,true);assert.equal(ackLost.delivery.acceptedCount,2);assert.equal(attempted.length,2);
  await r.db.query("update zzws_report_deliveries set lease_until=now()-interval '1 second' where id=$1",[ackLost.jobId]);
  const reconciled=await ok('admin/orders/report-status',owner,{orderId:acknowledged.id,jobId:ackLost.jobId});assert.equal(reconciled.statusPending,true);assert.equal(reconciled.delivery.acceptedCount,2);assert.equal(reconciled.delivery.uncertainCount,0);
  const wrongCompletion=acknowledgedFiles.form({filename:'վաճառքի_հաշվետվություն-other.xlsx'});wrongCompletion.set('jobId',ackLost.jobId);assert.equal((await call('admin/orders/report-complete',owner,wrongCompletion)).status,409,'Completion requires the exact accepted attachment bundle');assert.equal(attempted.length,2);
  const completion=acknowledgedFiles.form();completion.set('jobId',ackLost.jobId);assert.equal((await ok('admin/orders/report-complete',owner,completion)).completed,true);assert.equal(attempted.length,2,'Reconciliation/completion cannot resend a committed accepted recipient');

  // Legacy SMTP jobs retain whole-envelope uncertainty when the new migration is
  // installed. They never become individually retryable without known outcomes.
  const legacyOrder=await create(),legacyRequest=crypto.randomUUID(),legacyFingerprint='b'.repeat(64),legacyCounts={transport:'smtp',bundleHash:'legacy',reportIndex:0};
  const legacy=(await r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6) j',[admin.id,legacyOrder.id,legacyOrder.revision,legacyRequest,legacyFingerprint,legacyCounts])).rows[0].j;
  const unknownLegacy=(await r.db.query('select zzws_report_result($1,$2,$3,$4,$5) j',[admin.id,legacy.id,legacy.lease,'unknown',null])).rows[0].j;assert.equal(unknownLegacy.state,'uncertain');
  const legacyAgain=(await r.db.query('select zzws_report_claim($1,$2,$3,$4,$5,$6) j',[admin.id,legacyOrder.id,legacyOrder.revision,legacyRequest,legacyFingerprint,legacyCounts])).rows[0].j;
  assert.equal(legacyAgain.state,'uncertain');assert.deepEqual(legacyAgain.counts,legacyCounts);assert.equal(legacyAgain.lease,null);assert.equal((await ok('admin/orders/report-status',owner,{orderId:legacyOrder.id,jobId:legacy.id})).state,'uncertain');assert.equal(attempted.length,2);
 }finally{await r.close();}
});
