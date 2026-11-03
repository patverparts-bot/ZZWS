export const PROPOSAL_LIFETIME=7*24*60*60*1000;
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
export async function proposalRoutes(c){
 const {path,req,user,body,current,project,table,query,json,fail,random,digest}=c;
 if(path==='proposal/view'){
  if(req.method!=='GET')fail(405,'Չթույլատրված գործողություն');
  const token=new URL(req.url).searchParams.get('token')||'';if(!/^[a-f0-9]{64}$/.test(token))fail(404,'Առաջարկը չի գտնվել կամ ժամկետը լրացել է');
  const row=await query(table('proposals').select('lines,created_at,expires_at,price_mode').eq('token_hash',await digest(token)).gt('expires_at',new Date().toISOString()).maybeSingle());
  if(!row)fail(404,'Առաջարկը չի գտնվել կամ ժամկետը լրացել է');
  return json({lines:row.lines,createdAt:row.created_at,expiresAt:row.expires_at,priceMode:row.price_mode});
 }
 if(path!=='catalog/proposals')return null;
 if(req.method!=='POST')fail(405,'Չթույլատրված գործողություն');
 if(!['admin','client'].includes(user.role))fail(403,'Հասանելիությունն արգելված է');
 const input=await body(req),v=await current(),products=project(v.products,user,v.rules,{mainWarehouses:v.mainWarehouses});let lines;
 try{lines=proposalLines(input.lines,products,input.priceMode,user.role==='admin');}catch(e){fail(400,e.message);}
 const token=random(),createdAt=new Date().toISOString(),expiresAt=new Date(Date.parse(createdAt)+PROPOSAL_LIFETIME).toISOString();
 await query(table('proposals').insert({token_hash:await digest(token),owner_id:user.id,lines,price_mode:input.priceMode,created_at:createdAt,expires_at:expiresAt}));
 return json({token,createdAt,expiresAt,lines,priceMode:input.priceMode});
}
