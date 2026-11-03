import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {historyEntry,assistantHistoryRoutes} from '../functions/zzws-api/assistant-history.mjs';
import {assistantRoutes} from '../functions/zzws-api/assistant-routes.mjs';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';
import {canAccess} from '../functions/zzws-api/operations.mjs';
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
test('history contains exact server answer, choices and specifications without credentials or raw payload fields',()=>{
 const result={answer:'Answer',choices:[{articul:'001',name:'Model',specifications:[{name:'Volume',value:'20 l'}]}]};
 const row=historyEntry({id:crypto.randomUUID(),login:'owner',role:'admin',password:'secret'},{message:' Question ',apiKey:'hidden'},result,crypto.randomUUID());
 result.choices[0].name='changed';assert.equal(row.response.choices[0].name,'Model');assert.match(row.search_text,/Model 001/);assert.doesNotMatch(JSON.stringify(row),/secret|hidden/);
});
test('only owner can list or review, including the global permission gate',async()=>{
 for(const scope of ['owner','manager','price','viewer'])for(const path of ['admin/assistant-history','admin/assistant-history/review'])assert.equal(canAccess(scope,path,'GET'),scope==='owner');
 for(const user of [{role:'client',adminScope:'owner'},{role:'admin',adminScope:'viewer'}])await assert.rejects(assistantHistoryRoutes({path:'admin/assistant-history',req:new Request('https://example.test'),user,fail}),{code:403});
});
test('date filters use Yerevan boundaries and reject invalid dates or review values',async()=>{
 const filters=[],q={select(){return this;},order(){return this;},range(){return this;},gte(...a){filters.push(a);return this;},lt(...a){filters.push(a);return this;},then(resolve){resolve({data:[],count:0});}};
 const base={path:'admin/assistant-history',user:{role:'admin',adminScope:'owner'},table:()=>q,json:x=>x,fail};
 await assistantHistoryRoutes({...base,req:new Request('https://test/?from=2026-11-02&to=2026-11-02')});assert.deepEqual(filters,[['created','2026-11-01T20:00:00.000Z'],['created','2026-11-02T20:00:00.000Z']]);
 for(const params of ['from=2026-02-31','offset=-1','status=wrong'])await assert.rejects(assistantHistoryRoutes({...base,req:new Request('https://test/?'+params)}),{code:400});
});
test('chat waits for history persistence and does not silently discard a save failure',async()=>{
 let saved;const row={id:crypto.randomUUID()},q={insert(value){saved=value;return this;},select(){return this;},single(){return Promise.resolve(row);}};
 const base={path:'assistant/chat',req:new Request('https://test',{method:'POST'}),user:{id:crypto.randomUUID(),login:'test'},body:async()=>({message:'hello',conversationId:crypto.randomUUID(),advisor:null}),current:async()=>({products:[],rules:{}}),project:()=>[],json:x=>x,fail,knowledge:{products:{}},table:()=>q,query:async x=>x};
 const result=await assistantRoutes(base);assert.equal(result.historyId,row.id);assert.equal(saved.response.answer,result.answer);
 await assert.rejects(assistantRoutes({...base,query:async()=>{throw Error('storage failed');}}),/storage failed/);
});
test('built-in refrigerator request cannot return freestanding or mini refrigerators, also after earlier context',async()=>{
 const knowledge=JSON.parse(await readFile(new URL('../functions/zzws-api/assistant-knowledge.json',import.meta.url),'utf8'));
 const enriched=JSON.parse(await readFile(new URL('../../outputs/product-enrichment/zzws_products_enriched.json',import.meta.url),'utf8'));
 const products=enriched.products.filter(p=>/սառնարան|Սառնարան/.test(p.category)).map(p=>({...p,wholesale:200000}));
 const first=await answerQuestion({message:'Холодильник',locale:'hy'},products,knowledge);
 for(const message of ['Ներկառուցվող սառնարան','Встраиваемый холодильник','Built-in fridge']){
  const r=await answerQuestion({message,advisor:first.advisor,locale:'ru'},products,knowledge);assert.equal(r.advisor.builtIn,true);assert.ok(r.recommendations.length>0);
  for(const p of r.recommendations)assert.ok(p.specifications.some(s=>/embedding/i.test(s.name)),p.name);
  assert.ok(!r.recommendations.some(p=>p.articul==='530196'));
 }
});
test('an oven request does not turn into a microwave choice list',async()=>{
 const k=JSON.parse(await readFile(new URL('../functions/zzws-api/assistant-knowledge.json',import.meta.url),'utf8'));
 const e=JSON.parse(await readFile(new URL('../../outputs/product-enrichment/zzws_products_enriched.json',import.meta.url),'utf8'));
 const p=e.products.filter(p=>/վառարան/.test(p.category)).map(p=>({...p,wholesale:100000}));
 const r=await answerQuestion({message:'Ներկառուցվող վառարան',locale:'hy'},p,k);assert.equal(r.advisor.category,'oven');assert.ok(r.recommendations.length);
 for(const item of r.recommendations)assert.match(p.find(x=>x.articul===item.articul).category,/^Ներկառուցվող վառարաններ$/);
});
