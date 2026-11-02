import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {suggestStockReplacements,validateStockReplacementInput,allocateStockReplacementRows,stockReplacementStocks} from '../supabase/functions/zzws-api/stock-replacements.mjs';
const require=createRequire(import.meta.url),legacy=require('../js/warehouse-allocation.js');
const priority=['003','023'];
const product=(articul,stockStatus='',overrides={})=>({articul,name:'Exact '+articul,brand:'Example',category:'TV',wholesale:100,kpPrice:80,stockAvailable:true,stockStatus,...overrides});
const specs=[['Width (cm)','100'],['Height (cm)','60'],['Depth (cm)','10'],['Diagonal','42'],['Resolution','3840 x 2160'],['Screen type','OLED']];
const knowledge=products=>({products:Object.fromEntries(products.filter(p=>p.verified!==false).map(p=>[p.articul,[p.name,'https://www.zigzag.am/en/'+p.articul+'.html','2026-11-01T00:00:00Z',p.specs||specs]]))});
const run=(source,products,options={})=>suggestStockReplacements(source,products,knowledge(products),{qty:2,priority,admin:true,...options});
test('validates bounded typed input and manual requirements without trusting user facts',()=>{
 const valid={sourceArticul:'001',qty:999999,rows:[],manualRequirements:{width:60,drying:false}};assert.equal(validateStockReplacementInput(valid).qty,999999);
 for(const p of [{...valid,qty:0},{...valid,qty:1.5},{...valid,rows:Array(2001).fill({articul:'002',qty:1})},{...valid,manualRequirements:{verified:true}},{...valid,manualRequirements:{width:'60'}},{...valid,maxPrice:Infinity},{...valid,candidateArticul:' 2'}])assert.throws(()=>validateStockReplacementInput(p),{code:400});
});
test('allocation matches actual list kernel across repeated demands, priority and reserve states',()=>{
 for(let seed=0;seed<250;seed++)for(const includeLast of [false,true]){
  const p=product('001',['003','023','050','088'].map((code,i)=>code+': '+((seed*(i+3)+i*7)%13)).join(', ')),rows=[{articul:'001',qty:seed%23+1},{articul:'001',qty:seed*7%31+1}];
  const actual=allocateStockReplacementRows(rows,[p],{priority:seed%2?priority:[...priority].reverse(),includeLast});
  const expected=legacy.allocate(rows.map(r=>({sku:r.articul,quantity:r.qty,valid:true})),[p],includeLast,'Dealers',seed%2?priority:[...priority].reverse());
  assert.deepEqual(actual.map(r=>({allocated:r.allocated,shortage:r.shortage,allocations:r.allocations})),expected.map(r=>({allocated:r.allocated,shortage:r.shortage,allocations:r.allocations})));
 }
 assert.deepEqual(stockReplacementStocks(product('001','003: 2, 003: 2')),{});assert.deepEqual(stockReplacementStocks(product('001','003: 2.5')),{});
});
test('only zero-allocated source qualifies; partial availability is refused; shops retain last unit',()=>{
 const candidate=product('002','003: 10');for(const stock of ['003: 1','003: 2']){const source=product('001',stock);assert.equal(run(source,[source,candidate]).reason,'source_available');}
 const source=product('001','050: 1');assert.equal(run(source,[source,candidate]).reason,'ok');assert.equal(run(source,[source,candidate],{includeLast:true}).reason,'source_available');
});
test('blacklists every other committed SKU, including fresh candidate validation and excess stock',()=>{
 const source=product('001'),a=product('002','003: 100'),b=product('003','023: 4');
 const result=run(source,[source,a,b],{rows:[{articul:'002',qty:1}]});assert.deepEqual(result.candidates.map(p=>p.articul),['003']);
 assert.equal(run(source,[source,a,b],{rows:[{articul:'002',qty:1}],candidateArticul:'002'}).candidates.length,0);
});
test('candidate must cover whole quantity and apply reserve, budget, brand, category and fresh price mode',()=>{
 const source=product('001'),enough=product('002','050: 3'),short=product('003','003: 1'),expensive=product('004','003: 9',{wholesale:150,kpPrice:70}),brand=product('005','003: 9',{brand:'Other'}),wrong=product('006','003: 9',{category:'Microwave'});
 assert.deepEqual(run(source,[source,enough,short,expensive,brand,wrong],{sameBrand:true,maxPrice:110}).candidates.map(p=>p.articul),['002']);
 assert.deepEqual(run(source,[source,expensive],{priceMode:'KP',maxPrice:75}).candidates.map(p=>p.price),[70]);
 assert.equal(run(source,[source,product('007','050: 2')]).candidates.length,0);assert.equal(run(source,[source,product('007','050: 2')],{includeLast:true}).candidates.length,1);
});
test('comparison distinguishes verified/differences/unknown without inventing provenance or manual facts',()=>{
 const source=product('001'),exact=product('002','003: 9'),different=product('003','003: 9',{specs:specs.map(s=>s[0]==='Width (cm)'?[s[0],'110']:s)}),unknown=product('004','003: 9',{verified:false});
 const result=run(source,[source,exact,different,unknown]);assert.deepEqual(result.candidates.map(p=>p.matchGroup),['verified','differences','insufficient']);assert.equal(result.candidates[2].sourceUrl,null);assert(result.candidates[2].comparison.missing.includes('width'));
 const manual=run(source,[source,exact,different,unknown],{manualRequirements:{width:100}});assert.deepEqual(manual.candidates.map(p=>p.articul),['002','004']);assert.equal(manual.manualRequirementsSource,'user_request');assert.equal(manual.candidates[1].matchGroup,'insufficient');
});
test('known installation/subtype conflicts are excluded; unknown critical facts remain insufficient',()=>{
 const s=product('001','',{category:'Washing machine',specs:[...specs,['Capacity (kg)','8'],['Drying','No'],['Installation type','Freestanding'],['Loading type','Front']]}),a=product('002','003: 9',{category:s.category,specs:s.specs}),b=product('003','003: 9',{category:s.category,specs:s.specs.map(r=>r[0]==='Loading type'?[r[0],'Top']:r)}),c=product('004','003: 9',{category:s.category,specs:s.specs.filter(r=>r[0]!=='Loading type')});
 const result=run(s,[s,a,b,c]);assert.deepEqual(result.candidates.map(p=>p.articul),['002','004']);assert.equal(result.candidates[1].matchGroup,'insufficient');
});
test('client output never exposes warehouse quantities/allocations and requires projected available flag',()=>{
 const source=product('001','',{stockAvailable:false}),visible=product('002','003: 9'),pending=product('003','003: 9',{stockAvailable:false});
 const result=run(source,[source,visible,pending],{admin:false});assert.deepEqual(result.candidates.map(p=>p.articul),['002']);for(const row of result.candidates)for(const field of ['availableQty','allocations','stockStatus','_stockStatus','kpPrice'])assert(!Object.hasOwn(row,field));
});
test('client binary availability cannot be probed with requested or other-row quantities',()=>{
 const source=product('001','003: 999',{stockAvailable:false}),a=product('002','003: 5'),b=product('003','');
 const small=run(source,[source,a,b],{admin:false,qty:1,rows:[{articul:'002',qty:1}]}),large=run(source,[source,a,b],{admin:false,qty:999999,rows:[{articul:'002',qty:999999}]});
 assert.deepEqual(small,large);assert.deepEqual(small.candidates.map(p=>p.articul),['003']);assert.equal(small.quantityConfirmed,false);assert.equal(small.candidates[0].quantityConfirmed,false);
 assert.equal(run({...source,stockAvailable:true},[source,a,b],{admin:false,qty:999999}).reason,'source_available');
});
test('built-in openings are required and connection conflicts cannot become insufficient suggestions',()=>{
 const oven=[['Width (cm)','60'],['Height (cm)','60'],['Depth (cm)','55'],['Oven capacity (l)','70'],['Installation type','Built-in'],['Oven type','Electric']];
 const source=product('001','',{category:'Oven',specs:oven}),candidate=product('002','003: 9',{category:'Oven',specs:oven}),gas=product('003','003: 9',{category:'Oven',specs:oven.map(r=>r[0]==='Oven type'?[r[0],'Gas']:r)});
 const result=run(source,[source,candidate,gas]);assert.deepEqual(result.candidates.map(p=>p.articul),['002']);assert.equal(result.candidates[0].matchGroup,'insufficient');for(const key of ['nicheWidth','nicheHeight','nicheDepth']){assert(result.requirements.some(r=>r.key===key&&r.required));assert(result.candidates[0].comparison.missing.includes(key));}
});
test('manual numeric modes are bounded, belong to numeric requirements and default to exact',()=>{
 const input={sourceArticul:'001',qty:2,rows:[],manualRequirements:{capacity:8,width:60,drying:false}};
 assert.deepEqual(validateStockReplacementInput(input).manualModes,{capacity:'exact',width:'exact'});
 assert.deepEqual(validateStockReplacementInput({...input,manualModes:{capacity:'min',width:'max'}}).manualModes,{capacity:'min',width:'max'});
 for(const manualModes of [{height:'max'},{drying:'exact'},{width:'minimum'},{width:1},[],{width:'MIN'}])assert.throws(()=>validateStockReplacementInput({...input,manualModes}),{code:400});
});
test('manual min/max/exact filter numbers without upgrading unknown facts or changing comparison truth',()=>{
 const source=product('001'),small=product('002','003: 9',{specs:specs.map(r=>r[0]==='Width (cm)'?[r[0],'90']:r)}),exact=product('003','003: 9'),large=product('004','003: 9',{specs:specs.map(r=>r[0]==='Width (cm)'?[r[0],'110']:r)}),unknown=product('005','003: 9',{verified:false}),all=[source,small,exact,large,unknown];
 for(const[mode,expected]of [['min',['003','004','005']],['max',['003','002','005']],['exact',['003','005']]]){
  const result=run(source,all,{manualRequirements:{width:100},manualModes:{width:mode}});assert.deepEqual(result.candidates.map(p=>p.articul),expected);assert.deepEqual(result.manualModes,{width:mode});assert(result.candidates.every(p=>p.manualModes.width===mode));const missing=result.candidates.find(p=>p.articul==='005');assert.equal(missing.matchGroup,'insufficient');assert(missing.comparison.missing.includes('manual.width'));
 }
 assert.deepEqual(run(source,all,{manualRequirements:{width:100}}).manualModes,{width:'exact'});
});
test('known multilingual connection/installation synonyms match while induction differs from electric',()=>{
 const hob=(articul,connection,installation='Freestanding')=>product(articul,articul==='001'?'':'003: 9',{category:'Hob',specs:[...specs,['Hob type',connection],['Installation type',installation]]});
 for(const value of ['Gas hob','Газовая','Գազային']){
  const source=hob('001','gas'),candidate=hob('002',value,'առանձին կանգնած'),result=run(source,[source,candidate],{manualRequirements:{connection:'gas',installation:'freestanding'}});assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].matchGroup,'verified');assert(result.candidates[0].comparison.same.some(r=>r.key==='connection'&&r.after===value),'retain original source wording in evidence');
 }
 const combined=hob('001','Gas/electric'),equivalent=hob('002','Համակցված');assert.equal(run(combined,[combined,equivalent],{manualRequirements:{connection:'combined'}}).candidates[0].matchGroup,'verified');
 const electric=hob('001','Electrical hob'),induction=hob('002','Индукционная');assert.deepEqual(run(electric,[electric,induction]).candidates,[]);
 const builtin=hob('002','Gas hob','Встраиваемая');assert.deepEqual(run(hob('001','gas'),[hob('001','gas'),builtin]).candidates,[]);
});
test('nonstandard connection values remain unknown and front/top loading aliases never merge',()=>{
 const source=product('001','',{category:'Hob',specs:[...specs,['Hob type','gas'],['Installation type','Freestanding']]}),unknown=product('002','003: 9',{category:'Hob',specs:[...specs,['Hob type','Gas-like custom standard'],['Installation type','Freestanding']]}),result=run(source,[source,unknown],{manualRequirements:{connection:'gas'}});
 assert.equal(result.candidates[0].matchGroup,'insufficient');assert(result.candidates[0].comparison.missing.includes('connection'));assert(result.candidates[0].comparison.missing.includes('manual.connection'));assert(!result.candidates[0].comparison.same.some(r=>r.key==='connection'));
 const washer=(articul,loading)=>product(articul,articul==='010'?'':'003: 9',{category:'Washing machine',specs:[...specs,['Capacity (kg)','8'],['Drying','No'],['Installation type','Freestanding'],['Loading type',loading]]}),front=washer('010','Front');
 assert.deepEqual(run(front,[front,washer('011','Фронтальная загрузка'),washer('012','Top loading')],{manualRequirements:{subtype:'front'}}).candidates.map(p=>p.articul),['011']);
});
