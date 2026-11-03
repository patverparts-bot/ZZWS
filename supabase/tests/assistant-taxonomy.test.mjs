import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {classifyCategory,categoryIntent,applianceProfile,categoryAccepts,readDimensions} from '../functions/zzws-api/appliance-taxonomy.mjs';
import {similaritySource,compareSimilar} from '../functions/zzws-api/assistant-similarity.mjs';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';
const product=(id,category,specs,price=100000)=>({p:{articul:id,name:'Brand MODEL'+id,brand:'Brand',category,wholesale:price},d:{status:'verified',specifications:specs.map(([name,value])=>({name,value}))}});
const fridge=(id,volume=300,width=60,extra=[])=>product(id,'Սառնարաններ',[['Total volume(l)',volume+' l'],['Freezer volume (l)','80'],['Dimensions(HxWxD)',`180 x ${width} x 65 cm`],['Refrigerator','NoFrost'],['Freezer','NoFrost'],...extra]);
test('catalogue leaf categories are disjoint even when words overlap',()=>{
 const rows=[['Սպասք լվացող մեքենաներ','dishwasher'],['Լվացքի մեքենաներ','washer'],['Լվացքի մեքենաներ չորանոցներով','washer'],['Չորացնող մեքենաներ','dryer'],['Ներկառուցվող միկրոալիքային վառարաններ','microwave'],['Ներկառուցվող վառարաններ','oven'],['Ներկառուցվող (Գազօջախներ)','hob'],['Համակցված գազօջախներ','cooker'],['Գոլորշու գեներատոր','steamGenerator'],['Մազի արդուկներ','other'],['Սառցարաններ','freezer'],['Սառնարաններ','fridge']];for(const [category,family]of rows)assert.equal(classifyCategory(category).family,family,category);
 for(const category of ['Սառնարանի պարագաներ','Հեռուստացույցի կախիչ','Հեռուստացույցի հեռակառավարման վահանակ','Փոշեկուլի պարկ և պարագա','Արդուկի սեղան'])assert.equal(classifyCategory(category).family,'accessory',category);
});
test('subtypes, loading and fuel are hard semantic requirements in all supported languages',()=>{
 for(const query of ['Капсульная кофемашина','Capsule coffee machine','Կապսուլային սրճեփ'])assert.equal(categoryIntent(query).kind,'capsule');
 for(const query of ['Робот-пылесос','Robot vacuum cleaner','Ռոբոտ փոշեկուլ'])assert.equal(categoryIntent(query).kind,'robot');
 assert.equal(categoryIntent('holodilnik vstraivaemiy').builtIn,true);
 assert.equal(categoryIntent('Индукционная варочная панель').connection,'induction');
 const capsule=applianceProfile(...(()=>{const x=product('1','Կապսուլային սրճեփ մեքենաներ',[]);return [x.p,x.d];})());
 assert.equal(categoryAccepts({category:'coffee',kind:'automatic'},capsule),false);
 assert.equal(categoryAccepts({category:'fridge'},applianceProfile(fridge('2').p,fridge('2').d)),true);
});
test('physical, packaging and niche dimensions cannot be substituted for one another',()=>{
 const specs=[{name:'Dimensions(HxWxD)',value:'180 x 60 x 65 cm'},{name:'Embedding Dimensions(HxWxD) (cm)',value:'178 x 56 x 55'},{name:'Packaging Dimensions(HxWxD)',value:'200 x 70 x 80 cm'}];
 assert.deepEqual(readDimensions(specs),{height:180,width:60,depth:65});assert.deepEqual(readDimensions(specs,true),{height:178,width:56,depth:55});
 assert.deepEqual(readDimensions([{name:'Embedding Dimensions(HxWxD) (cm)',value:'177.2-178 x 56 x 55'}],true),{});
});
test('similar fridge candidates use volume/size bands, preserve functions and expose exact deviations',()=>{
 const a=fridge('1'),b=fridge('2',330,62),source=similaritySource(a.p,a.d),profile=applianceProfile(b.p,b.d),r=compareSimilar(source,profile,100000,110000);
 assert.equal(r.accepted,true);assert.equal(r.kind,'near');assert.ok(r.changes.some(c=>c.field==='volume'&&c.difference===30));
 const far=fridge('3',450);assert.equal(compareSimilar(source,applianceProfile(far.p,far.d),100000,100000).accepted,false);
 assert.equal(compareSimilar(source,profile,100000,150000).accepted,false);assert.equal(compareSimilar(source,profile,100000,150000,{budgetMax:160000}).accepted,true);
 assert.equal(compareSimilar(source,profile,100000,110000,{toleranceScale:0}).accepted,false);
 const frost=fridge('4');frost.d.specifications=frost.d.specifications.map(s=>s.name==='Freezer'?{...s,value:'Manual'}:s);assert.equal(compareSimilar(source,applianceProfile(frost.p,frost.d),100000,100000).accepted,false);
});
test('built-in analogue requires verified matching niche dimensions; there is no centimetre tolerance for cut-outs',()=>{
 const specs=[['Capacity (l)','65'],['Type','Built-in'],['Embedding Dimensions(HxWxD) (cm)','60 x 56 x 55']];const a=product('1','Ներկառուցվող վառարաններ',specs),b=product('2','Ներկառուցվող վառարաններ',[...specs.slice(0,2),['Embedding Dimensions(HxWxD) (cm)','60 x 56.5 x 55']]);
 assert.equal(compareSimilar(similaritySource(a.p,a.d),applianceProfile(b.p,b.d),100000,100000).accepted,false);
 const missing=product('3','Ներկառուցվող վառարաններ',specs.slice(0,2));assert.ok(similaritySource(missing.p,missing.d).missing.includes('niche.width'));
});
test('source model analogues exclude the source itself, respect hard user limits and never reuse an unknown new source',async()=>{
 const rows=[fridge('800001'),fridge('800002',320),fridge('800003',500)],products=rows.map(r=>r.p),knowledge={products:Object.fromEntries(rows.map(({p,d})=>[p.articul,[p.name,'https://www.zigzag.am/en/'+p.articul+'.html','2026-11-03T00:00:00Z',d.specifications.map(s=>[s.name,s.value])]]))};
 const r=await answerQuestion({message:'Подбери аналог 800001',locale:'ru'},products,knowledge);assert.equal(r.advisor.similarTo,'800001');assert.deepEqual(r.recommendations.map(p=>p.articul),['800002']);assert.ok(r.recommendations[0].similarity.changes.some(d=>d.field==='volume'));
 const limit=await answerQuestion({message:'Аналог 800001 ширина не больше 50 см',locale:'ru'},products,knowledge);assert.equal(limit.recommendations.length,0);
 const denied=await answerQuestion({message:'Аналог UNKNOWN999',context:['800001'],locale:'ru'},products,knowledge);assert.equal(denied.recommendations.length,0);
 const restricted=await answerQuestion({message:'Покажи ещё',advisor:r.advisor,locale:'ru'},products.slice(1),knowledge);assert.equal(restricted.recommendations.length,0);
});
test('real catalogue profile projection contains no prices; plain coffee asks a subtype instead of mixing machines',async()=>{
 const knowledge=JSON.parse(await readFile(new URL('../functions/zzws-api/assistant-knowledge.json',import.meta.url),'utf8'));
 const r=await answerQuestion({message:'Посоветуй кофемашину',locale:'ru'},[],knowledge);assert.equal(r.advisor.pending,'subtype');assert.ok(r.quickReplies.some(s=>/капсульн/i.test(s)));assert.equal(r.recommendations.length,0);
 const resolution=await answerQuestion({message:'Телевизор 4K',locale:'ru'},[],knowledge);assert.equal(resolution.advisor.budgetMax,undefined);
});
