import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('ordinary invitation To-only message is accepted and remains idempotent in actual API runtime',async()=>{
 const runtime=await createRuntime({memory:true,debug:true});
 const call=async(path,token,value)=>{const response=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:value===undefined?'GET':'POST',headers:{apikey:'offline-public',...(token?{authorization:'Bearer '+token}:{}),...(value===undefined?{}:{'content-type':'application/json'})},...(value===undefined?{}:{body:JSON.stringify(value)})}));const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;};
 try{
  const owner=(await call('login',null,{login:'zzws-test-owner',password:'24681012'})).sessionToken;await call('account/reauth',owner,{password:'24681012'});
  const user=await call('admin/users',owner,{intent:'create',client:'Invitation test',customerCode:'880022',role:'client',sheet:'Dealers',allBrands:true,active:true,companyEmail:'shop@example.am',companyPhone:'+37410123456',rowsList:[{organization:'Invitation test',address:'Test address',contact:'Test contact'}]});
  const request={id:user.id,code:user.invitation.code,selectedRows:[0],language:'ru'};
  assert.equal((await call('admin/users/invitation-email/send',owner,request)).accepted,true);
  assert.equal(runtime.reportEmails.length,1);assert.deepEqual(runtime.reportEmails[0].to,['shop@example.am']);assert.deepEqual(runtime.reportEmails[0].envelopeTo,['shop@example.am']);assert.deepEqual(runtime.reportEmails[0].files,[]);assert.match(runtime.reportEmails[0].subject,/Приглашение/);
  assert.equal((await call('admin/users/invitation-email/send',owner,request)).duplicate,true);assert.equal(runtime.reportEmails.length,1);
 }finally{await runtime.close();}
});
