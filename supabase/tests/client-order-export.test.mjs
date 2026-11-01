import test from 'node:test';import assert from 'node:assert/strict';
import {clientOrderExportRoute,clientOrderWorkbook,exportFilters} from '../functions/zzws-api/client-order-export.mjs';
const id=n=>'12345678-1234-4123-8123-'+String(n).padStart(12,'0');
const order=(n,user_id='client',customer_id='customer')=>({id:id(n),number:n,user_id,customer_id,revision:2,status:['new','confirmed','in_progress','completed','rejected','received'][n%6],total:140,created:'2026-11-01T05:00:00Z',updated:'2026-11-01T06:00:00Z',customer:{client:'Company',customerCode:'000123',author:{firstName:'Sender',lastName:'Example',login:'employee',phone:'+37400123456',email:'example@example.test'}},delivery:{organization:'Branch',address:'Address',phone:'+37400543210',comment:'Client note'},comment:'Admin note',lines:[{articul:'001234',name:'Current product',qty:2,unitPrice:70}],original_lines:[{articul:'001234',name:'Original product',qty:1,unitPrice:50}],approval:{state:'pending',id:id(1000),lines:[{articul:'001234',name:'Proposed product',qty:2,unitPrice:80}]},integration_snapshot:{secret:123},approval_context:{hidden:456}});
function context(rows,payload={},user={id:'client',role:'client'}){
 const calls=[];const table=name=>{assert.equal(name,'orders');const state={conditions:[],limit:Infinity,single:false},q={state};for(const key of ['select','eq','lt','gte','is','in','or','order','limit','maybeSingle'])q[key]=(...args)=>{calls.push([key,...args]);if(key==='limit')state.limit=args[0];else if(key==='maybeSingle')state.single=true;else if(!['select','order'].includes(key))state.conditions.push([key,...args]);return q;};return q;};
 const query=async q=>{let result=rows.filter(r=>q.state.conditions.every(([key,field,value])=>key==='eq'?r[field]===value:key==='lt'?r[field]<value:key==='gte'?r[field]>=value:key==='is'?r[field]==null:key==='in'?value.includes(r[field]):key==='or'?r.lines.some(l=>field.includes(JSON.stringify(l.articul))):true)).sort((a,b)=>b.number-a.number);return q.state.single?result[0]||null:result.slice(0,Math.min(q.state.limit,73));};
 const c={path:'orders/export',req:{method:'POST'},user,table,query,body:async()=>payload,fail:(code,message)=>{throw Object.assign(Error(message),{code});},file:(rows,filename,cols,sheets)=>({filename,sheets})};return {c,calls};
}
test('all statuses and all history pages are exported despite a REST row cap and the 50-row UI',async()=>{
 const data=Array.from({length:601},(_,i)=>order(i+1));data.push(order(10000,'other'));
 const {c,calls}=context(data,{locale:'ru'}),r=await clientOrderExportRoute(c);
 assert.equal(r.sheets[0].rows.length,602);assert.equal(r.sheets[1].rows.length,602);assert.equal(r.sheets[0].rows[1][0],601);assert.equal(r.sheets[0].rows.at(-1)[0],1);
 assert.ok(new Set(r.sheets[0].rows.slice(1).map(r=>r[3])).size===6);
 assert.ok(calls.filter(c=>c[0]==='eq'&&c[1]==='user_id').length>8);assert.equal(calls.some(c=>c[0]==='eq'&&c[1]==='status'),false);
});
test('single and bulk exports enforce the same manager/employee ownership as personal history',async()=>{
 const rows=[order(1,'manager'),order(2,'employee'),order(3,'other','other-customer')];
 const manager=context(rows,{}, {id:'manager',role:'client',clientRole:'manager',customerId:'customer'});assert.equal((await clientOrderExportRoute(manager.c)).sheets[0].rows.length,3);assert.ok(manager.calls.some(c=>c[0]==='eq'&&c[1]==='customer_id'));
 const employee=context(rows,{}, {id:'employee',role:'client',clientRole:'employee',customerId:'customer'});assert.equal((await clientOrderExportRoute(employee.c)).sheets[0].rows.length,2);
 await assert.rejects(()=>clientOrderExportRoute(context(rows,{id:id(3)},{id:'manager',role:'client',clientRole:'manager',customerId:'customer'}).c),e=>e.code===404);
 await assert.rejects(()=>clientOrderExportRoute(context(rows,{id:id(1)},{id:'employee',role:'client',clientRole:'employee',customerId:'customer'}).c),e=>e.code===404);
 await assert.rejects(()=>clientOrderExportRoute(context(rows,{}, {id:'manager',role:'client',clientRole:'manager'}).c),e=>e.code===403);
});
test('workbook separates accepted, original and proposed prices, retains text SKUs and customer data without internal snapshots',()=>{
 const book=clientOrderWorkbook([order(1)],{locale:'ru',single:true});assert.equal(book.filename,'ZZWS-Order-1.xlsx');assert.equal(book.sheets.length,5);
 const summary=book.sheets[0].rows;assert.equal(summary[1][5],140);assert.equal(summary[1][7],'000123');assert.equal(summary[1][8],'Sender Example');assert.equal(summary[1][12],'+37400543210');
 assert.deepEqual(book.sheets[1].rows[1].slice(2),['001234','Current product',2,70,140]);assert.deepEqual(book.sheets[2].rows[1].slice(1),['001234','Original product',1,50,50]);assert.deepEqual(book.sheets[3].rows[1].slice(3),['001234','Proposed product',2,80,160]);
 assert.equal(JSON.stringify(book).includes('integration_snapshot'),false);assert.equal(JSON.stringify(book).includes('approval_context'),false);
});
test('single export supports all lifecycle states including pending approval and rejected orders',async()=>{
 for(let i=1;i<=6;i++){const r=await clientOrderExportRoute(context([order(i)],{id:id(i)}).c);assert.equal(r.filename,'ZZWS-Order-'+i+'.xlsx');assert.equal(r.sheets[0].rows.length,2);}
});
test('date filters are inclusive in Yerevan and reject search/filter injection',async()=>{
 const t=context([order(1)],{filters:{from:'2026-11-01',to:'2026-11-01',search:'001234',receiptPending:true}});await clientOrderExportRoute(t.c);
 assert.ok(t.calls.some(r=>r[0]==='gte'&&r[2]==='2026-10-31T20:00:00.000Z'));assert.ok(t.calls.some(r=>r[0]==='lt'&&r[1]==='created'&&r[2]==='2026-11-01T20:00:00.000Z'));assert.ok(t.calls.some(r=>r[0]==='or'&&r[1].includes('"001234"')));
 for(const filters of [{from:'2026-02-30'},{from:'2026-11-02',to:'2026-11-01'},{search:'x,number.gt.0'},{user_id:'other'},{before:100},{receiptPending:'true'},[]])assert.throws(()=>exportFilters(filters),e=>e.code===400);
});
test('export limits fail explicitly and never return a truncated file',async()=>{
 const row=order(1);row.lines=Array.from({length:100001},()=>({articul:'one',qty:1,unitPrice:1}));await assert.rejects(()=>clientOrderExportRoute(context([row]).c),e=>e.code===413);
});
test('malformed requests, foreign account selectors and administrator calls are denied',async()=>{
 for(const payload of [{id:'x'},{id:id(1),filters:{}},{locale:'en'},{userId:'other'},{filters:false},null])await assert.rejects(()=>clientOrderExportRoute(context([],payload).c),e=>e.code===400);
 await assert.rejects(()=>clientOrderExportRoute(context([],{}, {id:'admin',role:'admin'}).c),e=>e.code===403);
});
test('empty histories still produce a valid explanatory workbook with headers',async()=>{const r=await clientOrderExportRoute(context([],{}).c);assert.equal(r.sheets[0].rows.length,1);assert.equal(r.sheets[1].rows.length,1);assert.ok(r.sheets.at(-1).rows.length>0);});
