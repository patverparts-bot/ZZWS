export const PROPOSAL_LIFETIME=7*24*60*60*1000;
import {groupedProposal,proposalCartRoutes} from './proposal-cart.mjs';
import {effectiveRules} from './rules.mjs';
export function proposalLines(input,products,mode,admin){
 if(!['KP','Dealers'].includes(mode)||!Array.isArray(input)||!input.length||input.length>2000)throw Error('Ստուգեք առաջարկի ցանկը');
 const bySku=new Map(products.map(p=>[p.articul,p]));
 return input.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Ստուգեք առաջարկի ցանկը');
  const p=bySku.get(row.articul);if(!p||!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>999999||typeof row.special!=='boolean')throw Error('Ստուգեք առաջարկի ապրանքներն ու քանակները');
  const price=row.special?row.price:admin?p.stockPickerPrices?.[mode]:p.wholesale;
  if(!row.special&&(row.price??null)!==(price??null))throw Error('Գները փոխվել են։ Կրկին կազմեք առաջարկը');
  if(price!==null&&price!==undefined&&(!Number.isFinite(price)||price<=0||price>1e12))throw Error('Ստուգեք առաջարկի գները');
  return {articul:p.articul,name:p.name,brand:p.brand,category:p.category,quantity:row.quantity,price:price??null,special:row.special&&row.price!==(admin?p.stockPickerPrices?.[mode]:p.wholesale)};
 });
}
export function customerProposalLines(input,adminProducts,customerProducts,pricing,{quote=false}={}){
 if(!Array.isArray(input)||!input.length||input.length>2000)throw Object.assign(Error('Ստուգեք առաջարկի ցանկը'),{code:400});
 const bySku=new Map(adminProducts.map(p=>[p.articul,p])),prices=new Map(customerProducts.map(p=>[p.articul,p.wholesale]));
 return input.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Object.assign(Error('Ստուգեք առաջարկի ցանկը'),{code:400});
  const p=bySku.get(row.articul);
  if(!p||!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>999999||typeof row.special!=='boolean'||row.priceProvided!==undefined&&typeof row.priceProvided!=='boolean')throw Object.assign(Error('Ստուգեք առաջարկի ապրանքներն ու քանակները'),{code:400});
  const priceProvided=row.priceProvided??row.special,base=prices.get(p.articul)??null,price=priceProvided?row.price:base;
  if(priceProvided&&(!Number.isFinite(price)||price<=0||price>1e12))throw Object.assign(Error('Ստուգեք առաջարկի գները'),{code:400});
  if(!quote&&!priceProvided&&(row.price??null)!==base)throw Object.assign(Error('Հաճախորդի գները փոխվել են։ Կրկին կազմեք առաջարկը'),{code:409});
  return {articul:p.articul,name:p.name,brand:p.brand,category:p.category,quantity:row.quantity,price,special:priceProvided&&price!==base,priceProvided,pricing:{...pricing}};
 });
}
export async function proposalRoutes(c){
 const {path,req,user,body,current,project,table,query,json,fail,random,digest}=c;
 if(user){const cart=await proposalCartRoutes(c);if(cart)return cart;}
 if(path==='proposal/view'){
  if(req.method!=='GET')fail(405,'Չթույլատրված գործողություն');
  const token=new URL(req.url).searchParams.get('token')||'';if(!/^[a-f0-9]{64}$/.test(token))fail(404,'Առաջարկը չի գտնվել կամ ժամկետը լրացել է');
  const row=await query(table('proposals').select('lines,customer_id,created_at,expires_at,price_mode').eq('token_hash',await digest(token)).gt('expires_at',new Date().toISOString()).maybeSingle());
  if(!row)fail(404,'Առաջարկը չի գտնվել կամ ժամկետը լրացել է');
  if(row.customer_id)return json({requiresLogin:true,expiresAt:row.expires_at});
  return json({lines:row.lines,createdAt:row.created_at,expiresAt:row.expires_at,priceMode:row.price_mode});
 }
 if(!['catalog/proposals','catalog/proposals/quote'].includes(path))return null;
 if(req.method!=='POST')fail(405,'Չթույլատրված գործողություն');
 if(user?.role!=='admin')fail(403,'Հասանելիությունն արգելված է');
 const quoting=path==='catalog/proposals/quote';
 if(quoting&&!user.permissions?.includes('orders:write'))fail(403,'Հաճախորդ ընտրելու իրավունքը բացակայում է');
 const input=await body(req),validDays=input.validDays??7;if(!quoting&&(!Number.isInteger(validDays)||validDays<1||validDays>365))fail(400,'Նշեք գործողության օրերը՝ 1-ից 365');let customerId=null,customer=null;
 if(quoting&&(input.customerId==null||input.customerId===''))fail(400,'Ընտրեք հաճախորդին ցանկից');
 if(input.customerId!=null&&input.customerId!==''){
  if(user.role!=='admin'||!user.permissions?.includes('orders:write'))fail(403,'Հաճախորդ ընտրելու իրավունքը բացակայում է');
  if(typeof input.customerId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.customerId))fail(400,'Ընտրեք հաճախորդին ցանկից');
  customer=await query(table('users').select('id,profile,profile_revision').eq('id',input.customerId).eq('active',true).is('customer_id',null).eq('profile->>role','client').maybeSingle());
  if(!customer)fail(404,'Հաճախորդը չի գտնվել կամ անջատված է');customerId=customer.id;
 }
 const v=await current(),products=project(v.products,user,v.rules,{mainWarehouses:v.mainWarehouses});let lines,pricing=null,priceMode=input.priceMode;
 if(customer){
  const categoryId=customer.profile.sheet||'Dealers',category=effectiveRules(v.rules)[categoryId];if(!category)fail(409,'Հաճախորդի գնային կատեգորիան հասանելի չէ');
  pricing={categoryId,categoryName:category.name||categoryId};priceMode=categoryId==='KP'?'KP':'Dealers';
  const customerProducts=project(v.products,{...customer.profile,id:customer.id},v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses});
  try{lines=customerProposalLines(input.lines,products,customerProducts,pricing,{quote:quoting});}catch(e){fail(e.code||400,e.message);}
  if(quoting)return json({customerId,lines,pricing,priceMode});
  try{const explicit=new Set(lines.filter(line=>line.priceProvided).map(line=>line.articul));lines=groupedProposal(lines).map(line=>({...line,priceProvided:explicit.has(line.articul)}));}catch(e){fail(400,e.message);}
 }else try{lines=proposalLines(input.lines,products,input.priceMode,user.role==='admin');}catch(e){fail(400,e.message);}
 const token=random(),createdAt=new Date().toISOString(),expiresAt=new Date(Date.parse(createdAt)+validDays*86400000).toISOString();
 await query(table('proposals').insert({token_hash:await digest(token),owner_id:user.id,customer_id:customerId,valid_days:validDays,lines,price_mode:priceMode,created_at:createdAt,expires_at:expiresAt}));
 return json({token,createdAt,expiresAt,validDays,lines,priceMode,...(pricing?{pricing}:{})});
}
