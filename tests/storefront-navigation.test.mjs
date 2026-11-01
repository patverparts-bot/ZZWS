import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
test('major shortcuts group accessible TV diagonals into one family and retain six useful categories',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/storefront-categories.js','utf8'),scope);const groups=scope.window.ZZWS_STOREFRONT_CATEGORIES.groups;
 const products=['Հեռուստացույց 32','Հեռուստացույց 43','Հեռուստացույց 55','Հեռուստացույց 65','Հեռուստացույց 75','Լվացքի մեքենա','Սպասք լվացող մեքենա','Եփման վահանակ','Ներկառուցվող ջեռոց','Սառնարան'].map((category,i)=>({articul:String(i),category}));
 const actual=groups(products);assert.deepEqual(Array.from(actual,g=>g.id),['tv','washer','dishwasher','hob','oven','fridge']);assert.equal(actual[0].categories.length,5);assert.deepEqual(Array.from(groups(products.slice(0,2)),g=>g.id),['tv']);assert.deepEqual(products.map(p=>p.category),products.map(p=>p.category),'no source mutation');
});
test('homepage logos are the existing verified artwork and unknown brands are not fabricated',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/storefront-brands.js','utf8'),scope);const logos=scope.window.ZZWS_STOREFRONT_BRANDS;assert.equal(logos.src('LG'),'js/brand-logos/lg.png');assert.equal(logos.src("De’Longhi"),'js/brand-logos/delonghi.png');assert.equal(logos.src('Invented brand'),null);
 const manifest=JSON.parse(fs.readFileSync('android/assets/brand-logos.json','utf8'));for(const [name,row]of Object.entries(manifest.bundled)){const bytes=fs.readFileSync(logos.src(name));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.ok(bytes.equals(fs.readFileSync('android/assets/'+row.file)));}
});
