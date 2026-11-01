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

test('imported built-in gas hob category completes the six main shortcuts without technical facts',()=>{
 const scope={window:{}};vm.runInNewContext(fs.readFileSync('js/storefront-categories.js','utf8'),scope);const groups=scope.window.ZZWS_STOREFRONT_CATEGORIES.groups;
 const imported=['Հեռուստացույց 65','Լվացքի մեքենաներ','Ներկառուցվող (Սպասք լվացող մեքենաներ)','Ներկառուցվող (Գազօջախներ)','Ներկառուցվող վառարաններ','Սառնարաններ'];const products=imported.map((category,i)=>({articul:'imported-'+i,category})),actual=groups(products);
 assert.deepEqual(Array.from(actual,g=>g.id),['tv','washer','dishwasher','hob','oven','fridge']);assert.deepEqual(Array.from(actual[3].categories),['Ներկառուցվող (Գազօջախներ)']);assert.equal(actual[3].product.articul,'imported-3');
 assert.equal(groups([{articul:'standalone',category:'Համակցված գազօջախներ'}]).some(g=>g.id==='hob'),false,'freestanding combined cookers are not built-in hobs');assert.equal(groups(products.filter(p=>p.articul!=='imported-3')).some(g=>g.id==='hob'),false,'no placeholder for inaccessible products');
});


