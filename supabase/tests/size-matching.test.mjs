import test from 'node:test';
import assert from 'node:assert/strict';
import {matchDimensions} from '../functions/zzws-api/size-matching.mjs';
import {answerQuestion} from '../functions/zzws-api/assistant.mjs';
import {validateAdvisor} from '../functions/zzws-api/advisor.mjs';

const state=(category='washer')=>({category,width:60,widthMode:'target'});
test('exact numerical dimensions precede near dimensions and never hide the differences',()=>{
  const exact=matchDimensions(state(),{width:60}),near=matchDimensions(state(),{width:59.8});
  assert.equal(exact.kind,'exact');assert.equal(exact.distance,0);assert.equal(near.kind,'near');
  assert.deepEqual(near.deviations,[{field:'width',requested:60,actual:59.8,difference:-.2,unit:'cm'}]);
});
test('near-size ranges reflect the appliance category',()=>{
  for(const width of [57,59.8,61,63])assert.equal(matchDimensions(state(),{width}).accepted,true);
  for(const width of [56.9,63.1,65])assert.equal(matchDimensions(state(),{width}).accepted,false);
  assert.equal(matchDimensions(state('fridge'),{width:65}).accepted,true);
  assert.equal(matchDimensions(state('dishwasher'),{width:61}).accepted,true);
  assert.equal(matchDimensions(state('dishwasher'),{width:61.1}).accepted,false);
  assert.equal(matchDimensions({category:'laptop',height:2,heightMode:'target'},{height:3}).accepted,false);
});
test('explicit maximum, minimum, exact dimensions and old maximum-only conversations are not relaxed',()=>{
  assert.equal(matchDimensions({...state(),widthMode:'max'},{width:60.1}).accepted,false);
  assert.equal(matchDimensions({...state(),widthMode:'min'},{width:59.9}).accepted,false);
  assert.equal(matchDimensions({...state(),widthMode:'exact'},{width:59.8}).accepted,false);
  assert.equal(matchDimensions({category:'washer',width:60},{width:61}).accepted,false);
  assert.equal(matchDimensions({...state(),widthMode:'max'},{width:45}).accepted,true);
});
test('unknown dimensions are excluded rather than inferred',()=>{
  assert.deepEqual(matchDimensions(state(),{}),{accepted:false,unconfirmed:true});
});
const products=[60,59.8,61,63,65].map((width,i)=>({articul:'10000'+i,name:'Machine X'+i,brand:'Machine',category:'Լվացքի մեքենաներ',wholesale:[190000,150000,100000,180000,170000][i]}));
const knowledge={products:Object.fromEntries(products.map((p,i)=>[p.articul,[p.name,'https://www.zigzag.am/en/'+p.articul+'.html','2026-10-30T00:00:00Z',[['Dimensions(HxWxD)','85 x '+[60,59.8,61,63,65][i]+' x 45 cm']]]]))};
test('real selection ranks exact first, near by closeness, then price; budget and permissions remain hard',async()=>{
  // Exercise ranking with a recognized category request, not the unsupported-followup guard.
  const result=await answerQuestion({message:'Լվացքի մեքենա',advisor:{category:'washer',width:60,widthMode:'target',budgetMax:200000},locale:'hy'},products,knowledge);
  assert.deepEqual(result.recommendations.map(p=>p.articul),['100000','100001','100002','100003']);
  assert.deepEqual(result.recommendations.map(p=>p.match.kind),['exact','near','near','near']);
  const restricted=await answerQuestion({message:'Նույնը',advisor:result.advisor,locale:'hy'},[products[1]],knowledge);
  assert.deepEqual(restricted.recommendations.map(p=>p.articul),['100001']);
  const budget=await answerQuestion({message:'Մինչև 120000 դրամ',advisor:result.advisor,locale:'hy'},products,knowledge);
  assert.deepEqual(budget.recommendations.map(p=>p.articul),['100002']);
});
test('an unrecognized followup requests clarification without bypassing the saved size constraints',async()=>{
  const result=await answerQuestion({message:'Ստիրալ մեքենա',advisor:{category:'washer',width:60,widthMode:'target',budgetMax:200000},locale:'hy'},products,knowledge);
  assert.deepEqual(result.recommendations,[]);assert.equal(result.advisor.category,'washer');assert.equal(result.advisor.width,60);assert.equal(result.advisor.widthMode,'target');assert.equal(result.advisor.budgetMax,200000);assert.ok(result.answer.length>0);
});
test('the parser distinguishes requested size from a space limit in all supported languages',async()=>{
  for(const message of ['Стиральная машина ширина до 60 см','Стиральная машина не шире 60 см','Стиральная машина в нишу 60 см по ширине','Washing machine width up to 60 cm','Լվացքի մեքենա լայնությունը մինչև 60 սմ']){
    const r=await answerQuestion({message,locale:'hy'},products,knowledge);assert.equal(r.advisor.widthMode,'max',message);assert.ok(r.recommendations.every(p=>p.matchedDimensions.width<=60),message);
  }
  const target=await answerQuestion({message:'Լվացքի մեքենա լայնություն 60 սմ',locale:'hy'},products,knowledge);assert.equal(target.advisor.widthMode,'target');assert.ok(target.recommendations.some(p=>p.matchedDimensions.width>60));
});
test('dimension matching modes are validated as bounded preference data',()=>{
  assert.throws(()=>validateAdvisor({width:60,widthMode:'allow-all'}));
  assert.deepEqual(validateAdvisor({width:60,widthMode:'target'}),{widthMode:'target',width:60});
});
