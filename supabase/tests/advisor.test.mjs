import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';
import {validateAdvisor, dimensions} from '../functions/zzws-api/advisor.mjs';

const rows=[
  ['010001','LG W100','Լվացքի մեքենաներ',180000,'85 x 60 x 45 cm','7'],
  ['010002','Samsung W200','Լվացքի մեքենաներ',150000,'850 x 598 x 440 mm','7'],
  ['010003','Bosch W300','Լվացքի մեքենաներ',100000,'85 x 61 x 45 cm','8'],
  ['010004','Haier W400','Լվացքի մեքենաներ',210000,'85 x 60 x 40 cm','8'],
  ['010005','Beko W500','Լվացքի մեքենաներ',120000,'85 x 60 x 45 cm','7'],
  ['010006','LG ACCESSORY','Լվացքի մեքենաների պարագաներ',5000,'85 x 60 x 45 cm','7'],
  ['020001','Bosch D100','Սպասք լվացող մեքենաներ',170000,'85 x 60 x 45 cm','7'],
  ['010007','LG W700','Լվացքի մեքենաներ',0,'85 x 60 x 45 cm','7']
];
const products=rows.map(([articul,name,category,wholesale])=>({articul,name,category,wholesale,retail:0,brand:name.split(' ')[0],kpPrice:1,stockStatus:'Առկա է'}));
const knowledge={products:Object.fromEntries(rows.map(([sku,name,,,dims,load])=>[sku,[name,'https://www.zigzag.am/en/'+sku+'.html','2026-10-30T00:00:00Z',[[sku==='010005'?'Dimensions':'Dimensions(HxWxD)',dims],['Load Capacity (kg)',load],['Motor type','Inverter']]]]))};
const ask=(message,advisor=null,visible=products)=>answerQuestion({message,advisor},visible,knowledge);

test('user example clarifies size, then budget, retaining each answer',async()=>{
  const first=await ask('Мне нужна стиральная машина недорогая, 60 сантиметров');
  assert.equal(first.mode,'selection');assert.equal(first.advisor.pending,'dimension');assert.equal(first.recommendations.length,0);assert.equal(first.advisor.dimensionValue,60);
  const second=await ask('Ширина',first.advisor);assert.equal(second.advisor.width,60);assert.equal(second.advisor.pending,'budget');assert.ok(second.answer.includes('бюджет'));
  const third=await ask('До 200 тысяч',second.advisor);assert.deepEqual(third.recommendations.map(p=>p.articul),['010001','010002','010003']);
  assert.deepEqual(third.recommendations.map(p=>p.match.kind),['exact','near','near']);
  assert.equal(third.advisor.width,60);assert.equal(third.advisor.budgetMax,200000);assert.equal(third.advisor.cheap,true);assert.equal(third.advisor.pending,undefined);
});
test('a complete request immediately offers matching products without a questionnaire',async()=>{
  const result=await ask('Стиральная машина ширина 60 см, глубина до 45 см, до 200000 драм, загрузка 7 кг');
  assert.equal(result.advisor.width,60);assert.equal(result.advisor.depth,45);assert.equal(result.advisor.capacity,7);assert.equal(result.advisor.budgetMax,200000);
  assert.deepEqual(result.recommendations.map(p=>p.articul),['010001','010002']);assert.ok(result.quickReplies.includes('Почему эти модели?'));assert.equal(result.advisor.depthMode,'max');
});
test('millimetres and labelled dimension order are parsed; unlabelled order is not guessed',()=>{
  assert.deepEqual(dimensions([{name:'Dimensions(HxWxD)',value:'850 x 598 x 440 mm'}]),{height:85,width:59.800000000000004,depth:44});
  assert.deepEqual(dimensions([{name:'Dimensions(WxDxH)',value:'60 × 45 × 85 cm'}]),{width:60,depth:45,height:85});
  assert.deepEqual(dimensions([{name:'Dimensions',value:'85 x 60 x 45 cm'}]),{});
  assert.deepEqual(dimensions([{name:'Width (cm)',value:'59.8'}]),{width:59.8});
});
test('no match leads to a specific follow-up and never silently relaxes constraints',async()=>{
  const first=await ask('Стиральная машина ширина 60 см до 80000 драм');
  assert.equal(first.advisor.pending,'relax');assert.equal(first.recommendations.length,0);assert.ok(first.quickReplies.includes('Изменить бюджет'));
  const second=await ask('Изменить бюджет',first.advisor);assert.equal(second.advisor.pending,'budget');assert.equal(second.advisor.width,60);
  const third=await ask('200000',second.advisor);assert.equal(third.advisor.width,60);assert.equal(third.advisor.budgetMax,200000);assert.equal(third.recommendations.length,3);
});
test('changing a size asks which axis and keeps the other conditions',async()=>{
  const first=await ask('Стиральная машина ширина 50 см, глубина 45 см, бюджет 200000 драм');
  const second=await ask('Изменить размер',first.advisor);assert.equal(second.advisor.pending,'dimension');
  const third=await ask('Ширина',second.advisor);assert.equal(third.advisor.pending,'dimensionValue');
  const fourth=await ask('60',third.advisor);assert.equal(fourth.advisor.width,60);assert.equal(fourth.advisor.depth,45);assert.equal(fourth.advisor.budgetMax,200000);assert.equal(fourth.recommendations.length,3);
});
test('cheap can mean lowest current permitted prices without a fixed budget',async()=>{
  const first=await ask('Недорогая стиральная машина ширина 60 см');
  const second=await ask('Самые доступные',first.advisor);assert.equal(second.advisor.budgetSkipped,true);assert.equal(second.recommendations.length,4);assert.equal(second.recommendations[0].price.amount,180000);
});
test('brand and capacity refinements preserve earlier requirements',async()=>{
  const first=await ask('Стиральная машина ширина 60 см до 220000 драм');
  const second=await ask('Загрузка от 8 кг',first.advisor);assert.deepEqual(second.recommendations.map(p=>p.articul),['010004','010003']);
  const third=await ask('Хочу LG',second.advisor);assert.equal(third.advisor.capacity,8);assert.equal(third.advisor.brand,'LG');assert.equal(third.recommendations.length,0);
});
test('switching category resets unrelated requirements',async()=>{
  const first=await ask('Стиральная машина ширина 60 см до 220000 драм');
  const second=await ask('Теперь нужна посудомоечная машина',first.advisor);assert.equal(second.advisor.category,'dishwasher');assert.equal(second.advisor.width,undefined);assert.equal(second.advisor.budgetMax,undefined);assert.deepEqual(second.recommendations.map(p=>p.articul),['020001']);
});
test('non-AMD amounts cause clarification, never an invented exchange rate',async()=>{
  for(const budget of ['до 500 долларов','до $500','до 500 usd','до 20000 рублей']) {
    const result=await ask('Стиральная машина '+budget);assert.equal(result.advisor.pending,'currency');assert.equal(result.recommendations.length,0);
  }
});
test('Armenian and English recommendation dialogue works without an external model',async()=>{
  const hy=await ask('Պետք է մատչելի լվացքի մեքենա 60 սմ');assert.equal(hy.advisor.language,'hy');assert.equal(hy.advisor.pending,'dimension');
  const hy2=await ask('Լայնություն',hy.advisor);assert.equal(hy2.advisor.pending,'budget');const hy3=await ask('մինչև 200 հազար դրամ',hy2.advisor);assert.equal(hy3.recommendations.length,3);
  const en=await ask('Need a washing machine width 60 cm budget 200000 AMD');assert.equal(en.advisor.language,'en');assert.equal(en.recommendations.length,3);
});
test('Armenian UI locale pins replies and numeric follow-ups independently of input language',async()=>{
  const first=await answerQuestion({message:'Мне нужна недорогая стиральная машина, 60 см',locale:'hy'},products,knowledge);
  assert.equal(first.advisor.language,'hy');assert.equal(/[а-яё]/i.test(first.answer),false);assert.ok(first.quickReplies.includes('Լայնություն'));
  const second=await answerQuestion({message:'Լայնություն',locale:'hy',advisor:first.advisor},products,knowledge);
  const third=await answerQuestion({message:'До 200 тысяч',locale:'hy',advisor:second.advisor},products,knowledge);
  assert.equal(third.advisor.language,'hy');assert.equal(third.recommendations.length,3);assert.equal(/[а-яё]/i.test(third.answer),false);assert.ok(third.requirementSummary.includes('Լայնություն'));
  const details=await answerQuestion({message:'Расскажи о 010001',locale:'hy'},products,knowledge);assert.equal(details.products.length,1);assert.equal(/[а-яё]/i.test(details.answer),false);
});
test('recommendations never escape visible catalogue or expose other price columns',async()=>{
  const result=await ask('Стиральная машина ширина 60 см до 200000 драм',null,[products[0]]);
  assert.deepEqual(result.recommendations.map(p=>p.articul),['010001']);assert.equal(result.recommendations[0].price.amount,180000);assert.ok(!JSON.stringify(result).includes('kpPrice'));
});
test('the deterministic dialogue does not call any model even when a free key is configured',async()=>{
  let calls=0;const result=await answerQuestion({message:'Нужна недорогая стиральная машина 60 см'},products,knowledge,{apiKey:'key',freeTierConfirmed:true,fetcher:async()=>{calls++;throw Error('No calls expected');}});
  assert.equal(result.advisor.pending,'dimension');assert.equal(calls,0);
});
test('advisor state is bounded, whitelisted and carries no prices or product permissions',()=>{
  for(const state of [[],{category:'hidden-table'},{width:-1},{width:'60'},{budgetMax:Infinity},{pending:'sql'},{language:'sql'}])assert.throws(()=>validateAdvisor(state));
  assert.deepEqual(validateAdvisor({category:'washer',width:60,products:['hidden'],price:1,user:'admin'}),{category:'washer',width:60});
});
test('real Zigzag washing-machine dimensions produce actual catalogue matches',async()=>{
  const data=JSON.parse(await readFile(new URL('../functions/zzws-api/assistant-knowledge.json',import.meta.url),'utf8'));
  const p=Object.entries(data.products).filter(([,r])=>r[3].some(([name])=>name==='Load Capacity (kg)')).map(([articul,row])=>({articul,name:row[0],brand:row[0].split(' ')[0],category:'Լվացքի մեքենաներ',wholesale:170000}));
  const result=await answerQuestion({message:'Мне нужна стиральная машина ширина до 60 см до 200000 драм'},p,data);
  assert.ok(result.recommendations.length>0);for(const product of result.recommendations){assert.ok(product.matchedDimensions.width<=60);assert.equal(product.sourceMode,'snapshot');assert.equal(product.price.amount,170000);}
});
test('full 6,970-product catalogue handles screenshot queries within the free Edge CPU budget',async()=>{
  const data=JSON.parse(await readFile(new URL('../functions/zzws-api/assistant-knowledge.json',import.meta.url),'utf8'));
  const full=Object.entries(data.products).map(([articul,row])=>({articul,name:row[0],brand:row[0].split(' ')[0],category:row[3].some(([name])=>name==='Load Capacity (kg)')?'Լվացքի մեքենաներ':'Հեռուստացույցներ',wholesale:170000}));
  assert.ok(full.length>=6970);
  const started=process.cpuUsage();
  for(const message of ['լվացք եման','հեռուստացույց եման','մատչելի լվացք','մատչելի լվացքի մեքենա 60 սմ']){
    const result=await answerQuestion({message,locale:'hy'},full,data);
    assert.equal(result.mode,'selection');assert.ok(result.answer.length>0);
    if(message.includes('մատչելի'))assert.ok(['budget','dimension'].includes(result.advisor.pending));
  }
  const cpu=process.cpuUsage(started),cpuMs=(cpu.user+cpu.system)/1000;
  assert.ok(cpuMs<1500,'Four full-catalogue queries used '+cpuMs+' ms of CPU');
});
