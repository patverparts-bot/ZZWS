// Global warehouse classification. Quantities remain in the imported price version.
export const DEFAULT_MAIN_WAREHOUSES=Object.freeze(['003','023','031','026']);
export function validateMainWarehouses(value){
 if(!Array.isArray(value)||value.length>1000||value.some(code=>typeof code!=='string'||!/^\d{3}$/.test(code))||new Set(value).size!==value.length)throw Error('Նշեք պահեստի երեքանիշ եզակի կոդերը՝ օրինակ 003');
 return [...value].sort();
}
export const mainWarehouses=config=>config?.mainWarehouses===undefined?[...DEFAULT_MAIN_WAREHOUSES].sort():validateMainWarehouses(config.mainWarehouses);
export function warehousePriority(config){
 const main=mainWarehouses(config),preferred=config?.warehousePriority===undefined?DEFAULT_MAIN_WAREHOUSES:validateMainWarehousesOrder(config.warehousePriority);
 return [...preferred.filter(code=>main.includes(code)),...main.filter(code=>!preferred.includes(code))];
}
function validateMainWarehousesOrder(value){validateMainWarehouses(value);return [...value];}
export function validateWarehousePriority(value,main){
 const order=validateMainWarehousesOrder(value);
 if(order.length!==main.length||order.some(code=>!main.includes(code)))throw Error('Առաջնահերթությունը պետք է ներառի բոլոր հիմնական պահեստները՝ առանց կրկնության։');
 return order;
}
export function warehouseList(products,main){
 const present=new Set(products.flatMap(p=>Object.keys(p.stocks||{})));
 return [...new Set([...present,...main])].sort().map(code=>({code,type:main.includes(code)?'main':'shop',present:present.has(code)}));
}
export async function warehouseRoutes(c){
 const {path,req,user,table,query,body,json,fail,audit}=c;
 if(path!=='admin/warehouses')return null;
 if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
 if(!['GET','POST'].includes(req.method))fail(405,'Չթույլատրված գործողություն');
 const state=await query(table('state').select('version,catalog_controls,catalog_controls_revision').eq('id',true).single());
 let products=[];
 if(state.version){const version=await query(table('versions').select('products').eq('id',state.version).single());products=version.products;}
 const config=structuredClone(state.catalog_controls||{}),before=mainWarehouses(config),beforePriority=warehousePriority(config);
 if(req.method==='GET')return json({mainWarehouses:before,warehousePriority:beforePriority,warehouses:warehouseList(products,before),revision:state.catalog_controls_revision});
 const p=await body(req);
 if(typeof p.revision!=='string'||p.revision!==state.catalog_controls_revision)fail(409,'Կարգավորումները փոխվել են։ Թարմացրեք և կրկնեք');
 let main;try{main=validateMainWarehouses(p.mainWarehouses);}catch(e){fail(400,e.message);}
 let priority;
 try{priority=p.warehousePriority===undefined?[...beforePriority.filter(code=>main.includes(code)),...main.filter(code=>!beforePriority.includes(code))]:validateWarehousePriority(p.warehousePriority,main);}catch(e){fail(400,e.message);}
 config.mainWarehouses=main;config.warehousePriority=priority;const revision=crypto.randomUUID();
 const saved=await query(table('state').update({catalog_controls:config,catalog_controls_revision:revision}).eq('id',true).eq('catalog_controls_revision',p.revision).select('id').maybeSingle());
 if(!saved)fail(409,'Կարգավորումները փոխվել են։ Թարմացրեք և կրկնեք');
 await audit(user.id,'warehouse_settings',JSON.stringify({before,mainWarehouses:main,beforePriority,warehousePriority:priority}));
 return json({mainWarehouses:main,warehousePriority:priority,warehouses:warehouseList(products,main),revision});
}
