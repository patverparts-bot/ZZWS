import test from 'node:test';
import assert from 'node:assert/strict';
import {proposalRoutes} from '../supabase/functions/zzws-api/proposals.mjs';

test('proposal creation denies clients, employees, unknown roles and missing identity before reading input or catalog/storage',async()=>{
 const forbidden=name=>()=>{throw Error('Unexpected '+name+' call on denied proposal creation');};
 const users=[undefined,null,{role:'client'},{role:'client',clientRole:'employee',customerId:'company-id'},{role:'client',adminScope:'owner',permissions:['orders:write']},{role:'viewer'},{role:'admin '}];
 for(const user of users){
  const context={path:'catalog/proposals',req:new Request('https://example.invalid/catalog/proposals',{method:'POST',body:JSON.stringify({role:'admin',adminScope:'owner'})}),user,body:forbidden('body'),current:forbidden('current'),project:forbidden('project'),table:forbidden('table'),query:forbidden('query'),random:forbidden('random'),digest:forbidden('digest'),json:forbidden('json'),fail:(code,message)=>{throw Object.assign(Error(message),{code});}};
  await assert.rejects(proposalRoutes(context),error=>error.code===403,'denied identities must fail before parsing forged role fields or any storage access');
 }
});
