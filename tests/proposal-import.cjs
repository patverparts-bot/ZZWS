const assert=require('node:assert/strict'),data=require('../js/proposal-data.js');
const lines=Array.from({length:107},(_,i)=>[String(700000+i),'Test model '+i,'',i%3+1,i===0?'17,800':1000+i,'003',999999]);
const header=['Артикул','Номенклатура','Характеристика','Количество','Цена','Склад','Сумма'];
const fromFile=data.parse([header,...lines,['','','','','','',11406330],['']]);
const fromPaste=data.parse([...lines,['','','','','','',11406330]]);
assert.equal(fromFile.length,107);assert.deepEqual(fromPaste,fromFile);assert.equal(fromFile[0].price,17800);assert.equal(fromFile[0].quantity,1);
for(const price of ['17,800','17 800','17\u00a0800','17,800.00','17.800,00','17800 ֏'])assert.equal(data.parse([['Model',2,price]])[0].price,17800,price);
assert.equal(data.parse([['Model',2,'17,80']])[0].price,17.8);
assert.deepEqual(data.parse([['001234','Test model',3,'17,800']]),[{sku:'001234',name:'Test model',quantity:3,price:17800}]);
assert.deepEqual(data.parse([['001234','Test model',3]]),[{sku:'001234',name:'Test model',quantity:3,price:null}]);
assert.throws(()=>data.parse([header,...lines.slice(0,1),[],['700001','Broken','','bad',1000,'003']]),/տող 4/);
assert.throws(()=>data.parse([header,['','','',2,1000,'003']]),/տող 2/);
assert.throws(()=>data.parse([['Model',2,'not a price']]),/տող 1/);
assert.equal(data.parse([header,...lines,['Итого','','',200,1000,'']]).length,107);
console.log('107-row exports, headerless paste, footer exclusion, formatted prices and physical error rows passed');

assert.deepEqual(data.counts([{articul:'001',quantity:2},{articul:'001',quantity:3},{articul:'002',quantity:4}]),{items:2,quantity:9});
assert.deepEqual(data.counts([]),{items:0,quantity:0});
