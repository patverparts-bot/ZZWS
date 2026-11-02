// Offline adapter only. Runs the real application handlers/RPCs against a local PostgreSQL/WASM.
// Not a replacement for Supabase Auth/PostgREST in a deployed environment.
import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
const runtime=()=>{const r=globalThis.__ZZWS_OFFLINE__;if(!r?.offline)throw Error('Offline runtime required');return r;};
const ident=s=>{if(!/^[a-z_][a-z0-9_]*$/i.test(s))throw Error('Invalid identifier');return '"'+s+'"';};
function expression(s){
 // The dealer history uses this explicit PostgREST foreign-key embedding.
 // Keep the offline SQL translation limited to that known relation.
 if(s==='zzws_users.profile->>role')return '(select u.profile->>\'role\' from public.zzws_users u where u.id="zzws_orders"."user_id")';
 if(s==='zzws_users!inner(profile)')return '(select jsonb_build_object(\'profile\',u.profile) from public.zzws_users u where u.id="zzws_orders"."user_id") as "zzws_users"';
 const [base,...path]=s.split(/(->>)/);if(path.length){if(path.length!==2||!/^[a-zA-Z_][\w]*$/.test(path[1]))throw Error('Invalid JSON field');return ident(base)+"->>'"+path[1]+"'";}return ident(s);
}
const encoded=value=>value&&typeof value==='object'&&!Array.isArray(value)&&!(value instanceof Date)?JSON.stringify(value):value;
class Query{
 constructor(name,headers={}){this.requestHeaders=Object.freeze({...headers});if(!/^zzws_[a-z_]+$/.test(name))throw Error('Invalid table');this.name=name;this.filters=[];this.orders=[];this.action='select';this.columns='*';this.values=[];}
 select(columns='*',options={}){this.columns=columns;this.returning=true;this.options=options;return this;}
 eq(k,v){return this.filter(k,'=',v);}neq(k,v){return this.filter(k,'<>',v);}gt(k,v){return this.filter(k,'>',v);}gte(k,v){return this.filter(k,'>=',v);}lt(k,v){return this.filter(k,'<',v);}lte(k,v){return this.filter(k,'<=',v);}
 filter(k,op,v){this.filters.push({k,op,v});return this;}
 is(k,v){this.filters.push({k,op:'is',v});return this;}in(k,v){this.filters.push({k,op:'in',v});return this;}
 or(value){this.orValue=value;return this;}order(k,{ascending=true}={}){this.orders.push([k,ascending]);return this;}limit(n){this.take=Math.min(Number(n),50000);return this;}
 range(a,b){this.skip=Number(a);this.take=Number(b)-Number(a)+1;return this;}
 insert(value){this.action='insert';this.payload=Array.isArray(value)?value:[value];return this;}upsert(value,options={}){this.insert(value);this.action='upsert';this.conflict=options.onConflict;return this;}
 update(value){this.action='update';this.payload=value;return this;}delete(){this.action='delete';return this;}
 single(){this.one='required';return this.execute();}maybeSingle(){this.one='maybe';return this.execute();}
 then(resolve,reject){return this.execute().then(resolve,reject);}
 async execute(){
  try{
   const db=runtime().db,params=[],param=value=>{params.push(encoded(value));return '$'+params.length;};
   const contextual=this.action!=='select'&&Object.keys(this.requestHeaders).length>0,contextParam=contextual?param(JSON.stringify(this.requestHeaders)):null,contextWhere=contextual?'(select configured from request_context) is not null':'';
   const conditions=this.filters.map(f=>{const col=expression(f.k);if(f.op==='is')return col+(f.v===null?' is null':' is '+(f.v?'true':'false'));if(f.op==='in')return f.v.length?col+' in ('+f.v.map(param).join(',')+')':'false';return col+' '+f.op+' '+param(f.v);});
   if(this.orValue){const terms=this.orValue.split(',').map(term=>{const m=term.match(/^(.+?)\.(eq|ilike|cs)\.(.*)$/);if(!m)throw Error('Invalid OR filter');return expression(m[1])+' '+(m[2]==='cs'?'@>':m[2]==='eq'?'=':'ilike')+' '+param(m[2]==='ilike'?m[3].replaceAll('*','%'):m[3]);});conditions.push('('+terms.join(' or ')+')');}
   if(contextWhere)conditions.push(contextWhere);
   const where=conditions.length?' where '+conditions.join(' and '):'',table='public.'+ident(this.name);
   let statement;
   if(this.action==='select'){
    const cols=this.columns==='*'?'*':this.columns.split(',').map(c=>expression(c.trim())).join(',');statement='select '+cols+' from '+table+where;
    if(this.orders.length)statement+=' order by '+this.orders.map(([k,asc])=>expression(k)+(asc?' asc':' desc')).join(',');
    if(this.take!==undefined)statement+=' limit '+Math.max(0,Math.trunc(this.take));if(this.skip)statement+=' offset '+Math.max(0,Math.trunc(this.skip));
   }else if(this.action==='update'){
    const sets=Object.entries(this.payload).map(([k,v])=>ident(k)+'='+param(v));statement='update '+table+' set '+sets.join(',')+where+' returning *';
   }else if(this.action==='delete')statement='delete from '+table+where+' returning *';
   else{
    if(!this.payload.length)return {data:[],error:null};const keys=Object.keys(this.payload[0]);
    const records=contextual?null:this.payload.map(row=>'('+keys.map(k=>param(row[k]??null)).join(',')+')').join(',');statement='insert into '+table+'('+keys.map(ident).join(',')+') '+(contextual?'select '+keys.map(k=>'incoming.'+ident(k)).join(',')+' from jsonb_populate_recordset(null::'+table+','+param(JSON.stringify(this.payload))+'::jsonb) incoming cross join request_context where request_context.configured is not null':'values '+records);
    if(this.action==='upsert'){
     const info=await db.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=$1::regclass and i.indisprimary order by a.attnum`,['public.'+this.name]);
     const conflict=this.conflict?this.conflict.split(','):info.rows.map(r=>r.attname),updates=keys.filter(k=>!conflict.includes(k));
     statement+=' on conflict('+conflict.map(ident).join(',')+') '+(updates.length?'do update set '+updates.map(k=>ident(k)+'=excluded.'+ident(k)).join(','):'do nothing');
    }statement+=' returning *';
   }
   // PostgREST returns JSON timestamps with full PostgreSQL precision, not JS Date objects.
   const jsonStatement=this.action==='select'?'select to_jsonb(t) as row from ('+statement+') t':'with '+(contextual?'request_context as materialized (select set_config(\'request.headers\','+contextParam+',true) as configured),':'')+'changes as ('+statement+') select to_jsonb(changes) as row from changes';
   const result=await db.query(jsonStatement,params);let rows=result.rows.map(r=>r.row);
   if(this.action!=='select'&&this.returning&&this.columns!=='*')rows=rows.map(row=>Object.fromEntries(this.columns.split(',').map(k=>[k,row[k]])));
   if(this.one){if(rows.length>1||(!rows.length&&this.one==='required'))return {data:null,error:{code:'PGRST116'}};return {data:rows[0]||null,error:null};}
   return {data:this.options?.head?null:rows,error:null,count:this.options?.count?rows.length:null};
  }catch(e){if(runtime().debug)console.error('Offline SQL',this.name,this.action,e.message);return {data:null,error:{code:e.code||'OFFLINE_QUERY',hint:e.hint,message:'Local database operation failed'}};}
 }
}
export const hashPassword=(password,salt=randomBytes(16).toString('hex'))=>({salt,hash:scryptSync(password,salt,32).toString('hex')});
export function totp(secret,at=Date.now()){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret)bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=Buffer.from(bits.match(/.{8}/g)?.map(b=>parseInt(b,2))||[]);
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(at/30000)));const h=createHmac('sha1',bytes).update(counter).digest(),offset=h[19]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
export function createClient(url,key,options={}){
 const requestHeaders=Object.freeze({...options.global?.headers});
 const r=runtime();if(url!=='http://127.0.0.1:8080/offline-supabase')throw Error('Offline adapter forbids remote projects');let currentId=null,currentToken=null;
 const user=async id=>(await r.db.query('select * from auth.users where id=$1',[id])).rows[0];
 const dto=row=>row?{id:row.id,email:row.email,factors:row.factors||[]}:null;
 const setPassword=async(id,password)=>{const p=hashPassword(password);await r.db.query('update auth.users set password_hash=$2,password_salt=$3 where id=$1',[id,p.hash,p.salt]);};
 const admin={
  async createUser(p){try{const id=randomUUID(),h=hashPassword(p.password);await r.db.query('insert into auth.users(id,email,password_hash,password_salt) values($1,$2,$3,$4)',[id,p.email,h.hash,h.salt]);return {data:{user:{id,email:p.email}},error:null};}catch{return {data:null,error:{code:'AUTH_CREATE'}};}},
  async updateUserById(id,p){try{if(p.email)await r.db.query('update auth.users set email=$2 where id=$1',[id,p.email]);if(p.password)await setPassword(id,p.password);return {data:{user:dto(await user(id))},error:null};}catch{return {data:null,error:{code:'AUTH_UPDATE'}};}},
  async getUserById(id){return {data:{user:dto(await user(id))},error:null};},
  async deleteUser(id){await r.db.query('delete from auth.users where id=$1',[id]);return {data:{},error:null};}
 };
 const mfa={
  async listFactors(){const factors=(await user(currentId))?.factors||[];return {data:{all:factors,totp:factors},error:null};},
  async enroll(){if(!currentId)return {error:{code:'AUTH_REQUIRED'}};const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',secret=Array.from(randomBytes(32),x=>alphabet[x%32]).join(''),id=randomUUID(),u=await user(currentId),factors=[...(u.factors||[]),{id,factor_type:'totp',status:'unverified',secret}];await r.db.query('update auth.users set factors=$2 where id=$1',[currentId,JSON.stringify(factors)]);return {data:{id,totp:{secret,qr_code:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><text x="10" y="35">Offline: enter secret manually</text></svg>')}},error:null};},
  async challenge({factorId}){const u=await user(currentId);if(!u?.factors?.some(f=>f.id===factorId))return {error:{code:'FACTOR_REQUIRED'}};const id=randomUUID();r.challenges.set(id,{id:currentId,factorId,expires:Date.now()+300000});return {data:{id},error:null};},
  async verify({factorId,challengeId,code}){const c=r.challenges.get(challengeId),u=await user(currentId),factor=u?.factors?.find(f=>f.id===factorId);if(!c||c.id!==currentId||c.factorId!==factorId||c.expires<Date.now()||!factor||![-1,0,1].some(n=>totp(factor.secret,Date.now()+n*30000)===code))return {error:{code:'INVALID_TOTP'}};r.challenges.delete(challengeId);factor.status='verified';await r.db.query('update auth.users set factors=$2 where id=$1',[currentId,JSON.stringify(u.factors)]);return {data:{},error:null};}
 };
 return {from:name=>new Query(name,requestHeaders),async rpc(name,args={}){try{if(!/^zzws_[a-z0-9_]+$/.test(name))throw Error('Invalid RPC');const keys=Object.keys(args),call='public.'+ident(name)+'('+keys.map((k,i)=>ident(k)+'=>$'+(i+1)).join(',')+')';const metadata=await r.db.query("select proretset from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname=$1 and n.nspname='public'",[name]);const set=metadata.rows[0]?.proretset;const params=keys.map(k=>encoded(args[k]));let q=set?'select to_jsonb(t) as value from '+call+' t':'select '+call+' as value';if(Object.keys(requestHeaders).length){params.push(JSON.stringify(requestHeaders));const context='with request_context as materialized (select set_config(\'request.headers\',$'+params.length+',true) as configured) ';q=set?context+'select to_jsonb(t) as value from request_context cross join lateral (select * from '+call+' offset (case when request_context.configured is null then 0 else 0 end)) t':context+'select '+call+' as value from request_context where configured is not null';}const result=await r.db.query(q,params);return {data:set?result.rows.map(row=>row.value):result.rows[0]?.value??null,error:null};}catch(e){if(r.debug)console.error('Offline RPC',name,e.message);return {data:null,error:{code:e.code||'OFFLINE_RPC',hint:e.hint,message:'Local RPC failed'}};}},storage:{from:()=>({download:async()=>({data:null,error:{code:'OFFLINE_APK_ROUTE'}})})},auth:{admin,mfa,
  async signInWithPassword({email,password}){const u=(await r.db.query('select * from auth.users where email=$1',[email])).rows[0];if(!u?.password_hash)return {error:{code:'INVALID_CREDENTIALS'}};const actual=scryptSync(String(password),u.password_salt,32),expected=Buffer.from(u.password_hash,'hex');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return {error:{code:'INVALID_CREDENTIALS'}};currentId=u.id;currentToken=randomBytes(32).toString('hex');r.authSessions.set(currentToken,u.id);return {data:{user:dto(u),session:{access_token:currentToken,refresh_token:currentToken}},error:null};},
  async setSession(session){currentToken=session.access_token;currentId=r.authSessions.get(currentToken);return currentId?{data:{},error:null}:{error:{code:'INVALID_SESSION'}};},
  async signOut(){if(currentToken)r.authSessions.delete(currentToken);currentId=null;currentToken=null;return {error:null};}
 }};
}
