const assert=require('node:assert/strict');
const {parse,allocate:configuredAllocate,checkClient}=require('../js/warehouse-allocation.js');
const allocate=(rows,products,last=false,group='Dealers',priority=['003','023','031','026'])=>configuredAllocate(rows,products,last,group,priority);
const clientCatalog=[{articul:'client-visible',name:'Client model',wholesale:100,stockAvailable:true},{articul:'pending',name:'Pending model',wholesale:200,stockAvailable:false,stockStatus:'Ճշտել'}];
const checked=checkClient(parse([['client-visible','3'],['pending','2'],['admin-only','1']]),clientCatalog);
assert.equal(checked[0].available,true);assert.equal(checked[0].price,100);assert.equal(checked[0].allocations,undefined);assert.equal(checked[1].error,'checkStock');assert.equal(checked[2].error,'missing');
assert.equal(checked[1].canAdd,true);assert.equal(checked[2].canAdd,false);assert.equal(checkClient([checked[0]],[])[0].canAdd,false);
const curlers=[{articul:'c459',name:'Babyliss C459E 32mm hair curler titanium',stockStatus:'003: 3'},{articul:'c453',name:'Babyliss C453E 32mm hair curler titanium',stockStatus:'003: 3'},{articul:'other-brand',name:'Other C459E 25mm hair curler',stockStatus:'003: 3'}];
assert.equal(allocate(parse([['Սթայլեր Babyliss C459E 32mm titanium','3']]),curlers)[0].articul,'c459');
assert.equal(allocate(parse([['Սթայլեր Babyliss 32mm titanium','3']]),curlers)[0].error,'missing');
assert.equal(allocate(parse([['Սթայլեր Babyliss C459E 32mm titanium','3']]),curlers.slice(1))[0].error,'missing');
const products=[{articul:'00123',name:'Լվացքի մեքենա Bosch WGB24410ME',wholesale:120000,stockStatus:'026: 4, 023: 2, 003: 1, 031: 3, 001: 2, 007: 1'}, {articul:'00456',name:'Bosch KGN49LBE0T',wholesale:0,stockStatus:'003: 2'}];
const priceProducts=[{...products[0],kpPrice:99000}];
const priceRows=parse([['00123','2']]);
assert.equal(allocate(priceRows,priceProducts)[0].price,120000);
assert.equal(allocate(priceRows,priceProducts,false,'KP')[0].price,99000);
assert.deepEqual(allocate(priceRows,priceProducts)[0].allocations,allocate(priceRows,priceProducts,false,'KP')[0].allocations);
assert.equal(allocate(priceRows,products,false,'KP')[0].price,null);
assert.equal(allocate(priceRows,[{...products[0],wholesale:0,kpPrice:99000}],false,'KP')[0].price,99000);
const rows=parse([['Մոդել','Պատվ.'],['Լվացքի մեքենա Bosch WGB24410ME','13'],['Bosch KGN49LBE0T','1'],['Unknown','2']]);
let result=allocate(rows,products);
assert.deepEqual(result[0].allocations,[{warehouse:'003',quantity:1},{warehouse:'023',quantity:2},{warehouse:'031',quantity:3},{warehouse:'026',quantity:4},{warehouse:'001',quantity:1}]);
assert.equal(result[0].shortage,2);assert.equal(result[0].price,120000);assert.equal(result[1].price,null);assert.equal(result[2].error,'missing');assert.equal(result[2].shortage,2);
result=allocate(rows,products,true);assert.equal(result[0].shortage,0);assert.equal(result[0].allocated,13);
const repeated=parse([['00123','5'],['00123','6'],['00123','1']]);result=allocate(repeated,products);assert.deepEqual(result.map(r=>r.allocated),[5,6,0]);
// Prefer a whole request at one main warehouse over splitting from earlier ones.
assert.deepEqual(allocate(parse([['00123','3']]),products)[0].allocations,[{warehouse:'031',quantity:3}]);
assert.deepEqual(allocate(parse([['00123','4']]),products)[0].allocations,[{warehouse:'026',quantity:4}]);
assert.deepEqual(allocate(parse([['00123','2']]),products)[0].allocations,[{warehouse:'023',quantity:2}]);
assert.deepEqual(allocate(parse([['00123','1']]),products)[0].allocations,[{warehouse:'003',quantity:1}]);
// A later input row sees the stock left by the earlier selection.
assert.deepEqual(allocate(parse([['00123','4'],['00123','3']]),products).map(r=>r.allocations),[[{warehouse:'026',quantity:4}],[{warehouse:'031',quantity:3}]]);
assert.equal(allocate(parse([['00123','-1'],['00123','1.5'],['00123','0']]),products).every(r=>r.error==='quantity'),true);
assert.equal(allocate(parse([['արտիկուլ','մոդել','քանակ'],['00456','ignored','1']]),products)[0].articul,'00456');
assert.equal(allocate(parse([['00456','Bosch KGN49LBE0T','1']]),products)[0].articul,'00456');
assert.equal(allocate(parse([['Bosch WGB24410ME','1']]),[...products,{...products[0],articul:'other'}])[0].error,'ambiguous');
const consoles=[{articul:'100',name:'PS5 Playstation 5 Slim CD version'},{articul:'200',name:'PS5 Playstation 5 Digital Edition'}];
assert.equal(allocate(parse([['PS5 Playstation 5 Slim CD version (վիդեո խաղի համակարգ)','5']]),consoles)[0].articul,'100');
assert.equal(allocate(parse([['Playstation 5 Slim CD version (վիդեո խաղի համակարգ)','5']]),consoles)[0].articul,'100');
const plainConsoles=consoles.map(p=>({...p,name:p.name.replace('PS5 ','')}));
assert.equal(allocate(parse([['ps5   playstation 5 Slim CD version','5']]),plainConsoles)[0].articul,'100');
assert.equal(allocate(parse([['PS5 Playstation 5 Slim CD version','5']]),[consoles[1]])[0].error,'missing');
const proConsoles=[{articul:'pro-digital',name:'Playstation 5 Pro Console Digital /PS5',stockStatus:'003: 3'},{articul:'slim-cd',name:'Playstation 5 Slim CD version',stockStatus:'003: 3'},{articul:'38520100',name:'PS5 Death Stranding 2: On the Beach',stockStatus:'003: 3'},{articul:'3851045',name:'PS5 Atomic Heart',stockStatus:'003: 3'},{articul:'pro-no-suffix',name:'Playstation 5 Pro Console Digital',stockStatus:'003: 3'}];
for(const suffix of [' /PS5','/PS5',' / PS5']){
 const pro=allocate(parse([['PS5 Playstation 5 Pro Console Digital'+suffix+' (վիդեո խաղի համակարգ)','3']]),proConsoles)[0];assert.equal(pro.articul,'pro-digital');assert.equal(pro.allocated,3);
 assert.equal(allocate(parse([['Playstation 5 Pro Console Digital'+suffix,'3']]),proConsoles.slice(1))[0].error,'missing');
}
assert.equal(allocate(parse([['PS5 Playstation 5 Pro Console Digital (վիդեո խաղի համակարգ)','3']]),proConsoles)[0].articul,'pro-no-suffix');
assert.equal(allocate(parse([['PS5 Playstation 5 Pro Console Digital (վիդեո խաղի համակարգ)','3']]),proConsoles.slice(0,4))[0].articul,'pro-digital');
assert.equal(allocate(parse([['Playstation 5 Pro Console Digital (վիդեո խաղի համակարգ)','3']]),proConsoles.slice(0,4))[0].error,'missing');
const controllers=[{articul:'chrome-teal',name:'Playstation 5 DualSense Controller Chrome Teal /PS5',stockStatus:'003: 4'}, {articul:'chrome-indigo',name:'Playstation 5 DualSense Controller Chrome Indigo /PS5',stockStatus:'003: 4'},...proConsoles];
for(const text of ['PS5 Playstation 5 DualSense Controller Chrome Teal(խաղային վահանակ)','ps5  playstation 5 DualSense Controller Chrome Teal (խաղային վահանակ)','PS5 Playstation 5 DualSense Controller Chrome Teal /PS5'])assert.equal(allocate(parse([[text,'3']]),controllers)[0].articul,'chrome-teal');
assert.equal(allocate(parse([['PS5 Playstation 5 DualSense Controller Chrome Teal(խաղային վահանակ)','3']]),controllers.slice(1))[0].error,'missing');
assert.equal(allocate(parse([['PS5 Playstation 5 DualSense Controller Chrome Teal(խաղային վահանակ)','3']]),[controllers[0],{...controllers[0],articul:'second-teal'}])[0].error,'ambiguous');
const ambiguous=allocate(parse([['PS5','5']]),consoles)[0];
assert.deepEqual(ambiguous.candidates,consoles);assert.equal(ambiguous.allocated,0);assert.equal(ambiguous.shortage,5);
const hoods=[{articul:'840493',name:'Elica ERA C IX/A/52'},{articul:'8405021',name:'Elica HIDDEN 2.0 IX/A/52'},{articul:'840521',name:'Elica FOLD S IX/A/52'}];
assert.equal(allocate(parse([['Օդաքարշ պահարան ներներկառուցվող Elica ERA C IX/A/52','4']]),hoods)[0].articul,'840493');
assert.equal(allocate(parse([['Elica IX/A/52','4']]),hoods)[0].error,'ambiguous');
assert.equal(allocate(parse([['100','5']]),consoles)[0].articul,'100');
assert.equal(allocate(parse([['Bosch WGB24410M','1']]),products)[0].error,'missing');
assert.equal(allocate(parse([['00123','1']]),[{...products[0],stockStatus:'003: 2, invalid'}])[0].allocated,0);
assert.equal(allocate(parse([['00123','1']]),[{...products[0],stockStatus:'003: 2, 003: 2'}])[0].allocated,0);
const shopProduct={articul:'shops',name:'Shop model',wholesale:1,stockStatus:'001: 2, 009: 10, 004: 6'};
let balanced=allocate(parse([['shops','8']]),[shopProduct])[0];
assert.deepEqual(balanced.allocations,[{warehouse:'009',quantity:6},{warehouse:'004',quantity:2}]);
balanced=allocate(parse([['shops','12']]),[shopProduct])[0];
assert.deepEqual(balanced.allocations,[{warehouse:'009',quantity:8},{warehouse:'004',quantity:4}]);
assert.equal(balanced.shortage,0); // All three shops retain two units.
balanced=allocate(parse([['shops','16']]),[shopProduct])[0];assert.equal(balanced.allocated,15);assert.equal(balanced.shortage,1);
balanced=allocate(parse([['shops','18']]),[shopProduct],true)[0];assert.equal(balanced.allocated,18);
// Compare the bulk leveling algorithm with taking units one at a time from
// the current largest stock, including repeated rows and both switch states.
for(let seed=0;seed<200;seed++)for(const includeLast of [false,true]){
 const codes=['001','004','009'],pool=Object.fromEntries(codes.map((c,i)=>[c,(seed*(i+3)+i*7)%13]));
 const product={...shopProduct,stockStatus:codes.map(c=>c+': '+pool[c]).join(', ')};
 const quantities=[seed%20+1,(seed*7)%25+1],actual=allocate(parse(quantities.map(q=>['shops',String(q)])),[product],includeLast);
 for(let i=0;i<quantities.length;i++){
  const picked={};let taken=0;
  while(taken<quantities[i]){const sorted=codes.filter(c=>pool[c]>(includeLast?0:1)).sort((a,b)=>pool[b]-pool[a]||a.localeCompare(b));if(!sorted.length)break;const code=sorted[0];pool[code]--;picked[code]=(picked[code]||0)+1;taken++;}
  assert.deepEqual(Object.fromEntries(actual[i].allocations.map(a=>[a.warehouse,a.quantity])),picked);
  assert.equal(actual[i].shortage,quantities[i]-taken);
 }
}
console.log('Warehouse allocation checks passed, including 400 balancing scenarios');

// The runtime must receive administrator configuration, with no baked-in warehouse list.
assert.throws(()=>configuredAllocate([],[]),/policy/);
const dynamic={articul:'dynamic',name:'Dynamic',wholesale:10,stockStatus:'050: 4, 088: 3, 003: 2'};
const demand=parse([['dynamic','6']]);
assert.deepEqual(configuredAllocate(demand,[dynamic],false,'Dealers',['088','050'])[0].allocations,[{warehouse:'088',quantity:3},{warehouse:'050',quantity:3}]);
assert.deepEqual(configuredAllocate(demand,[dynamic],false,'Dealers',['050','088'])[0].allocations,[{warehouse:'050',quantity:4},{warehouse:'088',quantity:2}]);
assert.equal(configuredAllocate(parse([['dynamic','9']]),[dynamic],false,'Dealers',[])[0].allocated,6);
assert.equal(configuredAllocate(parse([['dynamic','9']]),[dynamic],true,'Dealers',[])[0].allocated,9);
assert.deepEqual(configuredAllocate(parse([['dynamic','3']]),[dynamic],false,'Dealers',['050','088'])[0].allocations,[{warehouse:'050',quantity:3}]);
console.log('PASS: configurable main warehouses/order, new codes, no-main policy, shop reserve and missing-policy rejection');
