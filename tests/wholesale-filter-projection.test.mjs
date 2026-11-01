import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {pathToFileURL} from 'node:url';
const apiRoot=path.resolve(process.env.ZZWS_API_SOURCE_ROOT||'supabase/functions/zzws-api');
const {project}=await import(pathToFileURL(path.join(apiRoot,'catalog.mjs')));
const {defaultRules}=await import(pathToFileURL(path.join(apiRoot,'rules.mjs')));
test('actual administrator projection exposes KP Promo-only as effective kpPrice and leaves retail-only unpriced',()=>{
 const source=[{articul:'ws',ws:12,kp:0,kpPromo:0},{articul:'kp',ws:0,kp:34,kpPromo:0},{articul:'kp-promo-only',ws:0,kp:0,kpPromo:56},{articul:'retail-only',ws:0,kp:0,kpPromo:0}].map(p=>({...p,retail:1000,base:1200,name:p.articul,brand:'Fixture',category:'TV',stocks:{'003':10}}));
 const rows=project(source,{role:'admin',sheet:'Dealers'},defaultRules());assert.equal(rows.length,4);
 assert.deepEqual(rows.map(p=>[p.articul,p.wholesale,p.kpPrice,p.kpIsPromo]),[['ws',12,0,false],['kp',0,34,false],['kp-promo-only',0,56,true],['retail-only',0,0,false]]);
});
