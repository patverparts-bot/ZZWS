import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import XLSX from '../supabase/functions/zzws-api/vendor/xlsx.mjs';
import {styledBuyerOfferWorkbook} from '../supabase/functions/zzws-api/buyer-offer-workbook.mjs';

const fixture=()=>({id:'8c1605e9-923e-4e59-a071-006aeb235914',number:'ZZWS-000042',buyer:{name:'Անի Գրիգորյան · Գնորդի կազմակերպության երկար անվանումը '.repeat(4).slice(0,200),phone:'+37491123456'},createdAt:'2026-11-04T09:45:00Z',finalizedAt:'2026-11-04T10:45:00Z',lines:[{articul:'000012345678901234',name:'DeLonghi · Բարձրորակ ապակյա բաժակների հավաքածու սուրճի և թեյի համար '.repeat(5),qty:9999,salePrice:10000000000,amount:99990000000000},{articul:'00000022',name:'Стиральная машина Bosch · длинное наименование с техническими характеристиками '.repeat(5),qty:2,salePrice:115000,amount:230000}],total:99990000230000,expectedProfit:9000000,internal_lines:[{unitCost:100000}]});
function inspect(offer=fixture()){
 const bytes=styledBuyerOfferWorkbook(offer),zip=XLSX.CFB.read(bytes,{type:'buffer'}),part=name=>{const paths=zip.FullPaths.map((path,i)=>({path,i})).filter(({path})=>path.endsWith('/'+name));assert.equal(paths.length,1,'ZIP must contain exactly one '+name);return new TextDecoder().decode(zip.FileIndex[paths[0].i].content);};
 return {bytes,book:XLSX.read(bytes,{type:'array',cellStyles:true}),sheetXml:part('xl/worksheets/sheet1.xml'),styles:part('xl/styles.xml'),workbookXml:part('xl/workbook.xml')};
}
test('saved buyer workbook has one clear five-column layout with literal buyer and SKU identifiers',()=>{
 const offer=fixture(),{book,sheetXml}=inspect(offer);assert.deepEqual(book.SheetNames,['Առաջարկ']);const sheet=book.Sheets['Առաջարկ'];
 assert.equal(sheet.B2.v,offer.buyer.name);assert.equal(sheet.B3.v,offer.buyer.phone);assert.equal(sheet.B3.t,'s');assert.equal(sheet.B4.v,offer.number);assert.equal(sheet.B5.v,'04.11.2026 · 14:45 (Երևան)');assert.ok(!sheetXml.includes(offer.id),'Internal offer UUID must not appear in the customer workbook');
 assert.equal(sheet.A8.v,'000012345678901234');assert.equal(sheet.A8.t,'s');assert.equal(sheet.A8.z,'@');assert.equal(sheet.C8.v,9999);assert.equal(sheet.D8.v,10000000000);assert.equal(sheet.E8.v,99990000000000);assert.equal(sheet.D8.z,'#,##0');assert.equal(sheet.E11.v,offer.total);
 assert.deepEqual([...sheetXml.matchAll(/<col min="\d+" max="\d+" width="(\d+)"/g)].map(m=>Number(m[1])),[18,65,12,20,22]);
 for(const ref of ['A1:E1','B2:E2','B3:E3','B4:E4','B5:E5','A11:D11'])assert.ok(sheetXml.includes('ref="'+ref+'"'));
 assert.doesNotMatch(sheetXml,/expectedProfit|unitCost|<f[\s>]/);assert.equal(Object.values(sheet).some(cell=>cell&&cell.t==='n'&&[9000000,100000].includes(cell.v)),false);
});

test('offer date uses finalization time with Yerevan timezone and never invents a one-hour adjustment',()=>{
 const offer=fixture(),date=value=>inspect({...offer,finalizedAt:value}).book.Sheets['Առաջարկ'].B5.v;
 assert.equal(date('2026-11-04T09:45:00Z'),'04.11.2026 · 13:45 (Երևան)');
 assert.equal(date('2026-11-04T10:45:00Z'),'04.11.2026 · 14:45 (Երևան)');
 assert.equal(date('2026-11-04T21:45:00Z'),'05.11.2026 · 01:45 (Երևան)');
 assert.equal(inspect({...offer,number:undefined}).book.Sheets['Առաջարկ'].B4.v,'—','Missing public number must never fall back to an internal UUID');
});
test('wrap, height, fonts and borders persist in serialized OOXML rather than only JS cell objects',()=>{
 const {sheetXml,styles}=inspect();const xfs=styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].match(/<xf\b[^>]*>[\s\S]*?<\/xf>/g);
 for(const ref of ['A7','B7','C7','D7','E7','A8','B8','B9','B2']){const index=Number(sheetXml.match(new RegExp('<c r="'+ref+'" s="(\\d+)"'))[1]);assert.match(xfs[index],/wrapText="1"/);}
 assert.match(xfs[4],/fontId="3" fillId="2" borderId="1"/);assert.match(styles,/<color rgb="FFFFFFFF"\/>/);assert.match(xfs[9],/fontId="4" fillId="4" borderId="2"/);
 const height=ref=>Number(sheetXml.match(new RegExp('<row r="'+ref+'" ht="([\\d.]+)" customHeight="1"'))[1]);assert.ok(height(2)>=42);assert.ok(height(8)>=90);assert.ok(height(9)>=90);assert.equal(height(7),42);
 const long=fixture();long.lines[0].name='Երկար անուն '.repeat(100).slice(0,1000);const taller=inspect(long).sheetXml;const h=Number(taller.match(/<row r="8" ht="([\d.]+)"/)[1]);assert.ok(h>=300&&h<=409);
});
test('print and navigation settings survive in worksheet and workbook XML',()=>{
 const {sheetXml,workbookXml}=inspect();assert.match(sheetXml,/<pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"\/>/);assert.match(sheetXml,/<sheetView[^>]*showGridLines="0"/);
 assert.match(sheetXml,/<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"\/>/);assert.match(sheetXml,/<pageSetUpPr fitToPage="1"\/>/);assert.match(workbookXml,/_xlnm.Print_Area/);assert.match(workbookXml,/\$A\$1:\$E\$13/);assert.match(workbookXml,/_xlnm.Print_Titles/);assert.match(workbookXml,/\$7:\$7/);
});
test('text values cannot become spreadsheet formulas and runtime export works without Node Buffer',()=>{
 const offer=fixture();offer.buyer.name='=HYPERLINK("https://example.invalid")';offer.lines[0].name='@SUM(1,2)';const {book,sheetXml}=inspect(offer);assert.equal(book.Sheets['Առաջարկ'].B2.v,offer.buyer.name);assert.equal(book.Sheets['Առաջարկ'].B2.t,'s');assert.equal(book.Sheets['Առաջարկ'].B8.v,'@SUM(1,2)');assert.doesNotMatch(sheetXml,/<f[\s>]/);
 const code=`globalThis.Buffer=undefined; const {styledBuyerOfferWorkbook}=await import('./supabase/functions/zzws-api/buyer-offer-workbook.mjs');const {default:X}=await import('./supabase/functions/zzws-api/vendor/xlsx.mjs');const b=styledBuyerOfferWorkbook(${JSON.stringify(offer)});const w=X.read(b,{type:'array'});console.log(JSON.stringify({sheets:w.SheetNames,phone:w.Sheets['Առաջարկ'].B3.v}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),{sheets:['Առաջարկ'],phone:offer.buyer.phone});
});
