import {effectiveRules} from './rules.mjs';
import {groupedProposal} from './proposal-cart.mjs';
export async function proposalManagementRoutes(c){
 const {path,req,user,body,query,table,json,fail,current,project,service,proposalLines,customerProposalLines}=c;
 const all=path==='admin/proposals',mine=path==='catalog/proposals/mine',action=['catalog/proposals/revoke','catalog/proposals/delete'].includes(path),editing=path==='catalog/proposals/update'||action;
 if(!all&&!mine&&!editing)return null;
 if(user?.role!=='admin'||all&&user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
 if((editing?'POST':'GET')!==req.method)fail(405,'Չթույլատրված գործողություն');
 if(!editing){
  const offset=Number(new URL(req.url).searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(400,'Ստուգեք տվյալները');
  let q=table('proposals').select('token_hash,owner_id,customer_id,lines,price_mode,created_at,expires_at,valid_days,revision,updated_at,revoked_at').order('created_at',{ascending:false}).order('token_hash',{ascending:false}).range(offset,offset+30);if(mine)q=q.eq('owner_id',user.id);
  const rows=await query(q),ids=[...new Set(rows.flatMap(p=>[p.owner_id,p.customer_id]).filter(Boolean))],people=ids.length?await query(table('users').select('id,login,profile').in('id',ids)):[],byId=new Map(people.map(p=>[p.id,p]));
  const person=id=>{const p=byId.get(id);return p?{id,login:p.login,name:p.profile.client||p.login,customerCode:p.profile.customerCode||''}:null;};
  return json({offers:rows.slice(0,30).map(p=>({...p,id:p.token_hash,author:person(p.owner_id),recipient:person(p.customer_id),canEdit:p.owner_id===user.id&&!p.revoked_at})),nextOffset:rows.length>30?offset+30:null});
 }
 const input=await body(req);if(typeof input.id!=='string'||! /^[a-f0-9]{64}$/.test(input.id)||!Number.isSafeInteger(input.revision)||input.revision<1)fail(400,'Ստուգեք տվյալները');
 if(action){if(path.endsWith('/delete')&&user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');const result=await service.rpc('zzws_proposal_action',{p_actor:user.id,p_id:input.id,p_revision:input.revision,p_delete:path.endsWith('/delete')});if(result.error)fail(result.error.code==='PT409'?409:403,'Գործողությունը չի կատարվել։ Թարմացրեք ցանկը։');return json({saved:true});}
 if(!Number.isInteger(input.validDays)||input.validDays<1||input.validDays>365)fail(400,'Ստուգեք տվյալները');
 const saved=await query(table('proposals').select('*').eq('token_hash',input.id).eq('owner_id',user.id).maybeSingle());if(!saved)fail(404,'Առաջարկը չի գտնվել');
 const v=await current(),products=project(v.products,user,v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses});let lines,mode=input.priceMode;
 try{
  if(saved.customer_id){
   if(!user.permissions?.includes('orders:write'))fail(403,'Հասանելիությունն արգելված է');
   const customer=await query(table('users').select('id,profile').eq('id',saved.customer_id).eq('active',true).is('customer_id',null).maybeSingle());if(customer?.profile.role!=='client')fail(409,'Հաճախորդը չի գտնվել կամ անջատված է');
   const categoryId=customer.profile.sheet||'Dealers',category=effectiveRules(v.rules)[categoryId];if(!category)fail(409,'Հաճախորդի գնային կատեգորիան հասանելի չէ');
   mode=categoryId==='KP'?'KP':'Dealers';lines=groupedProposal(customerProposalLines(input.lines,products,project(v.products,{...customer.profile,id:customer.id},v.rules,{forOrder:true,mainWarehouses:v.mainWarehouses}),{categoryId,categoryName:category.name||categoryId}));
  }else lines=proposalLines(input.lines,products,mode,true);
 }catch(e){if(e.status)throw e;fail(e.code||400,e.message);}
 const result=await service.rpc('zzws_edit_proposal',{p_actor:user.id,p_id:saved.token_hash,p_revision:input.revision,p_lines:lines,p_mode:mode,p_days:input.validDays});
 if(result.error)fail(result.error.code==='PT409'?409:result.error.code==='PT403'?403:400,'Առաջարկը փոխվել է։ Վերաբացեք այն։');
 return json({saved:true,revision:result.data.revision});
}
