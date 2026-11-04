import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const source=fs.readFileSync(new URL('../js/price-categories.js',import.meta.url),'utf8');
const require=createRequire(import.meta.url),allocation=require('../js/warehouse-allocation.js');
function fixture(){
 const listeners=new Map(),events=[],document={createElement:tag=>({tagName:tag.toUpperCase(),dataset:{},textContent:'',value:'',disabled:false})};
 const window={ZZWS_I18N:{t:value=>'ru:'+value},addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent(event){events.push(event.type);listeners.get(event.type)?.(event);}};
 vm.runInNewContext(source,{window,document,CustomEvent:class{constructor(type){this.type=type;}}});
 return {api:window.ZZWS_PRICE_CATEGORIES,events,window,language:()=>listeners.get('zzws:languagechange')(),select:()=>({value:'Dealers',options:[],replaceChildren(...options){this.options=options;}})};
}
test('renaming and adding categories updates the shared options without changing stable identifiers',()=>{
 const {api,events,select}=fixture(),picker=select();
 api.configure([{id:'Dealers',label:'Retail network'},{id:'KP',label:'Large partners'},{id:'cat_new',label:'New category'}]);
 api.populate(picker,{selected:'cat_new'});assert.deepEqual(picker.options.map(o=>[o.value,o.textContent]),[['Dealers','Retail network'],['KP','Large partners'],['cat_new','New category']]);assert.equal(picker.value,'cat_new');
 api.configure([{id:'Dealers',label:'Renamed network'},{id:'KP',label:'Large partners'},{id:'cat_new',label:'Renamed category'}]);api.populate(picker);assert.equal(picker.value,'cat_new');assert.equal(picker.options[2].textContent,'Renamed category');assert.equal(api.label('WS'),'Renamed network');assert.equal(api.normalize('WS'),'Dealers');assert.equal(events.length,2);
 api.configure(api.choices());assert.equal(events.length,2,'same catalog metadata does not invalidate active screens');
});
test('removed categories stay visibly unavailable instead of silently becoming another price category',()=>{
 const {api,select}=fixture(),picker=select();api.configure([{id:'cat_old',label:'Prior negotiated group'}]);api.populate(picker,{selected:'cat_old'});api.configure([]);api.populate(picker);
 assert.equal(api.normalize('cat_old'),'cat_old');assert.equal(picker.value,'cat_old');assert.equal(picker.options.at(-1).disabled,true);assert.match(picker.options.at(-1).textContent,/Prior negotiated group/);
 api.reset();assert.equal(api.label('cat_old'),'cat_old','logout clears prior account labels');assert.equal(api.normalize('not a category'),'Dealers');
});
test('custom category labels are literal text; defaults can translate and values remain language independent',()=>{
 const {api,select,language,events}=fixture(),picker=select();api.configure([{id:'cat_safe',label:'<img src=x onerror=alert(1)> Մեծածախ'}]);api.populate(picker,{selected:'cat_safe'});assert.equal(picker.options.find(o=>o.value==='cat_safe').textContent,'<img src=x onerror=alert(1)> Մեծածախ');assert.equal(picker.options.find(o=>o.value==='cat_safe').dataset.i18nSkip,'true');assert.match(api.label('Dealers'),/^ru:/);language();assert.equal(events.at(-1),'zzws:price-categories');assert.equal(picker.value,'cat_safe');
 const legacy=select();api.populate(legacy,{selected:'Dealers',legacyWS:true});assert.equal(legacy.value,'WS');assert.ok(legacy.options.some(option=>option.value==='WS'));
});
test('warehouse allocation uses every projected category and never invents a custom-group fallback',()=>{
 const rows=[{sku:'100',name:'Test',quantity:2,valid:true}],product={articul:'100',name:'Test',stockStatus:'003: 5',wholesale:90,kpPrice:80,stockPickerPrices:{Dealers:90,KP:80,cat_new:75}};
 assert.equal(allocation.allocate(rows,[product],false,'cat_new',['003'])[0].price,75);
 assert.equal(allocation.allocate(rows,[{...product,stockPickerPrices:{cat_new:null}}],false,'cat_new',['003'])[0].price,null);
 assert.equal(allocation.allocate(rows,[{...product,stockPickerPrices:undefined}],false,'cat_new',['003'])[0].price,null);
 assert.throws(()=>allocation.allocate(rows,[product],false,'bad group',['003']),/Invalid price group/);
});

test('audit price-category changes use current registry names including added categories as plain text',()=>{
 const {api,window}=fixture();api.configure([{id:'Dealers',label:'Renamed dealer'},{id:'KP',label:'Large buyer'},{id:'cat_new',label:'<b>Custom group</b>'}]);
 vm.runInNewContext(fs.readFileSync(new URL('../admin/audit.js',import.meta.url),'utf8'),{window,Intl,Date,Map,JSON,Number,String});
 const rows=[{id:1,action:'user_update',created:1,actor:'test',detail:JSON.stringify({target:{login:'fixture'},changes:['Группа цен: Dealers → KP → cat_new']})}];
 const described=window.ZZWS_AUDIT.describe(rows,[],[])[0];assert.match(described.description,/Renamed dealer → Large buyer → <b>Custom group<\/b>/);assert.ok(described.categoryNames.includes('<b>Custom group</b>'));
 api.configure([{id:'Dealers',label:'Later renamed'},{id:'KP',label:'Large buyer'},{id:'cat_new',label:'New name'}]);
 const current=window.ZZWS_AUDIT.describe(rows,[],[])[0];assert.match(current.description,/Later renamed → Large buyer → New name/);assert.equal(current.description.includes('<b>'),false);
 const rules=window.ZZWS_AUDIT.describe([{id:2,action:'rules_update',created:1,detail:'{}'}],[],[])[0];assert.doesNotMatch(rules.description,/Խոշոր \/ մշտական/);
});
