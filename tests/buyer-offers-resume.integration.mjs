import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntime} from './support/runtime.mjs';

test('buyer resume reads owned current state without finalizing or transferring, and safe revisions keep private setup on the server',{timeout:120000},async()=>{
 const r=await createRuntime({memory:true});
 const route=action=>'dealer/buyer-offers/'+action;
 const call=async(path,token,data={})=>{
  const response=await r.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:'POST',headers:{origin:'http://127.0.0.1:8080','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}));
  return {status:response.status,data:await response.json()};
 };
 const ok=async(...args)=>{const result=await call(...args);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;};
 const login=async name=>(await ok('login',null,{login:'zzws-test-'+name,password:'24681012'})).sessionToken;
 const businessState=async()=>({offers:(await r.db.query('select * from zzws_buyer_offers order by id')).rows,memory:(await r.db.query('select * from zzws_user_memory order by user_id')).rows,sequence:(await r.db.query('select last_value,is_called from zzws_buyer_offer_number_seq')).rows,orders:(await r.db.query('select count(*)::int n from zzws_orders')).rows});
 const safe=result=>assert.doesNotMatch(JSON.stringify(result),/markup|wholesale|unitCost|internal_lines|expectedProfit|price_category|priceCategory|base_cart|minimum|floor|finalize_request|request_lines/);
 const setup={buyerName:'Synthetic refresh buyer',buyerPhone:'091123456',markupPercent:15,priceCategory:'KP',source:'cart'};
 try{
  const owner=await login('owner'),manager=await login('manager'),viewer=await login('viewer'),dealer=await login('dealer');
  await ok('me/state',owner,{section:'cart',version:0,value:{'900001':{articul:'900001',qty:2,addedPrice:80000,addedPriceMode:'KP'}}});
  const started=await ok(route('start'),owner,setup);
  assert.equal((await call(route('resume'),null,{id:started.id})).status,401);
  assert.equal((await call(route('resume'),viewer,{id:started.id})).status,403);
  for(const actor of [manager,dealer]){
   assert.equal((await call(route('resume'),actor,{id:started.id})).status,404);
   assert.equal((await call(route('start'),actor,{fromOfferId:started.id})).status,404);
  }
  for(const id of ['',null,'not-an-id',crypto.randomUUID()])assert.equal((await call(route('resume'),owner,{id})).status,404);
  const initial=await businessState(),browse=await ok(route('resume'),owner,{id:started.id,lines:[{articul:'900001',qty:9999,salePrice:1}],requestId:crypto.randomUUID(),finalize:true,handoff:true});
  assert.equal(browse.phase,'browse');assert.equal(browse.id,started.id);assert.equal(browse.source,'cart');assert.equal(browse.transferred,false);assert.deepEqual(browse.buyer,started.buyer);assert.ok(browse.products.length>0);safe(browse);
  assert.deepEqual(await ok(route('resume'),owner,{id:started.id}),browse);assert.deepEqual(await businessState(),initial,'Draft resume does not create an offer, allocate a number, finalize, transfer, or change cart memory');

  const revision=await ok(route('start'),owner,{fromOfferId:started.id,buyerName:'Untrusted override',buyerPhone:'+37499999999',markupPercent:0,priceCategory:'Dealers',source:'catalog'});safe(revision);assert.notEqual(revision.id,started.id);assert.deepEqual(revision.buyer,started.buyer);
  const privateCopy=(await r.db.query('select buyer_name,buyer_phone,markup_percent,price_category,source,base_cart,offer_number from zzws_buyer_offers where id=$1',[revision.id])).rows[0];
  assert.equal(privateCopy.buyer_name,setup.buyerName);assert.equal(privateCopy.buyer_phone,'+37491123456');assert.equal(Number(privateCopy.markup_percent),15);assert.equal(privateCopy.price_category,'KP');assert.equal(privateCopy.source,'cart');assert.deepEqual(privateCopy.base_cart,{'900001':{qty:2}});assert.equal(privateCopy.offer_number,null);
  assert.equal((await call(route('quote'),owner,{id:revision.id,lines:[{articul:'900001',qty:1,salePrice:91999}]})).status,409,'Revision cannot replace the saved minimum markup with a client override');
  await ok(route('quote'),owner,{id:revision.id,lines:[{articul:'900001',qty:1,salePrice:92000}]});

  const lines=[{articul:'900001',qty:3,salePrice:115000}],requestId=crypto.randomUUID(),offer=await ok(route('finalize'),owner,{id:started.id,requestId,lines});
  const finalizedState=await businessState(),final=await ok(route('resume'),owner,{id:started.id});assert.equal(final.phase,'final');assert.equal(final.transferred,false);assert.deepEqual(final.offer,offer);safe(final);assert.deepEqual(await businessState(),finalizedState,'A lost finalize response can be recovered by reading the same stored offer without allocating another number');
  const finalRevision=await ok(route('start'),owner,{fromOfferId:started.id});assert.notEqual(finalRevision.id,started.id);assert.deepEqual(finalRevision.buyer,started.buyer);safe(finalRevision);

  await r.db.exec('reset role');
  const products=(await r.db.query('select products from zzws_versions where id=(select version from zzws_state where id=true)')).rows[0].products;
  await r.db.query('update zzws_versions set products=$1 where id=(select version from zzws_state where id=true)',[JSON.stringify(products.filter(product=>product.articul!=='900001'))]);
  await r.db.exec('set role service_role');
  const changed=await ok(route('resume'),owner,{id:revision.id});assert.ok(!changed.products.some(product=>product.articul==='900001'),'Draft resume reevaluates current catalogue availability');assert.deepEqual((await ok(route('resume'),owner,{id:started.id})).offer,offer,'Historical final snapshots keep their original public items and prices when current catalogue changes');
  const transferred=await ok(route('handoff'),owner,{id:started.id,requestId:crypto.randomUUID()});assert.equal(transferred.cart['900001'].qty,3);
  const handedState=await businessState(),handed=await ok(route('resume'),owner,{id:started.id});assert.equal(handed.phase,'final');assert.equal(handed.transferred,true);assert.deepEqual(handed.offer,offer);safe(handed);await ok(route('resume'),owner,{id:started.id,requestId:crypto.randomUUID()});assert.deepEqual(await businessState(),handedState,'Recovering after a lost handoff response never repeats transfer or exposes calculated profit');
  assert.equal((await call(route('start'),owner,{fromOfferId:started.id})).status,409,'A transferred offer cannot be revised into another transfer');

  for(const id of [revision.id,started.id]){
   await r.db.query("update zzws_buyer_offers set expires_at=clock_timestamp()-interval '1 second' where id=$1",[id]);
   assert.equal((await call(route('resume'),owner,{id})).status,409);
   assert.equal((await call(route('start'),owner,{fromOfferId:id})).status,409);
  }
  const ownerId=r.seededUsers.find(user=>user.name==='owner').id;
  await r.db.exec('reset role');await r.db.query("update zzws_admin_scopes set scope='viewer' where user_id=$1",[ownerId]);await r.db.exec('set role service_role');
  assert.equal((await call(route('resume'),owner,{id:finalRevision.id})).status,403,'Current admin scope is reevaluated before returning even a previously owned proposal');
  assert.equal((await call(route('start'),owner,{fromOfferId:finalRevision.id})).status,403);

  const dealerSetup={...setup,source:'catalog',priceCategory:'Dealers'},clientDraft=await ok(route('start'),dealer,dealerSetup);
  const dealerId=r.seededUsers.find(user=>user.name==='dealer').id,employeeId=crypto.randomUUID();
  await r.db.exec('reset role');
  await r.db.query("insert into auth.users(id,email,password_hash,password_salt) select $1,'zzws-test-buyer-refresh-employee@users.zzws.invalid',password_hash,password_salt from auth.users where id=$2",[employeeId,dealerId]);
  await r.db.query("insert into zzws_users(id,login,profile,active,needs_password_setup,needs_profile_setup,customer_id) select $1,'zzws-test-buyer-refresh-employee',profile,true,false,false,id from zzws_users where id=$2",[employeeId,dealerId]);await r.db.exec('set role service_role');
  const employee=await login('buyer-refresh-employee'),employeeDraft=await ok(route('start'),employee,dealerSetup);
  assert.equal((await ok(route('resume'),employee,{id:employeeDraft.id})).phase,'browse');
  await r.db.exec('reset role');await r.db.query("update zzws_users set profile=jsonb_set(profile,'{sheet}','\"KP\"') where id=$1",[dealerId]);await r.db.exec('set role service_role');
  assert.equal((await call(route('resume'),dealer,{id:clientDraft.id})).status,400,'A client cannot resume a draft under its former category after saved category changes');
  assert.equal((await call(route('start'),dealer,{fromOfferId:clientDraft.id})).status,400);
  assert.equal((await call(route('resume'),employee,{id:employeeDraft.id})).status,400,'Employees inherit current parent category restrictions');
  await r.db.exec('reset role');await r.db.query('update zzws_users set active=false where id=$1',[dealerId]);await r.db.exec('set role service_role');
  assert.equal((await call(route('resume'),employee,{id:employeeDraft.id})).status,401,'Disabled parent customer cannot regain employee access through resume');
  assert.equal((await call(route('start'),employee,{fromOfferId:employeeDraft.id})).status,401);
  assert.equal((await r.db.query('select count(*)::int n from zzws_orders')).rows[0].n,0);assert.equal(r.telegramMessages.length,0);assert.equal(r.pushMessages.length,0);assert.equal(r.reportEmails.length,0);
 }finally{await r.close();}
});
