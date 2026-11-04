import test from 'node:test';import assert from 'node:assert/strict';
import {mainWarehouses,validateMainWarehouses,warehouseList,warehousePriority,DEFAULT_MAIN_WAREHOUSES} from '../functions/zzws-api/warehouses.mjs';
import {project} from '../functions/zzws-api/catalog.mjs';
import {canAccess} from '../functions/zzws-api/operations.mjs';
const client={role:'client',sheet:'Dealers',client:'Test'},admin={...client,role:'admin'};
const product={articul:'1',brand:'LG',category:'TV',name:'Model',retail:100,base:100,ws:80,kp:70,kpPromo:0,stocks:{'003':0,'050':3}};
test('legacy defaults and explicit empty selection are distinct; invalid and duplicate codes rejected',()=>{
 assert.deepEqual(mainWarehouses({}),['003','023','026','031']);assert.deepEqual(mainWarehouses({mainWarehouses:[]}),[]);
 assert.deepEqual(validateMainWarehouses(['050','003']),['003','050']);
 for(const v of [null,{},['3'],[3],[' 003'],['003','003'],['<x>']])assert.throws(()=>validateMainWarehouses(v));
});
test('classification is canonical while default and custom warehouse priorities retain business order',()=>{
 const before=[...DEFAULT_MAIN_WAREHOUSES];
 assert.deepEqual(warehousePriority({}),['003','023','031','026']);
 const config={mainWarehouses:['031','003','050'],warehousePriority:['050','031','003']},saved=structuredClone(config);
 assert.deepEqual(mainWarehouses(config),['003','031','050']);assert.deepEqual(warehousePriority(config),['050','031','003']);
 assert.deepEqual(config,saved);assert.deepEqual(DEFAULT_MAIN_WAREHOUSES,before);assert.equal(Object.isFrozen(DEFAULT_MAIN_WAREHOUSES),true);
});
test('changing classification affects visibility and quote availability while preserving quantities and price privacy',()=>{
 assert.equal(project([product],client).length,0);
 const options={mainWarehouses:['050']},shown=project([product],client,undefined,options)[0];
 assert.equal(shown.stockAvailable,true);assert.equal(shown.hasMainStock,true);assert.equal(shown.wholesale,80);
 for(const k of ['stocks','targetWarehousesStock','kpPrice'])assert.equal(Object.hasOwn(shown,k),false);
 assert.equal(project([product],admin,undefined,options)[0].targetWarehousesStock,3);
 assert.equal(project([product],client,undefined,{...options,forOrder:true})[0].stockAvailable,true);
 assert.equal(project([product],client,undefined,{mainWarehouses:[],forOrder:true})[0].stockAvailable,false);
 assert.deepEqual(product.stocks,{'003':0,'050':3});
});
test('all four original main warehouses can be reclassified; shops threshold remains unchanged',()=>{
 for(const code of DEFAULT_MAIN_WAREHOUSES){const p={...product,stocks:{[code]:3}};assert.equal(project([p],client).length,1);assert.equal(project([p],client,undefined,{mainWarehouses:[]}).length,0);}
 assert.equal(project([{...product,stocks:{'050':5}}],client,undefined,{mainWarehouses:[]}).length,1);
});
test('new price warehouses default to shops; configured missing main warehouses survive replacement',()=>{
 assert.deepEqual(warehouseList([{stocks:{'003':0,'099':0}}],['003','050']),[{code:'003',type:'main',present:true},{code:'050',type:'main',present:false},{code:'099',type:'shop',present:true}]);
 for(const role of ['manager','price','viewer','unknown'])for(const method of ['GET','POST'])assert.equal(canAccess(role,'admin/warehouses',method),false);
 assert.equal(canAccess('owner','admin/warehouses','POST'),true);
});
