import {mailReady} from './gmail-mail.mjs';
import {senderAddress} from './mail-config.mjs';
import {email,emailRows,emailList} from './report-email.mjs';
import {mailConnection} from './mail-connection.mjs';
import {sha,sendReportMail} from './report-routes.mjs';
export async function invitationEmailRoutes(c){
 const {path,req,user,body,query,table,service,json,fail}=c;
 if(!['admin/users/invitation-email/options','admin/users/invitation-email/send'].includes(path))return null;
 if(req.method!=='POST')fail(405,'Մեթոդը չի թույլատրվում');
 if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Հասանելիությունն արգելված է');
 const p=await body(req);if(typeof p.id!=='string'||!/^[a-f0-9-]{36}$/i.test(p.id))fail(400,'Ընտրեք օգտատիրոջը');
 const target=await query(table('users').select('id,login,profile,active,needs_password_setup,customer_id,person').eq('id',p.id).maybeSingle());
 if(!target||!target.active||!target.needs_password_setup)fail(409,'Օգտատերը պետք է ակտիվ լինի և սպասի առաջին մուտքին');
 const rows=emailRows(target.profile.role==='client'?[target.person?.email||(target.customer_id?'':target.profile.companyEmail||String(target.profile.contacts?.[0]?.email||target.profile.emailRows?.[0]||'').split(/[,;]/)[0].trim())]:target.profile.emailRows||[]);if(!rows.some(Boolean)&&target.profile.role==='admin'&&target.profile.replyToEmail)rows[0]=email(target.profile.replyToEmail);
 if(path.endsWith('/options'))return json({rows,employee:!!target.customer_id});
 if(!Array.isArray(p.selectedRows)||!p.selectedRows.length||p.selectedRows.length>5||p.selectedRows.some(i=>!Number.isInteger(i)||i<0||i>4||!rows[i]))fail(400,'Ընտրեք քարտում պահպանված էլ․ փոստի տողը');
 if(typeof p.code!=='string'||!/^[a-f0-9]{64}$/.test(p.code))fail(400,'Հրավերի կոդը սխալ է');
 const settings=await query(table('report_email_settings').select('from_email').eq('id',true).single()),{env}=await mailConnection(c,settings,{withPassword:true});
 if(!mailReady(env))fail(503,'Էլ․ փոստի ծառայությունը դեռ կարգավորված չէ։ Կարող եք պատճենել հրավերի հղումը։');
 const from=senderAddress(settings,env,{invitation:true});
 const base=new URL(env('ZZWS_PUBLIC_SITE_URL')||'https://patverparts-bot.github.io/ZZWS/');
 if(base.protocol!=='https:'||base.username||base.password||base.hash||base.search)fail(503,'Կայքի հասցեն սխալ է կարգավորված');
 const to=[...new Set(p.selectedRows.flatMap(i=>emailList(rows[i])))].sort();if(to.length>50)fail(400,'Ստացողների քանակը չափազանց մեծ է');
 const hash=await sha(p.code),fingerprint=await sha(JSON.stringify({to,from,site:base.href,login:target.login,language:p.language==='ru'?'ru':'hy'})),key=await sha(hash+':'+fingerprint);
 const rpc=(name,args)=>query(service.rpc(name,args));
 const claim=await rpc('zzws_invitation_mail_claim',{p_actor:user.id,p_user:target.id,p_hash:hash,p_key:key,p_fingerprint:fingerprint});
 if(claim.state==='accepted')return json({accepted:true,duplicate:true});
 if(claim.state!=='send')fail(409,'Նախորդ ուղարկման արդյունքը անորոշ է։ Պատճենեք հղումը կամ ստեղծեք նոր հրավեր։');
 base.hash=new URLSearchParams({invite:p.code}).toString();
 const message={from,to,subject:p.language==='ru'?'ZZWS — Приглашение для входа':'ZZWS — Մուտքի հրավեր',text:p.language==='ru'?'Добро пожаловать в ZZWS.\nПри регистрации выберите личные логин и пароль и укажите правильные имя, фамилию, телефон и email. На указанный email будут приходить отчёты о продажах.\nСсылка для регистрации:\n'+base.href+'\nПриглашение действует 48 часов с момента создания. Новое приглашение отменяет предыдущее. Передавайте ссылку только владельцу аккаунта.':'Բարի գալուստ ZZWS։\nԳրանցման ժամանակ ընտրեք ձեր մուտքանունն ու գաղտնաբառը և լրացրեք ճիշտ անունը, ազգանունը, հեռախոսն ու էլ․ փոստը։ Այդ էլ․ փոստով կստանաք վաճառքի հաշվետվությունները։\nԳրանցման հղումը՝\n'+base.href+'\nՀրավերը գործում է ստեղծման պահից 48 ժամ։ Նոր հրավերը անվավեր է դարձնում նախորդը։ Մի փոխանցեք հղումն այլ անձանց։',attachments:[]};
 let result;try{result=await sendReportMail({job:{id:'invite-'+key},message,env});}catch{result={result:'unknown'};}
 const state=result.result==='accepted'?'accepted':result.result==='rejected'?'retry':'uncertain';
 const saved=await rpc('zzws_invitation_mail_finish',{p_actor:user.id,p_user:target.id,p_hash:hash,p_key:key,p_result:state,p_provider:result.id||null});
 if(!saved)fail(409,'Հրավերը փոխվել է ուղարկման ընթացքում։ Ստուգեք քարտը։');
 if(state==='accepted')return json({accepted:true});
 if(state==='retry')return json({accepted:false,retryable:true,error:'Չհաջողվեց ուղարկել։ Կարող եք կրկնել կամ պատճենել հղումը։'});
 return json({accepted:false,retryable:false,error:'Ուղարկման արդյունքը անորոշ է։ Կրկնակի նամակից խուսափելու համար ավտոմատ կրկնություն չի կատարվում։'});
}

