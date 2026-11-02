import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {project} from '../supabase/functions/zzws-api/catalog.mjs';
const {parse,allocate}=createRequire(import.meta.url)('../js/warehouse-allocation.js');
const rows=parse([['10001','2']]);
for(const [name,prices,expected]of [
 ['promo precedes a lower KP or WS price',{kpPromo:110,kp:90,ws:80},110],
 ['regular KP when promo is absent',{kpPromo:0,kp:90,ws:80},90],
 ['WS when both KP prices are absent',{kpPromo:0,kp:0,ws:80},80],
 ['no available price',{kpPromo:0,kp:0,ws:0},null]
])test(name,()=>{
 const products=project([{articul:'10001',name:'Test model',brand:'Test',category:'Test',retail:200,base:200,stocks:{'003':5},...prices}],{role:'admin',sheet:'Dealers',client:'test'},{});
 const kp=allocate(rows,products,false,'KP',['003']),ws=allocate(rows,products,false,'Dealers',['003']);
 assert.equal(kp[0].price,expected);assert.equal(ws[0].price,prices.ws||null);assert.deepEqual(kp[0].allocations,ws[0].allocations);
});
test('Invalid KP prices fall back to WS; WS mode never substitutes KP',()=>{
 for(const kpPrice of [undefined,null,'',0,-5,'invalid',Infinity])assert.equal(allocate(rows,[{articul:'10001',name:'Test model',stockStatus:'003: 5',kpPrice,wholesale:80}],false,'KP',['003'])[0].price,80);
 assert.equal(allocate(rows,[{articul:'10001',name:'Test model',stockStatus:'003: 5',kpPrice:90,wholesale:0}],false,'Dealers',['003'])[0].price,null);
});
test('Saved category rules replace the price order, selection mode, adjustment and rounding',()=>{
 const raw={articul:'10001',name:'Test model',brand:'Test',category:'Test',retail:1000,base:1000,stocks:{'003':5},ws:80,kp:90,kpPromo:110},user={role:'admin',sheet:'Dealers',client:'test'};
 const rule=(sources,mode='first',adjustmentPercent=0,roundTo=0)=>({stock:{availableFrom:3,otherFrom:5},access:{mode:'all',include:[],exclude:[]},pricing:{sources,mode,adjustmentPercent,roundTo,hideAboveRetail:false}});
 let products=project([raw],user,{KP:rule(['ws','kpPromo']),Dealers:rule(['kp'])});
 assert.equal(allocate(rows,products,false,'KP',['003'])[0].price,80);
 assert.equal(allocate(rows,products,false,'Dealers',['003'])[0].price,90);
 products=project([raw],user,{KP:rule(['kp','kpPromo'],'max',10,10),Dealers:rule(['ws'],'first',5)});
 assert.equal(allocate(rows,products,false,'KP',['003'])[0].price,120);
 assert.equal(allocate(rows,products,false,'Dealers',['003'])[0].price,84);
 assert.equal(products[0].wholesale,80,'Ordinary admin catalog columns stay unchanged');
 products=project([{...raw,kp:0}],user,{KP:rule(['kp']),Dealers:rule(['ws'])});
 assert.equal(allocate(rows,products,false,'KP',['003'])[0].price,null,'An unavailable configured category price must not fall back outside its sources');
});
test('Category prices are not exposed in the client catalog',()=>{
 const products=project([{articul:'10001',name:'Test model',brand:'Test',category:'Test',retail:200,base:200,stocks:{'003':5},ws:80,kp:90,kpPromo:110}],{role:'client',sheet:'Dealers',client:'test'},{});
 assert.equal(products[0].stockPickerPrices,undefined);
});
test('A saved change in category Price selection reaches the next real catalog response',async()=>{
 const {createRuntime}=await import('./support/runtime.mjs'),runtime=await createRuntime({memory:true});
 try{
  let token;const call=async(path,body)=>{const r=await runtime.handle(new Request('http://127.0.0.1:8080/functions/v1/zzws-api/'+path,{method:body?'POST':'GET',headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
  token=(await call('login',{login:'zzws-test-owner',password:'24681012'})).sessionToken;
  const before=await call('catalog'),sample=before.products[0];
  await call('account/reauth',{password:'24681012'});const settings=await call('admin/rules');
  settings.rules.KP.pricing={...settings.rules.KP.pricing,sources:['ws'],mode:'first',adjustmentPercent:-10,roundTo:100,hideAboveRetail:false};
  settings.rules.Dealers.pricing={...settings.rules.Dealers.pricing,sources:['retail','ws'],mode:'first',adjustmentPercent:0,roundTo:0,hideAboveRetail:false};
  await call('admin/rules',{rules:settings.rules,revision:settings.revision});
  const after=await call('catalog'),fresh=after.products.find(p=>p.articul===sample.articul),request=parse([[sample.articul,'1']]);
  assert.equal(allocate(request,after.products,false,'KP',['003'])[0].price,Math.round(sample.wholesale*.9/100)*100);
  assert.equal(allocate(request,after.products,false,'Dealers',['003'])[0].price,sample.retail);
  assert.notDeepEqual(fresh.stockPickerPrices,sample.stockPickerPrices);
 }finally{await runtime.close();}
});
