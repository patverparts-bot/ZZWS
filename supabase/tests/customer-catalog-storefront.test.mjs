import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {orderRoutes} from '../functions/zzws-api/order-routes.mjs';
import {project} from '../functions/zzws-api/catalog.mjs';

const customerId='11111111-1111-4111-8111-111111111111',adminId='22222222-2222-4222-8222-222222222222';
function fixture(options={}){
 const raw=(articul,brand,ws,kp,kpPromo,stocks={'003':4})=>({articul,brand,category:'TV',name:brand+' '+articul,retail:150,base:170,ws,kp,kpPromo,stocks});
 const profile={role:'client',client:'Selected customer',customerCode:'001234 Խանութ / Shop',sheet:'KP',brands:['LG'],allBrands:false,allowResale:false,rowsList:[]};
 const user={id:adminId,role:'admin',permissions:['orders:write'],...options.user};
 const catalog={id:'catalog-r1',created:'2026-11-04T00:00:00Z',rulesRevision:'price-r2',warehouseRevision:'warehouse-r3',mainWarehouses:['003'],products:[raw('000001','LG',80,70,65),raw('000002','LG',90,85,0),raw('000003','Samsung',20,15,0),raw('000004','LG',40,35,0),raw('000005','LG',50,45,0,{'003':0,'025':5})],catalogControls:{global:{search:false,promo:false},users:{[customerId]:{search:true,brand:false}},popularityRules:{days:21},storefront:{newDays:12,bannerSeconds:11,pinned:['000002','000003','000005','000099'],excluded:['000004'],sections:{contacts:{enabled:true,hy:'Երևան',ru:'Yerevan'},terms:{enabled:false,hy:'Hidden policy',ru:''}}}}};
 const database={users:[{id:customerId,active:true,customer_id:null,profile_revision:7,profile:{...profile,...options.profile},...options.customer}],user_memory:[{user_id:customerId,data:{preferences:{hiddenColumns:['retail','marginVal','privateCost']}}}],catalog_bulletins:[],orders:options.orders||[],admin_order_reads:options.reads||[]};
 const ranking=[{articul:'000001',orders:50,customers:7,personal_orders:9,customer_id:'PRIVATE'},{articul:'000003',orders:999},{articul:'000004',orders:900},{articul:'000005',orders:800},{articul:'000099',orders:700}];
 const calls=[],writes=[];
 const read=(row,key)=>key.split('->>').reduce((value,part)=>value?.[part],row);
 const table=name=>{
  const filters=[];let single=false;
  const chain={select(){return chain;},eq(key,value){filters.push(row=>read(row,key)===value);return chain;},is(key,value){filters.push(row=>read(row,key)===value);return chain;},in(key,values){filters.push(row=>values.includes(read(row,key)));return chain;},order(){return chain;},limit(){return chain;},maybeSingle(){single=true;return chain;},then(resolve,reject){try{assert.ok(Object.hasOwn(database,name),'Unexpected table: '+name);const rows=database[name].filter(row=>filters.every(filter=>filter(row)));resolve({data:single?rows[0]||null:structuredClone(rows),error:null});}catch(error){reject(error);}},update(){writes.push(name);throw Error('GET must never write');}};return chain;
 };
 const context={path:'admin/orders/customer-catalog',req:new Request('https://fixture.invalid/admin/orders/customer-catalog?customerId='+customerId),user,table,query:async value=>{const result=await value;if(result.error)throw result.error;return result.data;},service:{rpc(name,args){assert.equal(name,'zzws_storefront_popularity');calls.push({name,args:structuredClone(args)});return Promise.resolve({data:structuredClone(ranking),error:null});}},current:async()=>catalog,project,body:async()=>{throw Error('GET must not read a request body');},json:data=>data,file:(rows,filename)=>({rows,filename}),fail:(status,message)=>{throw Object.assign(Error(message),{status});}};
 return {context,profile,catalog,database,calls,writes};
}

test('selected-customer catalogue carries filtered storefront settings without exposing ranking or admin prices',async()=>{
 const f=fixture(),result=await orderRoutes(f.context);
 assert.deepEqual(result.products.map(p=>p.articul),['000001','000002','000004','000005']);
 assert.deepEqual(result.products.map(p=>p.wholesale),[65,85,35,45]);
 for(const product of result.products)for(const key of ['stocks','ws','kp','kpPrice','kpPromo','targetWarehousesStock','resaleWholesale'])assert.equal(Object.hasOwn(product,key),false,key);
 assert.deepEqual(result.storefront.banners,['000002','000001']);assert.deepEqual(result.storefront.manualBanners,['000002']);assert.equal(result.storefront.newDays,12);assert.equal(result.storefront.bannerSeconds,11);
 assert.deepEqual(result.storefront.sections,{contacts:{enabled:true,hy:'Երևան',ru:'Yerevan'}});
 const serialized=JSON.stringify(result);for(const secret of ['PRIVATE','personal_orders','customers','Hidden policy'])assert.equal(serialized.includes(secret),false);
 assert.equal(result.controls.search,true);assert.equal(result.controls.brand,false);assert.equal(result.controls.promo,false);assert.deepEqual(result.hiddenColumns,['retail','marginVal']);assert.equal(f.writes.length,0);
});

test('storefront popularity is scoped to the selected customer and only projected available nonexcluded products',async()=>{
 const f=fixture();await orderRoutes(f.context);assert.deepEqual(f.calls,[{name:'zzws_storefront_popularity',args:{p_user:customerId,p_days:21,p_articuls:['000001','000002']}}]);assert.notEqual(f.calls[0].args.p_user,adminId);
});

test('adding storefront leaves selected-customer identity, prices, controls and version exactly compatible with API85',async()=>{
 const f=fixture(),result=await orderRoutes(f.context);assert.deepEqual(result.customer,{id:customerId,customerCode:'001234 Խանութ / Shop',client:'Selected customer',profileRevision:7,rowsList:[],role:'client',allowResale:false});assert.match(result.version,/^catalog-r1:price-r2:warehouse-r3:7:/);
 if(process.env.ZZWS_BASELINE_ORDER_ROUTES){const {orderRoutes:previous}=await import(pathToFileURL(process.env.ZZWS_BASELINE_ORDER_ROUTES));const baseline=await previous(fixture().context);const {storefront,...compatible}=result;assert.deepEqual(compatible,baseline);}
 assert.equal(f.writes.length,0);
});

test('a customer with no allowed products receives no hidden product IDs and triggers no ranking RPC',async()=>{
 const f=fixture({profile:{brands:['NoAccess']}}),result=await orderRoutes(f.context);assert.deepEqual(result.products,[]);assert.deepEqual(result.storefront.banners,[]);assert.deepEqual(result.storefront.manualBanners,[]);assert.deepEqual(f.calls,[]);
});

test('existing administrator permissions and primary active-customer checks still reject forbidden contexts',async()=>{
 for(const options of [{user:{role:'client'}},{user:{permissions:[]}},{customer:{active:false}},{customer:{customer_id:adminId}}]){const f=fixture(options);await assert.rejects(()=>orderRoutes(f.context),error=>error.status===403);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);}
});

test('version and export GETs remain read-only and do not run storefront ranking',async()=>{
 for(const suffix of ['/version','/export']){const f=fixture();f.context.path+=suffix;const result=await orderRoutes(f.context);if(suffix==='/version'){assert.equal(typeof result.version,'string');assert.equal(Object.hasOwn(result,'storefront'),false);}else{assert.equal(result.filename,'PriceList.xlsx');assert.equal(result.rows[0][1],'Selected customer');assert.equal(result.rows[2][0],'000001');assert.equal(result.rows[2][5],65);}assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);}
});

test('administrator lists preserve API85 per-administrator read revisions and unread flags',async()=>{
 const f=fixture({orders:[{id:'o1',revision:3,number:1},{id:'o2',revision:4,number:2},{id:'o3',revision:1,number:3}],reads:[{user_id:adminId,order_id:'o1',revision:3},{user_id:adminId,order_id:'o2',revision:2},{user_id:customerId,order_id:'o3',revision:1}]});f.context.path='admin/orders';f.context.req=new Request('https://fixture.invalid/admin/orders');const result=await orderRoutes(f.context);assert.deepEqual(result.orders.map(row=>[row.id,row.adminReadRevision,row.unread]),[['o1',3,false],['o2',2,true],['o3',0,true]]);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);
});
