import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';import X from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {reportRecipientPlan} from '../supabase/functions/zzws-api/report-recipients.mjs';

test('empty optional default-copy slots are absent recipients, while nonempty malformed destinations remain visible',()=>{
 const plan=automatic=>reportRecipientPlan({author:'main@example.am',automatic,additional:'',replyTo:'owner@example.am'});
 assert.deepEqual(plan(['','','copy@example.am']).deliveries.map(r=>[r.address,r.state]),[['main@example.am','pending'],['copy@example.am','pending']]);
 assert.deepEqual(plan(['','','']).deliveries.map(r=>r.address),['main@example.am']);
 const mixed=plan(['','malformed-copy','copy@example.am']);assert.equal(mixed.deliveries.length,3);assert.equal(mixed.deliveries.find(r=>r.address==='malformed-copy').state,'invalid');assert.deepEqual(mixed.cc,[]);assert.deepEqual(mixed.bcc,['copy@example.am']);
});

test('actual API/SQL sends one configured copy with two empty slots, permits zero copies, and isolates malformed nonempty copies',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true,debug:true});
 const call=async(path,token,data)=>{const multipart=data instanceof FormData,res=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:data===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined||multipart?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:multipart?data:JSON.stringify(data)})}));return {status:res.status,data:await res.json()};};
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,args[0]+': '+JSON.stringify(result));return result.data;};
 try{
  const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
  const owner=await login('owner'),client=await login('dealer'),admin=await ok('me',owner),me=await ok('me',client),p=(await ok('catalog',client)).products.find(p=>p.articul==='test-002');
  await r.db.query("update zzws_users set profile=profile||'{\"replyToEmail\":\"owner@example.am\"}'::jsonb where id=$1",[admin.id]);
  await r.db.query('update zzws_users set person=$2 where id=$1',[me.id,JSON.stringify({firstName:'Test',lastName:'Buyer',email:'main@example.am'})]);await r.db.exec("update zzws_receipt_settings set mode='off'");
  for(const [cc,expectedAddresses,invalidCount,completed]of [[['','','copy@example.am'],['main@example.am','copy@example.am'],0,true],[['','',''],['main@example.am'],0,true],[['','malformed-copy','copy@example.am'],['main@example.am','copy@example.am'],1,false]]){
   await r.db.query('update zzws_report_email_settings set cc=$1',[JSON.stringify(cc)]);
   const order=await ok('orders',client,{requestId:crypto.randomUUID(),profileRevision:me.profileRevision,deliveryVariantId:me.rowsList[0].id,delivery:{...me.rowsList[0],method:'Առաքում'},lines:[{articul:p.articul,qty:1,unitPrice:p.wholesale}]});
   const book=X.utils.book_new();X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([['articul','qty','unitprice'],...order.lines.map(l=>[l.articul,l.qty,l.unitPrice])]),'Report');const bytes=X.write(book,{type:'buffer',bookType:'xlsx'});
   const form=()=>{const f=new FormData();f.append('files',new File([bytes],'վաճառքի_հաշվետվություն.xlsx'));for(const [key,value]of Object.entries({orderId:order.id,revision:order.revision,reportIndex:'0',confirmCustomer:'true',requestId:crypto.randomUUID(),includeDefaults:'true',additionalCC:'',selectedRows:'[]'}))f.set(key,String(value));return f;};
   const preview=await ok('admin/orders/report-preview',owner,form()),request=form();request.set('proof',preview.proof);request.set('expiry',String(preview.expiry));const before=r.reportEmails.length;
   const result=await ok('admin/orders/report-send',owner,request);assert.equal(result.completed===true,completed);assert.equal(result.delivery.failedCount,invalidCount);assert.equal(result.delivery.acceptedCount,expectedAddresses.length);
   assert.deepEqual(r.reportEmails.slice(before).flatMap(m=>m.envelopeTo).sort(),[...expectedAddresses].sort());assert.ok(result.delivery.recipients.every(r=>r.address!==''));assert.equal((await ok('admin/orders/detail',owner,{id:order.id})).status,completed?'in_progress':'new');
  }
 }finally{await r.close();}
});
