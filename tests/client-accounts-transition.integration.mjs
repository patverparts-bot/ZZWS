import test from 'node:test';import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';import {hashPassword} from './support/supabase-client.mjs';
test('existing clients retain IDs, credentials, baskets and historical orders through the forward migration',{timeout:120000},async()=>{
 const id=crypto.randomUUID(),named=crypto.randomUUID(),variant=crypto.randomUUID(),version=crypto.randomUUID(),order=crypto.randomUUID(),credentials=hashPassword('13579024');
 const runtime=await createRuntime({memory:true,debug:true,beforeSchemaFile:async(file,db)=>{
  if(!file.endsWith('_client_accounts.sql'))return;
  for(const [uid,login]of [[id,'001234'],[named,'old.manager']]){await db.query('insert into auth.users(id,email,password_hash,password_salt) values($1,$2,$3,$4)',[uid,login+'@users.zzws.invalid',credentials.hash,credentials.salt]);await db.query('insert into zzws_users(id,login,active,needs_password_setup,profile) values($1,$2,true,false,$3)',[uid,login,JSON.stringify({role:'client',client:'Legacy '+login,sheet:'Dealers',allBrands:true,rowsList:[{id:variant,organization:'Legacy shop',address:'Old address',contact:'Old contact'}]})]);}
  await db.query('insert into zzws_user_memory(user_id,data,versions) values($1,$2,$3)',[id,JSON.stringify({cart:{A:{articul:'A',qty:3}},favorites:['A'],history:[{title:'Old cart'}]}),JSON.stringify({cart:4,favorites:2,history:1})]);
  await db.query('insert into zzws_versions(id,products,actor) values($1,$2,$3)',[version,'[]',id]);const state=(await db.query('select rules_revision from zzws_state where id')).rows[0];
  const lines=[{articul:'A',name:'Historical product',qty:3,unitPrice:10}];
  await db.exec('begin');await db.query('insert into zzws_orders(id,user_id,request_id,customer,delivery,delivery_variant_id,lines,original_lines,total) values($1,$2,$3,$4,$5,$6,$7,$7,30)',[order,id,crypto.randomUUID(),JSON.stringify({id,login:'001234',client:'Legacy 001234'}),JSON.stringify({organization:'Legacy shop',address:'Old address',contact:'Old contact',profileRevision:1}),variant,JSON.stringify(lines)]);
  await db.query('insert into zzws_order_calculation_contexts(order_id,order_revision,schema_version,catalog_version,rules_revision,client_category,profile_revision,ordered_lines,total,context) values($1,1,1,$2,$3,$4,1,$5,30,$6)',[order,version,state.rules_revision,'Dealers',JSON.stringify(lines),'{}']);await db.exec('commit');
 }});
 const call=async(p,t,data)=>{const r=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+p,{method:data===undefined?'GET':'POST',headers:{...(t?{authorization:'Bearer '+t}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));const value=await r.json();assert.equal(r.status,200,p+': '+JSON.stringify(value));return value;};
 try{
  const session=await call('login',null,{login:'001234',password:'13579024'});assert.equal(session.id,id);assert.equal(session.needsProfileSetup,true);assert.equal(session.customerCode,'001234');
  const old=(await runtime.db.query('select * from zzws_orders where id=$1',[order])).rows[0];assert.equal(old.user_id,id);assert.equal(old.customer_id,id);assert.equal(old.customer.customerCode,'001234');assert.equal(old.customer.author,undefined);assert.equal(old.delivery.address,'Old address');assert.equal(old.lines[0].qty,3);
  const text=await call('login',null,{login:'old.manager',password:'13579024'});assert.equal(text.id,named);assert.equal(text.customerCode,'');
  await call('account/profile',session.sessionToken,{firstName:'Old',lastName:'Manager',phone:'+37499123456',email:'old@example.am'});const me=await call('me',session.sessionToken);assert.equal(me.login,'001234');assert.equal(me.needsProfileSetup,false);const memory=await call('me/state',session.sessionToken);assert.equal(memory.data.cart.A.qty,3);assert.deepEqual(memory.data.favorites,['A']);assert.equal(memory.versions.cart,4);
 }finally{await runtime.close();}
});
