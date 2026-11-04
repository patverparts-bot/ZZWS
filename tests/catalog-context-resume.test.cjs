const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const sourceRoot=process.env.ZZWS_STATIC_OVERLAY||path.resolve(__dirname,'..');
const actorId='11111111-1111-4111-8111-111111111111',customerId='22222222-2222-4222-8222-222222222222';
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.hidden=false;this.value='';this.textContent='';this.classList={contains:()=>true,toggle(){}};}
 append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}after(){}setAttribute(){}replaceChildren(...nodes){this.children=[...nodes];}querySelectorAll(){return [];}get options(){return this.children.filter(n=>n.tagName==='OPTION');}
}
function fixture(){
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},calls=[],render=[];
 const customer={id:customerId,role:'client',client:'Server buyer',customerCode:'001234',rowsList:[{id:'delivery-current'}],profileRevision:3};
 let blocked=false,quoteWait=null,catalogWait=null;
 const answer=async(route,body)=>{calls.push({route,body});if(route.startsWith('admin/orders/customers'))return {customers:[]};if(route.startsWith('admin/orders/customer-catalog')){if(catalogWait)return catalogWait();if(blocked)throw Object.assign(Error('Denied'),{status:403});return {customer:{...customer},hiddenColumns:['retail']};}if(route==='admin/orders/customer-quote'){if(quoteWait)return quoteWait();if(blocked)throw Object.assign(Error('Denied'),{status:403});return {customer:{...customer},products:body.articuls.map(articul=>({articul,wholesale:100})),unavailable:[]};}throw Error('Unexpected '+route);};
 const c={console,URLSearchParams,structuredClone,setTimeout:()=>1,clearTimeout(){},queueMicrotask,sessionStorage:{getItem:()=>c.token},token:'session-A',serverIdentity:{id:actorId,role:'admin',permissions:['orders:write']},cart:{'001234':{articul:'001234',qty:3}},modalFieldsInitialized:false,lastPriceStamp:'',catalogLoaded:true,allProducts:[],filteredProducts:[],productIndex:new Map(),selectedBrands:[],selectedCategories:[],secureApi:(route)=>answer(route),ZZWS:{json:(route,opts)=>answer(route,opts?.body?JSON.parse(opts.body):undefined),message:e=>e.message},document:{getElementById:el,createElement:tag=>new Element(tag),querySelector:()=>new Element(),querySelectorAll:()=>[]},ZZWS_ADMIN_PRICES:{clear(){}},ZZWS_COLUMNS:{render(){}},isAdminUser:()=>true,configureSortPrices(){},setupTableHeader(){},populateOrderModalFields:()=>render.push('delivery'),updateOrderPanel:()=>render.push('panel'),renderModalItems:()=>render.push('cart'),loadPriceData:async()=>render.push('own-catalog'),loadWholesaleOnlyFilter(){},reconcileFilterSelections(){},updateBrandSelectionSummary(){},updateCategorySelectionSummary(){},renderDependentFilterOptions(){},allowedSortColumns:()=>['wholesale'],getProduct:()=>null};c.window=c;
 vm.createContext(c);for(const file of ['admin-assisted-order.js','catalog-customer-view.js'])vm.runInContext(fs.readFileSync(path.join(sourceRoot,'js',file),'utf8'),c);
 c.ZZWS_ASSISTED.start(c.serverIdentity);c.ZZWS_CATALOG_VIEW.start(c.serverIdentity);
 return {c,calls,render,customer,el,block:value=>blocked=value,deferQuote:()=>new Promise(resolve=>quoteWait=()=>new Promise(release=>resolve(release))),deferCatalog:()=>new Promise(resolve=>catalogWait=()=>new Promise(release=>resolve(release)))};
}
test('catalog resume accepts only own permitted UUID context and never loads from preparation',async()=>{
 const f=fixture();await Promise.resolve();const before=f.calls.length;
 for(const value of [null,{}, {customerId:'invalid'}, {customerId:'../../secret'}])assert.equal(f.c.ZZWS_CATALOG_VIEW.prepareResume(value),false);
 assert.equal(f.c.ZZWS_CATALOG_VIEW.prepareResume({customerId,client:'Forged label',wholesale:1}),true);assert.equal(f.calls.length,before);assert.equal(f.c.ZZWS_CATALOG_VIEW.active(),true);assert.deepEqual(JSON.parse(JSON.stringify(f.c.ZZWS_CATALOG_VIEW.viewState())),{customerId});
 const data=await f.c.ZZWS_CATALOG_VIEW.fetch();assert.equal(data.customer.client,'Server buyer');assert.equal(f.c.ZZWS_CATALOG_VIEW.identity().customerCode,'001234');assert(f.calls.at(-1).route.includes(customerId));
 f.c.serverIdentity={id:'other',role:'admin',permissions:['orders:write']};assert.equal(f.c.ZZWS_CATALOG_VIEW.prepareResume({customerId}),false);
});
test('assisted resume re-quotes actual restored basket and keeps only a UUID in view state',async()=>{
 const f=fixture();assert.equal(await f.c.ZZWS_ASSISTED.restoreContext({customerId,client:'Forged',price:1}),true);assert.equal(f.c.ZZWS_ASSISTED.customer().client,'Server buyer');assert.equal(f.c.ZZWS_ASSISTED.price('001234'),100);assert.equal(f.c.ZZWS_ASSISTED.rows()[0].id,'delivery-current');
 assert.deepEqual(f.calls.find(call=>call.route==='admin/orders/customer-quote').body,{customerId,articuls:['001234']});assert.deepEqual(JSON.parse(JSON.stringify(f.c.ZZWS_ASSISTED.viewState())),{customerId});assert(!f.calls.some(call=>/create|submit|handoff/.test(call.route)));
});
test('a fresh catalog customer initializes its delivery fields once while same-customer polling preserves the draft',async()=>{
 const f=fixture();await f.c.ZZWS_ASSISTED.selectBuyer(f.customer);assert.equal(f.render.filter(value=>value==='delivery').length,1);await f.c.ZZWS_ASSISTED.selectBuyer(f.customer);assert.equal(f.render.filter(value=>value==='delivery').length,1);
});
test('revoked customer access clears catalog and assisted targets and falls back to own catalog',async()=>{
 const f=fixture();assert.equal(await f.c.ZZWS_ASSISTED.restoreContext({customerId}),true);f.c.ZZWS_CATALOG_VIEW.prepareResume({customerId});f.block(true);await assert.rejects(f.c.ZZWS_CATALOG_VIEW.fetch(),e=>e.staleCatalog);assert.equal(f.c.ZZWS_CATALOG_VIEW.active(),false);assert.equal(f.c.ZZWS_ASSISTED.active(),false);assert(f.render.includes('own-catalog'));
 const g=fixture();g.block(true);assert.equal(await g.c.ZZWS_ASSISTED.restoreContext({customerId}),false);assert.equal(g.c.ZZWS_ASSISTED.active(),false);assert.equal(g.c.ZZWS_ASSISTED.price('001234'),0);
});
test('a delayed catalog/quote response cannot repaint another actor or a replaced token',async()=>{
 const f=fixture(),quoteReady=f.deferQuote();const restoring=f.c.ZZWS_ASSISTED.restoreContext({customerId});const release=await quoteReady;f.c.serverIdentity={id:'other',role:'admin',permissions:['orders:write']};release({customer:f.customer,products:[{articul:'001234',wholesale:999}],unavailable:[]});assert.equal(await restoring,false);assert.equal(f.c.ZZWS_ASSISTED.price('001234'),0);assert.equal(f.render.length,0);
 const g=fixture();g.c.ZZWS_CATALOG_VIEW.prepareResume({customerId});const catalogReady=g.deferCatalog(),fetching=g.c.ZZWS_CATALOG_VIEW.fetch(),finish=await catalogReady;g.c.token='session-B';finish({customer:g.customer,hiddenColumns:[]});await assert.rejects(fetching,e=>e.staleCatalog);assert.equal(g.c.ZZWS_CATALOG_VIEW.identity().client,undefined);
});
test('client/viewer identity and a conflicting selected catalog cannot restore an assisted target',async()=>{
 for(const identity of [{id:actorId,role:'client',permissions:[]},{id:actorId,role:'admin',permissions:[]}]){const f=fixture();f.c.serverIdentity=identity;assert.equal(await f.c.ZZWS_ASSISTED.restoreContext({customerId}),false);assert.equal(f.c.ZZWS_CATALOG_VIEW.prepareResume({customerId}),false);}
 const f=fixture();assert.equal(f.c.ZZWS_CATALOG_VIEW.prepareResume({customerId}),true);assert.equal(await f.c.ZZWS_ASSISTED.restoreContext({customerId:'33333333-3333-4333-8333-333333333333'}),false);
});
