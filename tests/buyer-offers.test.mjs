import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {buyerPriceFloor,buyerDetails,buyerInputLines,buyerOfferWorkbook,buyerPublicDetails} from '../supabase/functions/zzws-api/buyer-offers.mjs';

test('buyer floor is markup on cost, rounds up whole AMD, and avoids floating-point underpricing',()=>{
 assert.equal(buyerPriceFloor(100000,15),115000);
 assert.equal(buyerPriceFloor(100000,0),100000);
 assert.equal(buyerPriceFloor(100.01,15),116);
 assert.equal(buyerPriceFloor(100.001,0),101);
 assert.equal(buyerPriceFloor(100000.001,15),115001);
 assert.equal(buyerPriceFloor(0.1,0),1);
 for(const markup of [-1,Infinity,'15',15.001,1001])assert.throws(()=>buyerPriceFloor(100000,markup));
 for(const cost of [0,-1,Infinity,'100000'])assert.throws(()=>buyerPriceFloor(cost,15));
});
test('buyer technical detail projection excludes financial facts and untrusted links',()=>{
 const raw={sourceUrl:'https://www.zigzag.am/test.html?internalPrice=100000#private',checkedAt:'2026-11-04',wholesale:100000,facts:{unitCost:100000},specifications:[{name:'Width (cm)',value:'60'},{name:'Wholesale price',value:'100000'},{name:'Цена',value:'100000 AMD'},{name:'Մեծածախ գին',value:'100000 ֏'},{name:'Discount',value:10},{name:'Capacity',value:'8 kg'}],highlights:[{name:'Power',value:'1000 W'},{name:'Cost',value:100000}]};
 const publicData=buyerPublicDetails({articul:'001',name:'Test'},raw);
 assert.deepEqual(publicData.specifications,[{name:'Width (cm)',value:'60'},{name:'Capacity',value:'8 kg'}]);assert.deepEqual(publicData.highlights,[{name:'Power',value:'1000 W'}]);
 assert.equal(publicData.sourceUrl,'https://www.zigzag.am/test.html');assert.doesNotMatch(JSON.stringify(publicData),/wholesale|100000|unitCost|internalPrice|private/);
 for(const sourceUrl of ['javascript:alert(1)','data:text/html,test','https://user:password@example.invalid'])assert.equal(buyerPublicDetails({articul:'001',name:'Test'},{...raw,sourceUrl}).sourceUrl,null);
});
test('buyer identity is required and telephone is normalized without stripping leading digits',()=>{
 assert.deepEqual(buyerDetails({buyerName:' Test buyer ',buyerPhone:'091 123456',markupPercent:15}),{name:'Test buyer',phone:'+37491123456'});
 for(const input of [{buyerName:'',buyerPhone:'091123456',markupPercent:15},{buyerName:'Test',buyerPhone:'',markupPercent:15},{buyerName:'Test',buyerPhone:'abc',markupPercent:15},{buyerName:'bad\nname',buyerPhone:'091123456',markupPercent:15}])assert.throws(()=>buyerDetails(input));
});
test('offer input is a bounded, unique integer quantity/AMD price list',()=>{
 assert.deepEqual(buyerInputLines([{articul:'002',qty:2,salePrice:120},{articul:'001',qty:1,salePrice:115}]).map(r=>r.articul),['001','002']);
 for(const rows of [[],[{articul:'__proto__',qty:1,salePrice:10}],[{articul:'001',qty:0,salePrice:10}],[{articul:'001',qty:1,salePrice:10.5}],[{articul:'001',qty:1,salePrice:10},{articul:'001',qty:1,salePrice:10}]])assert.throws(()=>buyerInputLines(rows));
});
test('customer XLSX contains public sales data only and neutralizes formula/contact cells',()=>{
 const offer={id:'synthetic-offer',number:'ZZWS-000001',buyer:{name:'=HYPERLINK("https://example.invalid")',phone:'+37491123456'},createdAt:'2026-11-04T09:45:00Z',finalizedAt:'2026-11-04T10:45:00Z',lines:[{articul:'001234',name:'Test model',qty:2,salePrice:115000,amount:230000}],total:230000,internal_lines:[{unitCost:100000}],expectedProfit:30000};
 const book=XLSX.read(buyerOfferWorkbook(offer),{type:'array'}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json(sheet,{header:1});
 assert.equal(rows[1][1],'=HYPERLINK("https://example.invalid")');
 assert.equal(rows[2][1],'+37491123456');
 assert.equal(rows[3][1],'ZZWS-000001');assert.equal(rows[4][1],'04.11.2026 · 14:45 (Երևան)');assert.equal(rows.flat().includes(offer.id),false);
 assert.equal(rows[7][0],'001234');assert.equal(rows[7][3],115000);assert.equal(rows[7][4],230000);
 assert.equal(Object.values(sheet).some(c=>c&&typeof c==='object'&&c.f),false);
 assert.equal(rows.flat().includes(100000)||rows.flat().includes(30000),false);assert.doesNotMatch(JSON.stringify(rows),/unitCost|internal_lines|markup|floor/i);
});
