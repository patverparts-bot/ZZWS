// All offer permissions/prices are read from server-owned rows, never from cart input.
export function groupedProposal(lines){
 const grouped=new Map();for(const line of lines){const old=grouped.get(line.articul);if(old&&old.price!==line.price)throw Error('Նույն արտիկուլի համար նշեք մեկ գին');const next={...line,quantity:(old?.quantity||0)+line.quantity};if(next.quantity>9999)throw Error('Առաջարկի քանակը պետք է լինի մինչև 9999');grouped.set(line.articul,next);}return [...grouped.values()];
}
const dto=(line,hash,expiresAt,revision=1)=>({...line,proposalRevision:revision,wholesale:line.price,retail:0,marginVal:0,hasWholesale:line.price>0,stockAvailable:false,stockStatus:'Առաջարկից',proposalHash:hash,proposalExpiresAt:expiresAt});
export async function proposalCartProducts({user,table,query},wanted=null){
 if(user.role!=='client')return [];
 if(wanted&&!wanted.size)return [];
 let request=table('proposal_cart').select('articul,token_hash').eq('user_id',user.id);if(wanted)request=request.in('articul',[...wanted]);
 const grants=await query(request);if(!grants.length)return [];
 const proposals=await query(table('proposals').select('token_hash,customer_id,lines,expires_at,revision').in('token_hash',[...new Set(grants.map(r=>r.token_hash))]).eq('customer_id',user.customerId||user.id).is('revoked_at',null).gt('expires_at',new Date().toISOString()));
 const rows=new Map(proposals.map(p=>[p.token_hash,p]));return grants.flatMap(g=>{if(wanted&&!wanted.has(g.articul))return [];const row=rows.get(g.token_hash),line=row&&groupedProposal(row.lines).find(l=>l.articul===g.articul);return line?[dto(line,row.token_hash,row.expires_at,row.revision)]:[];});
}
export async function proposalCartRoutes(c){
 const {path,req,user,body,table,query,json,fail,digest}=c;
 if(path==='catalog/proposal-cart'&&req.method==='GET')return json({products:await proposalCartProducts(c)});
 if(path==='catalog/proposals/inbox'&&req.method==='GET'){
  if(user.role!=='client')fail(403,'Հասանելիությունն արգելված է');
  const offers=await query(table('proposals').select('token_hash,created_at,expires_at,lines').eq('customer_id',user.customerId||user.id).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(50));
  const read=await query(table('proposal_reads').select('token_hash').eq('user_id',user.id));const seen=new Set(read.map(r=>r.token_hash));
  return json({offers:offers.map(r=>({id:r.token_hash,createdAt:r.created_at,expiresAt:r.expires_at,count:r.lines.length,unread:!seen.has(r.token_hash)}))});
 }
 if(!['catalog/proposals/open','catalog/proposals/accept'].includes(path))return null;
 if(req.method!=='POST')fail(405,'Չթույլատրված գործողություն');
 if(user.role!=='client')fail(403,'Մուտք գործեք առաջարկում ընտրված հաճախորդի հաշվով');
 const {token,proposalId}=await body(req);if(!(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token))&&!(typeof proposalId==='string'&&/^[a-f0-9]{64}$/.test(proposalId)))fail(404,'Առաջարկը չի գտնվել');
 const hash=token?await digest(token):proposalId,row=await query(table('proposals').select('token_hash,customer_id,lines,expires_at,revision').eq('token_hash',hash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle());
 if(!row||!row.customer_id)fail(404,'Առաջարկը չի գտնվել կամ ժամկետը լրացել է');
 if(row.customer_id!==(user.customerId||user.id))fail(403,'Առաջարկը նախատեսված է այլ հաճախորդի համար');
 let lines;try{lines=groupedProposal(row.lines);}catch(e){fail(400,e.message);}
 await query(table('proposal_reads').upsert({user_id:user.id,token_hash:hash},{onConflict:'user_id,token_hash'}));
 if(path==='catalog/proposals/accept')await query(table('proposal_cart').upsert(lines.map(l=>({user_id:user.id,articul:l.articul,token_hash:hash})),{onConflict:'user_id,articul'}));
 return json({proposalId:hash,products:lines.map(l=>dto(l,hash,row.expires_at,row.revision)),expiresAt:row.expires_at});
}
