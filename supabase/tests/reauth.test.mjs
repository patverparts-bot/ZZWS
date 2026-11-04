import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function client(fetch,requireReauthentication){
 const context={window:{ZZWS_CONFIG:{api:'https://test.invalid/',publishableKey:'public'},requireReauthentication},Headers,FormData,URL,sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},fetch};
 vm.runInNewContext(fs.readFileSync('js/api-client.js','utf8'),context);
 return context.window.ZZWS;
}

test('sensitive action waits for confirmation and retries exactly once',{timeout:5000},async()=>{
 let calls=0,confirmations=0,allowConfirmation,confirmationStarted;
 const waiting=new Promise(resolve=>{allowConfirmation=resolve;}),started=new Promise(resolve=>{confirmationStarted=resolve;}),requests=[];
 const api=client(async(url,options)=>{
  calls++;requests.push({url:String(url),method:options.method,body:options.body});
  return Response.json(calls===1?{reauthRequired:true}:{ok:true},{status:calls===1?428:200});
 },async()=>{confirmations++;confirmationStarted();await waiting;});
 const pending=api.json('admin/users',{method:'POST',body:'{}'});
 try{
  await Promise.race([started,pending.then(()=>{throw Error('Mutation completed before confirmation');})]);
  assert.equal(calls,1,'the mutation must not retry while confirmation is pending');
  assert.equal(confirmations,1);
 }finally{allowConfirmation();}
 assert.equal((await pending).ok,true);
 assert.equal(calls,2);
 assert.equal(confirmations,1);
 assert.deepEqual(requests,[{url:'https://test.invalid/admin/users',method:'POST',body:'{}'},{url:'https://test.invalid/admin/users',method:'POST',body:'{}'}]);
});

test('cancelling confirmation prevents retrying the mutation',async()=>{
 let calls=0,confirmations=0;
 const api=client(async()=>{calls++;return Response.json({reauthRequired:true},{status:428});},async()=>{confirmations++;throw Error('cancel');});
 await assert.rejects(()=>api.json('admin/users',{method:'POST',body:'{}'}),/cancel/);
 assert.equal(calls,1);
 assert.equal(confirmations,1);
});

test('a repeated reauthentication challenge does not cause another retry',async()=>{
 let calls=0,confirmations=0;
 const api=client(async()=>{calls++;return Response.json({reauthRequired:true,error:'confirmation still required'},{status:428});},async()=>{confirmations++;});
 await assert.rejects(()=>api.json('admin/users',{method:'POST',body:'{}'}),error=>error.status===428&&error.data.reauthRequired===true);
 assert.equal(calls,2);
 assert.equal(confirmations,1);
});
