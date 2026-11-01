import test from 'node:test';import assert from 'node:assert/strict';
import {adminTemplateRoutes,templateCart,mergeTemplateLines} from '../functions/zzws-api/admin-templates.mjs';
import {replacementRoutes} from '../functions/zzws-api/replacements.mjs';
import {canAccess} from '../functions/zzws-api/operations.mjs';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',oid='33333333-3333-4333-8333-333333333333',tid='44444444-4444-4444-8444-444444444444';
const products=[{articul:'001',name:'Original',category:'Washer',brand:'B',wholesale:100},{articul:'002',name:'Replacement',category:'Washer',brand:'B',wholesale:110},{articul:'secret',name:'Hidden',category:'Washer',wholesale:1}];
function fixture(){
 const store={users:[{id:uid,login:'buyer',active:true,profile:{role:'client',client:'Buyer',sheet:'Dealers'}},{id:other,login:'other',active:true,profile:{role:'client',client:'Other'}}],orders:[{id:oid,user_id:uid,revision:2,status:'new',lines:[{articul:'001',name:'Original',category:'Washer',qty:2,unitPrice:100}]},{id:'history',user_id:uid,status:'completed',lines:[{articul:'002'}]},{id:'other-history',user_id:other,status:'completed',lines:[{articul:'secret'}]}],saved_carts:[{id:tid,user_id:uid,title:'Weekly',cart:{'002':{articul:'002',qty:3,addedPrice:90}},draft:{contactPersonInput:'Retain me'},saved_at:'2026-10-31T10:00:00.000Z'}]};
 const seen=[],audits=[];let race=false;
 const table=name=>{
  const filters=[];let operation='select',value,one=false;
  const q={is(k,v){filters.push(r=>(r[k]??null)===v);return q;},select(){return q;},eq(k,v){filters.push(r=>(k==='profile->>role'?r.profile.role:r[k])===v);return q;},neq(k,v){filters.push(r=>r[k]!==v);return q;},order(){return q;},limit(){return q;},maybeSingle(){one=true;return q;},update(v){operation='update';value=v;return q;},delete(){operation='delete';return q;},async then(resolve,reject){try{if(race&&operation!=='select'){race=false;store.saved_carts[0].saved_at='2026-10-31T11:00:00.000Z';}let rows=store[name].filter(r=>filters.every(f=>f(r)));if(operation==='update')rows.forEach(r=>Object.assign(r,value));if(operation==='delete')store[name]=store[name].filter(r=>!rows.includes(r));resolve(one?rows[0]||null:rows);}catch(e){reject(e);}}};return q;
 };
 const context={user:{id:'staff',role:'admin',adminScope:'manager'},query:async q=>await q,table,current:async()=>({id:'price-1',products,rules:{}}),project:(raw,user)=>{seen.push(user);return raw.filter(p=>p.articul!=='secret');},knowledge:{products:{}},fail:(code,message)=>{throw Object.assign(Error(message),{code});},json:x=>x,audit:async(...args)=>audits.push(args),service:{rpc:async(name,args)=>{seen.push(args);if(store.saved_carts.length>=10)return {limit:true};const row={id:'55555555-5555-4555-8555-555555555555',user_id:args.p_user,title:args.p_title,cart:args.p_cart,saved_at:'2026-10-31T12:00:00.000Z'};store.saved_carts.push(row);return row;}}};
 return {store,seen,audits,race:()=>race=true,call:async(path,p,scope='manager',method=p?'POST':'GET')=>adminTemplateRoutes({...context,path,req:{method,url:'https://example.test/'+path},user:{...context.user,adminScope:scope},body:async()=>p}),replace:async(p,scope='manager')=>replacementRoutes({...context,path:'admin/orders/replacements',req:{method:'POST'},user:{...context.user,adminScope:scope},body:async()=>p})};
}
test('template administration permits order staff and prevents write access for viewers and price operators',()=>{
 assert.equal(canAccess('manager','admin/templates','GET'),true);assert.equal(canAccess('manager','admin/templates/save','POST'),true);assert.equal(canAccess('viewer','admin/templates','GET'),true);assert.equal(canAccess('viewer','admin/templates/delete','POST'),false);assert.equal(canAccess('price','admin/templates','GET'),false);
});
test('admin replacement uses the order customer catalogue and history rather than the administrator or another customer',async()=>{
 const f=fixture(),r=await f.replace({orderId:oid,revision:2,articul:'001',inCart:[{articul:'001',qty:2}]});
 assert.equal(f.seen[0].id,uid);assert.deepEqual(r.candidates.map(p=>p.articul),['002']);assert.equal(r.candidates[0].previouslyOrdered,true);assert.equal(r.customer.id,uid);
});
test('admin replacements reject read-only staff, received orders, stale revisions and unavailable customer accounts',async()=>{
 const p={orderId:oid,revision:2,articul:'001',inCart:[{articul:'001',qty:2}]};
 for(const kind of ['viewer','received','stale','inactive']){const f=fixture();if(kind==='received')f.store.orders[0].received_at='today';if(kind==='inactive')f.store.users[0].active=false;await assert.rejects(()=>f.replace({...p,revision:kind==='stale'?1:2},kind==='viewer'?'viewer':'manager'),e=>e.code===(kind==='viewer'?403:409));}
});
test('discontinued ordered models can be replaced using their saved category, while arbitrary hidden SKUs are denied',async()=>{
 const f=fixture();f.store.orders[0].lines[0]={articul:'discontinued',name:'Old',category:'Washer'};
 const r=await f.replace({orderId:oid,revision:2,articul:'discontinued',inCart:[{articul:'discontinued',qty:1}]});assert.equal(r.candidates.length,2);
 await assert.rejects(()=>f.replace({orderId:oid,revision:2,articul:'secret',inCart:[{articul:'secret',qty:1}]}),e=>e.code===404);
});
test('template writes use current customer prices and reject client-supplied prices, hidden models, duplicate rows and invalid quantities',()=>{
 assert.equal(templateCart([{articul:'001',qty:2,unitPrice:1}],products)['001'].addedPrice,100);
 for(const rows of [[{articul:'missing',qty:1}],[{articul:'001',qty:0}],[{articul:'001',qty:10000}],[{articul:'001',qty:1},{articul:'001',qty:1}]])assert.throws(()=>templateCart(rows,products));
});
test('template merge preserves negotiated prices, merges quantities, caps additions and reports unavailable models',()=>{
 const existing=[{articul:'001',qty:9998,unitPrice:80}],copy=JSON.stringify(existing),r=mergeTemplateLines({'001':{qty:5},'002':{qty:3},missing:{qty:1}},existing,products);
 assert.equal(r.lines[0].qty,9999);assert.equal(r.lines[0].unitPrice,80);assert.equal(r.lines[1].unitPrice,110);assert.equal(r.changes[0].capped,true);assert.deepEqual(r.missing,['missing']);assert.equal(JSON.stringify(existing),copy);
});
test('template preview is bound to the order customer and rejects foreign templates and changed or received orders',async()=>{
 const p={orderId:oid,revision:2,templateId:tid,lines:[{articul:'001',qty:2,unitPrice:90}]},f=fixture();const r=await f.call('admin/orders/template-preview',p);assert.equal(r.lines[0].unitPrice,90);assert.equal(r.lines[1].unitPrice,110);
 f.store.saved_carts[0].user_id=other;await assert.rejects(()=>f.call('admin/orders/template-preview',p),e=>e.code===404);
 for(const status of ['received','completed','rejected']){f.store.orders[0].status=status;await assert.rejects(()=>f.call('admin/orders/template-preview',p),e=>e.code===409);await assert.rejects(()=>f.replace({orderId:oid,revision:2,articul:'001',inCart:[{articul:'001',qty:1}]}),e=>e.code===409);}
});
test('saving an existing template preserves delivery data, checks saved_at and records its target account in audit',async()=>{
 const f=fixture(),p={userId:uid,id:tid,savedAt:f.store.saved_carts[0].saved_at,title:'Updated',lines:[{articul:'002',qty:4}]};
 await f.call('admin/templates/save',p);assert.equal(f.store.saved_carts[0].cart['002'].addedPrice,110);assert.equal(f.store.saved_carts[0].draft.contactPersonInput,'Retain me');assert.equal(JSON.parse(f.audits[0][2]).target.id,uid);
 await assert.rejects(()=>f.call('admin/templates/save',p),e=>e.code===409);
});
test('concurrent edits and deletions are rejected atomically rather than overwriting a newer template',async()=>{
 for(const path of ['admin/templates/save','admin/templates/delete']){const f=fixture(),p={userId:uid,id:tid,savedAt:f.store.saved_carts[0].saved_at,title:'Updated',lines:[{articul:'002',qty:4}]};f.race();await assert.rejects(()=>f.call(path,p),e=>e.code===409);assert.equal(f.store.saved_carts[0].title,'Weekly');}
});
test('new template saves retain the ten-item limit without implicitly replacing a client template',async()=>{
 const f=fixture();while(f.store.saved_carts.length<10)f.store.saved_carts.push({...f.store.saved_carts[0],id:String(f.store.saved_carts.length)});
 await assert.rejects(()=>f.call('admin/templates/save',{userId:uid,title:'New',lines:[{articul:'001',qty:1}],requestId:tid}),e=>e.code===409);assert.equal(f.seen.at(-1).p_replace,null);assert.equal(f.store.saved_carts.length,10);
});
test('customers endpoint provides only the necessary account summary to a manager',async()=>{
 const f=fixture(),r=await f.call('admin/templates/customers');assert.deepEqual(Object.keys(r.customers[0]).sort(),['active','client','customerCode','id']);
 await assert.rejects(()=>f.call('admin/templates/customers',null,'price'),e=>e.code===403);
});
