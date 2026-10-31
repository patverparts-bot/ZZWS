import {email} from './report-email.mjs';
import {phoneNumber} from './phones.mjs';

export const accountPassword=value=>typeof value==='string'&&value.length>=6&&value.length<=256&&!/[\u0000-\u001f\u007f]/u.test(value);
export function accountPerson(value){
 const out={};
 for(const key of ['firstName','lastName']){const v=String(value?.[key]||'').trim();if(!v||v.length>100||/[\u0000-\u001f\u007f]/u.test(v))throw Error('Լրացրեք անունը և ազգանունը');out[key]=v;}
 out.phone=phoneNumber(value?.phone||'');if(!out.phone)throw Error('Նշեք հեռախոսահամարը');out.email=email(value?.email||'');return out;
}
export function customerCode(value){const s=String(value??'').trim();if(s.length>80||s&&!/^[\p{L}\p{N}._-]+$/u.test(s))throw Error('Ստուգեք հաճախորդի կոդը');return s;}
export const accountDTO=row=>({...row.profile,id:row.id,login:row.login,active:row.active,profileRevision:row.profile_revision,needsPasswordSetup:row.needs_password_setup===true,needsProfileSetup:row.needs_profile_setup===true,person:row.person||{},customerId:row.profile.role==='client'?(row.customer_id||row.id):null,clientRole:row.profile.role==='client'?(row.customer_id?'employee':'manager'):null,lastLogin:row.last_login||null});

export async function activateClient(c,p){
 const {user,hash,invitationHash,table,query,fail,service,email:authEmail,security}=c;
 const login=String(p.login||'').trim().toLowerCase(),person=accountPerson(p);
 if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(login)||login.startsWith('pending.'))fail(400,'Ընտրեք մուտքանուն՝ լատինատառ տառեր, թվեր, կետ, գծիկ կամ ընդգծում');
 if(!accountPassword(p.password))fail(400,'Գաղտնաբառը պետք է պարունակի 6-ից 256 նիշ');
 const duplicate=await query(table('users').select('id').eq('login',login).maybeSingle());if(duplicate&&duplicate.id!==user.id)fail(409,'Մուտքանունն արդեն օգտագործվում է');
 const claim=await query(table('users').update({password_setup_claim:hash}).eq('id',user.id).eq('needs_password_setup',true).is('password_setup_claim',null).select('id'));if(!claim.length)fail(409,'Հաշիվն արդեն ակտիվացվում է այլ պատուհանում');
 let changed=false,finished=false;
 try{
  const r=await service.auth.admin.updateUserById(user.id,{email:authEmail(login),email_confirm:true,password:p.password});if(r.error)fail(409,'Մուտքանունն արդեն օգտագործվում է կամ հաշիվը չի թարմացվել');changed=true;
  await query(service.rpc('zzws_account_activate',{p_user:user.id,p_hash:hash,p_invitation:invitationHash,p_login:login,p_person:person}));finished=true;
 }finally{
  if(!finished){if(changed)await service.auth.admin.updateUserById(user.id,{email:authEmail(user.login),password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:true});await query(table('users').update({password_setup_claim:null}).eq('id',user.id).eq('password_setup_claim',hash));}
 }
 return security.session(await query(table('users').select('*').eq('id',user.id).single()));
}

export async function accountRoutes(c){
 const {path,req,user,hash,setupOnly,invitationHash,table,query,body,json,fail,service,security,email:authEmail}=c;
 if(!['account/profile','team','team/invite','team/access','team/invitation','admin/users/team','admin/users/team/access'].includes(path))return null;
 if(path==='admin/users/team/access'){
  if(req.method!=='POST'||user.role!=='admin'||!user.permissions?.includes('users'))fail(403,'Հասանելիությունն արգելված է');
  const p=await body(req);if(typeof p.active!=='boolean')fail(400,'Ստուգեք հասանելիությունը');const target=await query(table('users').select('id,customer_id').eq('id',p.id).maybeSingle());if(!target?.customer_id)fail(404,'Աշխատակիցը չի գտնվել');
  await query(table('users').update({active:p.active}).eq('id',target.id));await query(table('sessions').delete().eq('user_id',target.id));await c.audit(user.id,'employee_access',JSON.stringify({employeeId:target.id,active:p.active}));return json({ok:true});
 }
 const staff=row=>({id:row.id,login:row.needs_password_setup&&row.login.startsWith('pending.')?'':row.login,person:row.person||{},clientRole:row.customer_id?'employee':'manager',status:!row.active?'disabled':row.needs_password_setup?'invited':'active',lastLogin:row.last_login||null});
 if(path==='account/profile'){
  if(req.method!=='POST'||user.role!=='client'||setupOnly)fail(403,'Հասանելիությունն արգելված է');
  const p=await body(req),person=accountPerson(p);
  await query(service.rpc('zzws_account_person',{p_user:user.id,p_hash:hash,p_person:person}));
  const updated=accountDTO(await query(table('users').select('*').eq('id',user.id).single()));return json(updated);
 }
 let root=user.customerId;
 if(path==='admin/users/team'){
  if(req.method!=='GET'||user.role!=='admin'||!user.permissions?.includes('users'))fail(403,'Հասանելիությունն արգելված է');
  root=new URL(req.url).searchParams.get('id');const r=await query(table('users').select('*').eq('id',root).maybeSingle());if(!r||r.profile.role!=='client'||r.customer_id)fail(404,'Հաճախորդը չի գտնվել');
 }else if(user.role!=='client'||user.clientRole!=='manager'||setupOnly)fail(403,'Միայն գլխավոր մենեջերը կարող է կառավարել աշխատակիցներին');
 if((path==='team'||path==='admin/users/team')&&req.method==='GET'){
  const manager=await query(table('users').select('*').eq('id',root).single()),employees=await query(table('users').select('*').eq('customer_id',root).order('login'));
  return json({members:[staff(manager),...employees.map(staff)]});
 }
 if(req.method!=='POST')fail(405,'Մեթոդը չի թույլատրվում');
 const p=await body(req);
 if(path==='team/invite'){
  const label=String(p.label||'').trim().slice(0,200),login='pending.'+crypto.randomUUID(),result=await service.auth.admin.createUser({email:authEmail(login),password:crypto.randomUUID()+crypto.randomUUID(),email_confirm:true});
  if(result.error)fail(400,'Չհաջողվեց ստեղծել հրավերը');const id=result.data.user.id;
  try{await query(service.rpc('zzws_team_create',{p_manager:user.id,p_user:id,p_login:login,p_label:label}));}
  catch(e){await service.auth.admin.deleteUser(id);throw e;}
  return json({id,invitation:await security.invite(id,user.id)});
 }
 const target=await query(table('users').select('*').eq('id',p.id).eq('customer_id',root).maybeSingle());if(!target)fail(404,'Աշխատակիցը չի գտնվել');
 if(path==='team/access'){
  if(typeof p.active!=='boolean')fail(400,'Ստուգեք հասանելիությունը');
  await query(service.rpc('zzws_team_access',{p_manager:user.id,p_user:target.id,p_active:p.active}));return json({ok:true});
 }
 if(path==='team/invitation'){
  if(!target.active||!target.needs_password_setup)fail(409,'Հրավիրել կարելի է միայն միացված, չակտիվացված հաշիվը');
  await query(table('sessions').delete().eq('user_id',target.id));return json({id:target.id,invitation:await security.invite(target.id,user.id)});
 }
 fail(404,'Չի գտնվել');
}
