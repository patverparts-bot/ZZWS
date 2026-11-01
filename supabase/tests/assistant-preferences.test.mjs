import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';
import {assistantRoutes} from '../functions/zzws-api/assistant-routes.mjs';
import {validateAdvisor} from '../functions/zzws-api/advisor.mjs';
const definitions=[
 ['001','LG F1','fridge',100000,42,300,280,'White','Standard'],
 ['002','Bosch F2','fridge',200000,35,400,170,'Silver','Inverter'],
 ['003','Haier F3','fridge',180000,38,500,300,'Black','Inverter'],
 ['004','LG F4','fridge',250000,37,450,220,'White','Inverter'],
 ['005','LG F5','fridge',270000,40,430,260,'Silver','Inverter'],
 ['006','LG F6','fridge',280000,41,420,270,'White','Standard'],
 ['007','LG F7','fridge',290000,43,410,275,'Black','Standard'],
 ['008','LG F8','fridge',300000,null,null,null,'White',null],
 ['101','Samsung TV1','tv',150000,55,null,null,'Black'],
 ['102','LG TV2','tv',250000,65,null,null,'Black'],
 ['201','Bosch W1','washer',140000,74,8,.9,'White','Inverter'],
 ['202','LG W2','washer',190000,70,10,.5,'Silver','Inverter'],
 ['301','Bosch D1','dishwasher',160000,44,10,.9,'White'],
 ['302','Haier D2','dishwasher',180000,42,14,.6,'Silver']
];
const names={fridge:'Սառնարաններ',tv:'Հեռուստացույց',washer:'Լվացքի մեքենաներ',dishwasher:'Սպասք լվացող մեքենաներ'};
const products=definitions.map(([articul,name,kind,wholesale],i)=>({articul,name,brand:name.split(' ')[0],category:names[kind],wholesale,retail:wholesale+10000,kpPrice:wholesale-10000,stockAvailable:i!==0,isWholesalePromo:i===1}));
const knowledge={products:Object.fromEntries(definitions.map(([id,name,kind,,noise,volume,energy,color,motor])=>{
 const specs=[['Color',color],['Dimensions(HxWxD)','180 x 60 x 65 cm']];
 if(kind==='fridge'){if(noise!=null)specs.push(['Noise level (dB)',String(noise)]);if(volume!=null)specs.push(['Total volume(l)',volume+' l']);if(energy!=null)specs.push(['Energy consumption of the year (kWh)',String(energy)]);specs.push(['Refrigerator',id==='001'?'Drip':'NoFrost'],['Freezer',id==='001'?'Manual':'NoFrost']);}
 if(kind==='tv')specs.push(['Diagonal',noise+'"'],['Smart TV supported','Yes'],['Resolution (px)',id==='101'?'1920 x 1080':'3840 x 2160']);
 if(kind==='washer')specs.push(['Noise level during spinning (dB)',String(noise)],['Load Capacity (kg)',String(volume)],['Energy consumption per cycle (kWh)',String(energy)]);
 if(kind==='dishwasher')specs.push(['Noise level (dB)',String(noise)],['Maximum Capacity (set)',String(volume)],['Energy consumption per cycle (kWh)',String(energy)]);
 if(motor)specs.push([kind==='fridge'?'Compressor type':'Motor type',motor]);
 return [id,[name,'https://www.zigzag.am/en/'+id+'.html','2026-11-01T00:00:00Z',specs]];
}))};
const ask=(message,advisor=null,visible=products,extra={})=>answerQuestion({message,advisor,locale:'ru'},visible,knowledge,extra);
test('best asks a measurable priority rather than silently selecting the cheapest',async()=>{
 const first=await ask('Самый лучший холодильник предложи');
 assert.equal(first.advisor.pending,'priority');assert.equal(first.recommendations.length,0);assert.ok(first.quickReplies.includes('Тише'));
 const quiet=await ask('Тише',first.advisor);assert.equal(quiet.recommendations[0].articul,'002');assert.ok(quiet.recommendations[0].reasons.includes('Шум: 35 dB'));
 const bigger=await ask('Вместительнее',quiet.advisor);assert.equal(bigger.recommendations[0].articul,'003');
 const energy=await ask('Меньше расход энергии',bigger.advisor);assert.equal(energy.recommendations[0].articul,'002');assert.ok(energy.answer.includes('разных стандартов'));
});
test('plain category discloses price sorting; reasons match each actual model',async()=>{
 const r=await ask('Холодильник');assert.deepEqual(r.recommendations.map(p=>p.articul),['001','003','002']);assert.ok(r.answer.includes('не рейтинг качества'));
 for(const p of r.recommendations){assert.ok(p.reasons.some(s=>s.includes(p.price.amount.toLocaleString('en-US'))));assert.equal(p.reasons.some(s=>/надёжн|лучш/i.test(s)),false);}
});
test('volume, noise, inverter, colour, stock and promo filters do not get replaced by price ranking',async()=>{
 const r=await ask('Холодильник от 400 литров, до 40 дБ, серебристый, инверторный, No Frost, в наличии, до 230 тысяч драм');
 assert.equal(r.advisor.budgetMax,230000);assert.deepEqual(r.recommendations.map(p=>p.articul),['002']);
 assert.deepEqual((await ask('Холодильник по акции')).recommendations.map(p=>p.articul),['002']);
 assert.equal((await ask('Холодильник в наличии')).recommendations.some(p=>p.articul==='001'),false);
 assert.deepEqual((await ask('Холодильник до 350 литров')).recommendations.map(p=>p.articul),['001']);
 assert.equal((await ask('Холодильник от 400 литров')).advisor.budgetMax,undefined);
 assert.deepEqual((await ask('Холодильник без инвертора')).recommendations.map(p=>p.articul),['001','006','007']);
});
test('washer and dishwasher priorities use correct comparable technical metrics',async()=>{
 const washer=await ask('Тихая стиральная машина от 8 кг до 200 тысяч драм');assert.equal(washer.recommendations[0].articul,'202');assert.ok(washer.recommendations[0].reasons.includes('Шум: 70 dB'));
 const dishwasher=await ask('Вместительная посудомоечная машина от 12 комплектов');assert.deepEqual(dishwasher.recommendations.map(p=>p.articul),['302']);assert.equal(dishwasher.advisor.budgetMax,undefined);
});
test('TV understands screen size, smart and resolution without confusing inches or 4K with budget',async()=>{
 const r=await ask('Телевизор Smart TV 4K от 55 дюймов до 300 тысяч драм');assert.deepEqual(r.recommendations.map(p=>p.articul),['102']);
 assert.equal(r.advisor.minDiagonal,55);assert.equal(r.advisor.budgetMax,300000);
 const biggest=await ask('Телевизор побольше экран');assert.equal(biggest.recommendations[0].articul,'102');
});
test('more paginates without duplicate models and why retains priorities and budget',async()=>{
 const first=await ask('Холодильник до 350 тысяч драм');
 const second=await ask('Покажи ещё',first.advisor);assert.equal(second.advisor.page,1);assert.equal(second.advisor.budgetMax,350000);assert.equal(second.recommendations.some(p=>first.recommendations.some(a=>a.articul===p.articul)),false);
 const why=await ask('Почему эти модели?',second.advisor);assert.deepEqual(why.recommendations.map(p=>p.articul),second.recommendations.map(p=>p.articul));assert.equal(why.advisor.page,1);
 const third=await ask('Ещё',second.advisor);const end=await ask('Покажи ещё',third.advisor);assert.equal(end.recommendations.length,0);assert.ok(end.answer.includes('уточним'));
 const changed=await ask('Покажи ещё более тихие',second.advisor);assert.equal(changed.advisor.page,0);assert.equal(changed.recommendations[0].articul,'002');
});
test('implicit comparison and product details are resolved only against currently authorized products',async()=>{
 const first=await ask('Холодильник');const compared=await ask('Сравни эти модели',first.advisor,products,{apiKey:'key',freeTierConfirmed:true,fetcher:()=>{throw Error('provider must not be called');}});
 assert.deepEqual(compared.products.map(p=>p.articul),first.advisor.shown.slice(0,2));assert.ok(compared.answer.includes('Noise level (dB)'));
 const detail=await ask('Расскажи подробнее о второй модели',first.advisor);assert.equal(detail.products[0].articul,first.advisor.shown[1]);
 const restricted=await ask('Сравни эти модели',first.advisor,[]);assert.equal(restricted.products.length,0);assert.equal(JSON.stringify(restricted).includes('LG F1'),false);
});
test('family requests ask for requirements instead of inventing recommended capacity',async()=>{
 const family=await ask('Холодильник для семьи из 4 человек');assert.equal(family.advisor.pending,'family');assert.equal(family.recommendations.length,0);
 const refined=await ask('От 400 литров',family.advisor);assert.ok(refined.recommendations.length>0);assert.equal(refined.advisor.family,undefined);
});
test('reliability and reviews are not fabricated; missing ranking metrics never win',async()=>{
 const r=await ask('Самый надежный холодильник по отзывам');assert.equal(r.advisor.pending,'priority');assert.ok(r.answer.includes('нельзя достоверно'));
 const quiet=await ask('Тихий холодильник');assert.equal(quiet.recommendations.some(p=>p.articul==='008'),false);
 const k=structuredClone(knowledge);k.products['002'][3]=k.products['002'][3].filter(([n])=>n!=='Energy consumption of the year (kWh)');k.products['002'][3].push(['Energy Rating','A+++']);
 const energy=await answerQuestion({message:'Экономичный холодильник',locale:'ru'},products,k);assert.equal(energy.recommendations.some(p=>p.articul==='002'),false);
});
test('unknown inputs, exact missing SKUs and impossible conditions use a warm refinement message in all languages',async()=>{
 for(const locale of ['ru','hy','en'])for(const message of ['abracadabra','99999999999','Холодильник ширина до 1 см','Холодильник до 1 драм']){
  const r=await answerQuestion({message,locale},products,knowledge);assert.equal(r.recommendations?.length||r.products.length,0);
  assert.equal(/товар.*не найден|нет.*товар|категори.*нет|չգտնվ|կատալոգում չկա|category.*not|product not found|no verified options/i.test(r.answer),false,r.answer);
  assert.match(r.answer,/уточ|учусь|հստակ|սովոր|refine|learning/i);
 }
 const first=await ask('Холодильник');const unknown=await ask('абракадабра',first.advisor);assert.equal(unknown.recommendations.length,0);assert.ok(unknown.answer.includes('учусь'));
});
test('HY and EN priorities and Russian input with Armenian locale stay in UI language',async()=>{
 for(const [message,locale] of [['Լավագույն սառնարան','hy'],['Best fridge','en'],['Самый лучший холодильник','hy']]){
  const r=await answerQuestion({message,locale},products,knowledge);assert.equal(r.advisor.pending,'priority');assert.equal(r.advisor.language,locale);
  const next=await answerQuestion({message:r.quickReplies[1],advisor:r.advisor,locale},products,knowledge);assert.equal(next.recommendations[0].articul,'002');if(locale==='hy')assert.equal(/[а-яё]/i.test(next.answer),false);
 }
});
test('state cannot carry excessive pages, raw products, unknown priorities or unbounded prior IDs',()=>{
 for(const state of [{page:-1},{page:101},{page:1.2},{shown:Array(4).fill('001')},{shown:['x'.repeat(101)]},{priority:'reliable'},{minVolume:3001},{minPlaces:31},{color:'sql'}])assert.throws(()=>validateAdvisor(state));
 assert.deepEqual(validateAdvisor({shown:['001','001'],page:0,priority:'quiet',rawProducts:['hidden']}),{priority:'quiet',page:0,shown:['001']});
});
test('production chat makes zero model calls even with legacy provider configuration',async()=>{
 let calls=0;
 const route={path:'assistant/chat',req:new Request('https://app.test/assistant/chat',{method:'POST'}),user:{id:'free-assistant'},body:async()=>({message:'001',locale:'ru'}),current:async()=>({products,rules:{}}),project:()=>products,json:v=>v,fail:()=>{throw Error('unexpected');},knowledge,options:{apiKey:'legacy-key',freeTierConfirmed:true,fetcher:async()=>{calls++;throw Error('no provider calls');}}};
 const r=await assistantRoutes(route);assert.equal(calls,0);assert.equal(r.mode,'specifications');assert.equal(r.products[0].articul,'001');
});
