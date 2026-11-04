import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';

const rows=[
  ['001001','LG F100','LG','Սառնարաններ',100000,[['Dimensions(HxWxD)','180 x 60 x 65 cm'],['Total volume(l)','300 l'],['Noise level (dB)','42'],['Compressor type','Standard'],['Refrigerator','Drip'],['Freezer','Manual']]],
  ['001002','Samsung F200','Samsung','Սառնարաններ',180000,[['Dimensions(HxWxD)','180 x 60 x 65 cm'],['Total volume(l)','350 l'],['Noise level (dB)','38'],['Compressor type','Inverter'],['Refrigerator','NoFrost'],['Freezer','NoFrost']]],
  ['001003','Bosch F300','Bosch','Սառնարաններ',200000,[['Dimensions(HxWxD)','180 x 59 x 65 cm'],['Total volume(l)','400 l'],['Noise level (dB)','35'],['Compressor type','Inverter'],['Refrigerator','NoFrost'],['Freezer','NoFrost']]],
  ['001004','Haier F400','Haier','Սառնարաններ',220000,[['Dimensions(HxWxD)','180 x 70 x 65 cm'],['Total volume(l)','450 l'],['Noise level (dB)','40'],['Compressor type','Standard'],['Refrigerator','NoFrost'],['Freezer','NoFrost']]],
  ['001005','Beko F500','Beko','Սառնարաններ',230000,[['Dimensions(HxWxD)','180 x 60 x 65 cm'],['Total volume(l)','420 l'],['Noise level (dB)','41'],['Compressor type','Standard'],['Refrigerator','NoFrost'],['Freezer','NoFrost']]],
  ['002001','Samsung T100','Samsung','Հեռուստացույցներ',100000,[['Diagonal','55 inch'],['Smart TV supported','No'],['Resolution (px)','1920 x 1080']]],
  ['002002','LG T200','LG','Հեռուստացույցներ',200000,[['Diagonal','65 inch'],['Smart TV supported','Yes'],['Resolution (px)','3840 x 2160']]],
  ['003001','Bosch D100','Bosch','Սպասք լվացող մեքենաներ',150000,[['Maximum Capacity (set)','12'],['Dimensions(HxWxD)','85 x 60 x 60 cm']]],
  ['004001','Samsung M100','Samsung','Միկրոալիքային վառարաններ',60000,[['Volume (l)','25 l'],['Dimensions(HxWxD)','30 x 50 x 40 cm']]],
  ['005001','Bosch W100','Bosch','Լվացքի մեքենաներ',180000,[['Load Capacity (kg)','8'],['Dimensions(HxWxD)','85 x 60 x 45 cm'],['Motor type','Inverter']]],
  ['005002','LG W200','LG','Լվացքի մեքենաներ',190000,[['Load Capacity (kg)','8'],['Dimensions(HxWxD)','85 x 61 x 45 cm'],['Motor type','Inverter']]]
];
const products=rows.map(([articul,name,brand,category,wholesale])=>({articul,name,brand,category,wholesale}));
const knowledge={products:Object.fromEntries(rows.map(([sku,name,,,,specs])=>[sku,[name,'https://www.zigzag.am/en/'+sku+'.html','2026-11-04T00:00:00Z',specs]]))};
const ask=(message,{locale='ru',advisor=null,context=[]}={})=>answerQuestion({message,locale,advisor,context},products,knowledge);
const ids=result=>(result.recommendations||[]).map(p=>p.articul);
const selection=result=>({advisor:result.advisor,ids:ids(result),publicIds:(result.publicRecommendations||[]).map(p=>p.articul),products:result.products.map(p=>p.articul),context:result.context,summary:result.requirementSummary});
async function equivalent(clean,misspelled,options){
  const expected=await ask(clean,options),actual=await ask(misspelled,options);
  assert.deepEqual(selection(actual),selection(expected),misspelled);
  return actual;
}

test('Russian category typos retain the same verified selection and budget',async()=>{
  for(const typo of ['Халадильник','Холдильник']){
    const result=await equivalent('Холодильник до 230 тысяч драм',typo+' до 230 тысяч драм');
    assert.equal(result.advisor.category,'fridge');
    assert.equal(result.advisor.budgetMax,230000);
    assert.ok(ids(result).length>0);
  }
  const microwave=await equivalent('Микроволновка до 100 тысяч драм','Микраволновка до 100 тысяч драм');
  assert.equal(microwave.advisor.category,'microwave');
  assert.deepEqual(ids(microwave),['004001']);
});

test('English, Armenian and transliterated category typos follow the requested language',async()=>{
  for(const [clean,typo,locale,category]of [
    ['Fridge up to 230 thousand AMD','Frdige up to 230 thousand AMD','en','fridge'],
    ['Dishwasher up to 200 thousand AMD','Dishwacher up to 200 thousand AMD','en','dishwasher'],
    ['Սառնարան մինչև 230 հազար դրամ','Սառնարն մինչև 230 հազար դրամ','hy','fridge'],
    ['holodilnik до 230 тысяч драм','holadilnik до 230 тысяч драм','ru','fridge']
  ]){
    const result=await equivalent(clean,typo,{locale});
    assert.equal(result.advisor.category,category);
    assert.equal(result.advisor.language,locale);
    assert.equal(result.advisor.budgetMax,locale==='en'&&category==='dishwasher'?200000:230000);
    assert.ok(ids(result).length>0);
  }
});

test('misspelled functions preserve positive and negated requirements',async()=>{
  const frost=await equivalent('Холодильник No Frost','Холодильник no frsot');
  assert.equal(frost.advisor.noFrost,true);
  assert.equal(ids(frost).includes('001001'),false);
  const noFrost=await equivalent('Холодильник без No Frost','Холодильник без no frsot');
  assert.equal(noFrost.advisor.noFrost,false);
  assert.deepEqual(ids(noFrost),['001001']);
  const noSmart=await equivalent('Телевизор без смарт','Телевизор без самрт');
  assert.equal(noSmart.advisor.smart,false);
  assert.deepEqual(ids(noSmart),['002001']);
  const noInverter=await equivalent('Холодильник без инвертора','Холодильник без инвертара');
  assert.equal(noInverter.advisor.inverter,false);
  assert.deepEqual(ids(noInverter),['001001','001004','001005']);
});

test('dimension typos keep hard space limits and numeric load and budget values',async()=>{
  const result=await equivalent(
    'Стиральная машина ширина не больше 60 см, загрузка 8 кг, до 200 тысяч драм',
    'Стиральная машина ширниа не больше 60 см, загрузка 8 кг, до 200 тысяч драм'
  );
  assert.equal(result.advisor.width,60);
  assert.equal(result.advisor.widthMode,'max');
  assert.equal(result.advisor.capacity,8);
  assert.equal(result.advisor.budgetMax,200000);
  assert.deepEqual(ids(result),['005001']);
  for(const product of result.recommendations)assert.ok(product.matchedDimensions.width<=60);
});

test('brand misspellings restrict recommendations to that catalogue brand',async()=>{
  const result=await equivalent('Холодильник Bosch до 230 тысяч драм','Холодильник Bossh до 230 тысяч драм');
  assert.equal(result.advisor.brand,'Bosch');
  assert.deepEqual(ids(result),['001003']);
});

test('misspelled follow-ups preserve the selection and paginate without duplicates',async()=>{
  const first=await ask('Холодильник до 230 тысяч драм');
  assert.equal(ids(first).length,3);
  const more=await equivalent('Покажи ещё','Покажи еше',{advisor:first.advisor});
  assert.equal(more.advisor.page,1);
  assert.equal(more.advisor.budgetMax,230000);
  assert.ok(ids(more).length>0);
  assert.equal(ids(more).some(id=>ids(first).includes(id)),false);
  const why=await equivalent('Почему эти модели?','Пачему эти модели?',{advisor:more.advisor});
  assert.equal(why.advisor.page,1);
  assert.deepEqual(ids(why),ids(more));
  const compared=await equivalent('Сравни эти модели','Сравн эти модели',{advisor:first.advisor});
  assert.deepEqual(compared.products.map(p=>p.articul),ids(first).slice(0,2));
  const detail=await equivalent('Расскажи подробнее о второй модели','Расскажи подробнее о втрой модели',{advisor:first.advisor});
  assert.deepEqual(detail.products.map(p=>p.articul),[ids(first)[1]]);
});

test('typo correction never substitutes exact model suffixes or article codes',async()=>{
  const models=[
    {articul:'000123',name:'Bosch AB123 Black',brand:'Bosch',category:'Phone'},
    {articul:'000124',name:'Bosch AB123 White',brand:'Bosch',category:'Phone'},
    {articul:'000125',name:'Bosch AB123A',brand:'Bosch',category:'Phone'},
    {articul:'XTEST',name:'Acme FRDIGE',brand:'Acme',category:'Phone'}
  ];
  const modelKnowledge={products:Object.fromEntries(models.map(p=>[p.articul,[p.name,'https://www.zigzag.am/en/'+p.articul+'.html','2026-11-04T00:00:00Z',[['Color','Black']]]]))};
  const query=(message,context=[])=>answerQuestion({message,locale:'ru',context},models,modelKnowledge);
  for(const [message,expected]of [['Характиристики 000125','000125'],['Характиристики AB123A','000125'],['Acme FRDIGE','XTEST']]){
    const result=await query(message);
    assert.deepEqual(result.products.map(p=>p.articul),[expected]);
  }
  const ambiguous=await query('AB123');
  assert.equal(ambiguous.products.length,0);
  assert.deepEqual(ambiguous.choices.map(p=>p.articul),['000123','000124']);
  for(const message of ['AB123B','000126','125']){
    const result=await query(message,['000125']);
    assert.equal(result.products.length,0,message);
    assert.equal(ids(result).length,0,message);
  }
});

test('misspelled requests cannot retrieve products outside the visible catalogue',async()=>{
  const result=await answerQuestion({message:'Халадильник Bossh до 230 тысяч драм',locale:'ru'},products.filter(p=>p.articul!=='001003'),{products:{}},{publicCatalog:{products:{}}});
  assert.equal(result.products.length,0);
  assert.equal(ids(result).length,0);
  assert.equal(JSON.stringify(result).includes('Bosch F300'),false);
});
