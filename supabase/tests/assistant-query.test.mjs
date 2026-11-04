import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAssistantQuery} from '../functions/zzws-api/assistant-query.mjs';
import {classifyCategory,FAMILY_LABELS,KIND_LABELS} from '../functions/zzws-api/appliance-taxonomy.mjs';

test('query spelling handles deletion, insertion, substitution, transposition and two errors in a long word',()=>{
 for(const word of ['холдильник','холодильнник','халадильник','холодлиьник','халодилник'])assert.equal(normalizeAssistantQuery(word),'холодильник',word);
 assert.equal(normalizeAssistantQuery('frdige no frsot'),'fridge no frost');
 assert.equal(normalizeAssistantQuery('holadilnik'),'холодильник');
});

test('ambiguous corrections and unrelated unknown input remain unchanged',()=>{
 assert.equal(normalizeAssistantQuery('Marso',{brands:['Marlo','Marto']}),'Marso');
 assert.equal(normalizeAssistantQuery('Analog fridge',{brands:['Analog']}),'Analog fridge');
 assert.equal(normalizeAssistantQuery('abracadabra qwertyxyz'),'abracadabra qwertyxyz');
 assert.equal(normalizeAssistantQuery('до от не ни без no not without առանց'),'до от не ни без no not without առանց');
 assert.equal(normalizeAssistantQuery('неинверторный uncapsule'),'неинверторный uncapsule');
});

test('identifiers, numeric values, punctuation and explicitly protected model words are preserved',()=>{
 const query='FRDIGE AB123B 000126 8kg 4K 8/256GB X-TEST 59,5 см; до 230 000 ֏';
 assert.equal(normalizeAssistantQuery(query,{protectedTerms:['FRDIGE']}),query);
 assert.equal(normalizeAssistantQuery('Bosch Samsung LG Սառնարան Холодильник width price lower'),'Bosch Samsung LG Սառնարան Холодильник width price lower');
 for(const query of ['wine cooler','hair dryer','meat grinder','Նույն տարբերակները'])assert.equal(normalizeAssistantQuery(query),query);
 for(const label of [...Object.values(FAMILY_LABELS),...Object.values(KIND_LABELS)].flat())assert.equal(normalizeAssistantQuery(label),label);
});

test('catalogue classification stays exact and never inherits user-query spelling guesses',()=>{
 assert.equal(classifyCategory('frdige').family,'other');
 assert.equal(classifyCategory('халадильник').family,'other');
 assert.equal(classifyCategory('Սառնարաններ').family,'fridge');
});
