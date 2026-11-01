import {orderPublic} from './order-public.mjs';
import {offerLive,manualOfferProducts,offerPrice,yerevanDate} from './special-offers.mjs';
import {effectiveControls} from './catalog-controls.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export async function bulletinRoutes({path,req,user,table,query,service,body,json,current,project,fail}){
 const rpc=async(name,args)=>{const r=await service.rpc(name,args);if(r.error)fail(r.error.code==='PT403'?403:r.error.code==='PT409'?409:400,'Ստուգեք տվյալները կամ թարմացրեք էջը');return r.data;};
 if(['admin/offers','admin/offers/delete'].includes(path)){
  if(user.role!=='admin'||!['owner','price'].includes(user.adminScope))fail(403,'Հասանելիությունն արգելված է');
  const withAvailability=async rows=>{
   const v=await current(),available=new Set(v.products.map(p=>p.articul));
   return rows.map(o=>({...o,availability:{found:o.articles.filter(a=>available.has(a)),missing:o.articles.filter(a=>!available.has(a))}}));
  };
  if(req.method==='GET'&&path==='admin/offers'){
   const offset=Number(new URL(req.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(400,'Ստուգեք տվյալները');
   const rows=await query(table('catalog_bulletins').select('id,title,articles,active,created,revision,expires_on,deleted_at').eq('kind','offers').order('created',{ascending:false}).order('id',{ascending:false}).range(offset,offset+30));
   let offers=rows.slice(0,30);if(offers.length)try{offers=await withAvailability(offers);}catch{/* Saved lists remain accessible without a current price list. */}
   return json({offers:offers.map(o=>({...o,status:o.deleted_at?'deleted':!o.active?'disabled':o.expires_on&&o.expires_on<yerevanDate()?'expired':'active'})),nextOffset:rows.length>30?offset+30:null});
  }
  if(req.method==='POST'){
   const p=await body(req),deleting=path.endsWith('/delete');
   if(!uuid(p.requestId)||(p.id!=null&&!uuid(p.id))||(p.id!=null&&(!Number.isSafeInteger(p.revision)||p.revision<1))||(deleting&&!p.id))fail(400,'Ստուգեք տվյալները կամ կրկին բացեք առաջարկը');
   if(deleting)return json(await rpc('zzws_manage_offer',{p_actor:user.id,p_request:p.requestId,p_id:p.id,p_revision:p.revision,p_title:null,p_articles:null,p_active:false,p_expires_on:null,p_delete:true}));
   if(typeof p.title!=='string'||!p.title.trim()||p.title.trim().length>200||typeof p.active!=='boolean'||!Array.isArray(p.articles)||!p.articles.length||p.articles.length>200||p.articles.some(a=>typeof a!=='string'||!a.trim()||a.trim().length>30))fail(400,'Նշեք վերնագիրը և մինչև 200 արտիկուլ');
   const expires=p.expiresOn||null;
   if(expires&&(typeof expires!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(expires)||Number.isNaN(Date.parse(expires))||new Date(expires).toISOString().slice(0,10)!==expires||p.active&&expires<yerevanDate()))fail(400,'Նշեք գործողության ավարտի ճիշտ ամսաթիվը');
   const articles=[...new Set(p.articles.map(a=>a.trim()))];
   const saved=await rpc('zzws_manage_offer',{p_actor:user.id,p_request:p.requestId,p_id:p.id||null,p_revision:p.id?p.revision:null,p_title:p.title.trim(),p_articles:articles,p_active:p.active,p_expires_on:expires,p_delete:false});
   // Saving the full list must not depend on a price-list read succeeding.
   try{return json((await withAvailability([saved]))[0]);}catch{return json(saved);}
  }
 }
 if(path==='admin/orders/reopen'&&req.method==='POST'){
  const p=await body(req);if(user.role!=='admin'||!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
  if(!uuid(p.id)||!Number.isSafeInteger(p.revision)||!['new','confirmed','in_progress'].includes(p.status)||typeof p.reason!=='string'||p.reason.trim().length<5||p.reason.length>2000)fail(400,'Ընտրեք նոր կարգավիճակը և գրեք պատճառը՝ առնվազն 5 նիշ');
  return json(orderPublic(await rpc('zzws_reopen_order',{p_actor:user.id,p_order:p.id,p_revision:p.revision,p_status:p.status,p_reason:p.reason})));
 }
 if(path==='admin/orders/reopens'&&req.method==='GET'){
  if(user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
  const events=await query(table('order_activity').select('id,order_id,order_number,revision,actor,occurred_at,snapshot').eq('source','closed_order_reopened').order('sequence',{ascending:false}).limit(20));
  const reads=events.length?await query(table('admin_order_reads').select('order_id,revision').eq('user_id',user.id).in('order_id',events.map(e=>e.order_id))):[];
  return json({events:events.filter(e=>!reads.some(r=>r.order_id===e.order_id&&r.revision>=e.revision)).map(e=>({id:e.id,orderId:e.order_id,number:e.order_number,actor:e.actor,created:e.occurred_at,reason:e.snapshot.comment,status:e.snapshot.status}))});
 }
 if(!['me/bulletins','me/bulletins/read'].includes(path))return null;
 const rows=(await query(table('catalog_bulletins').select('*').eq('active',true).is('deleted_at',null).order('created',{ascending:false}).limit(20))).filter(r=>r.kind!=='offers'||offerLive(r));
 const reads=rows.length?await query(table('bulletin_reads').select('bulletin_id').eq('user_id',user.id).in('bulletin_id',rows.map(r=>r.id))):[];
 const state=await query(table('state').select('version,rules_revision,catalog_controls_revision').eq('id',true).single());
 const stamp=JSON.stringify([user.id,user.profileRevision,user.role,user.sheet,state.version,state.rules_revision,state.catalog_controls_revision,rows.map(r=>[r.id,r.revision]),reads.map(r=>r.bulletin_id).sort()]);
 const cursor=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stamp)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(path==='me/bulletins'&&req.method==='GET'&&new URL(req.url).searchParams.get('cursor')===cursor)return json({unchanged:true,cursor});
 if(!rows.length&&path==='me/bulletins'&&req.method==='GET')return json({bulletins:[],cursor});
 const v=await current(),available=new Map(project(v.products,user,v.rules,{mainWarehouses:v.mainWarehouses}).map(p=>[p.articul,p]));
 const seen=new Set(reads.map(r=>r.bulletin_id)),versions=new Map(),result=[];
 async function version(id){if(!versions.has(id))versions.set(id,await query(table('versions').select('products').eq('id',id).maybeSingle()));return versions.get(id);}
 for(const row of rows){let products=[];
  if(row.kind==='offers')products=effectiveControls(v.catalogControls,user.customerId||user.id).promo?manualOfferProducts(row,[...available.values()],user.role==='admin'):[];
  else{const before=await version(row.before_version),after=await version(row.after_version);if(!before||!after)continue;
   const old=new Map(project(before.products,user,v.rules,{mainWarehouses:v.mainWarehouses}).map(p=>[p.articul,p]));
   products=project(after.products,user,v.rules,{mainWarehouses:v.mainWarehouses}).filter(p=>available.has(p.articul)&&old.has(p.articul)&&old.get(p.articul).wholesale!==p.wholesale).map(p=>({...p,previousPrice:old.get(p.articul).wholesale}));
  }
  if(!products.length)continue;
  result.push({id:row.id,revision:row.revision,kind:row.kind,title:row.kind==='prices'?'Գների փոփոխություններ':row.title,created:row.created,expiresOn:row.expires_on,seen:seen.has(row.id),products:products.map(p=>({articul:p.articul,name:p.name,brand:p.brand,price:row.kind==='offers'?offerPrice(p,user.role==='admin'):p.wholesale,...(p.previousPrice!=null?{previousPrice:p.previousPrice}:{})}))});
 }
 if(path==='me/bulletins'&&req.method==='GET')return json({bulletins:result,cursor});
 if(path==='me/bulletins/read'&&req.method==='POST'){const p=await body(req);if(!uuid(p.id)||!result.some(b=>b.id===p.id))fail(404,'Ծանուցումը չի գտնվել');await query(table('bulletin_reads').upsert({user_id:user.id,bulletin_id:p.id},{onConflict:'user_id,bulletin_id'}));return json({ok:true});}
 return null;
}

