import {readFile,writeFile,mkdir,access} from 'node:fs/promises';import {randomUUID,randomBytes} from 'node:crypto';
import {registerHooks} from 'node:module';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {hashPassword} from './supabase-client.mjs';
let pgModule;try{pgModule=await import('@electric-sql/pglite');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;pgModule=await import(new URL('../../work/admin-notifications-stage1/supabase/tests/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url).href);}const {PGlite}=pgModule;
export const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const authSchema=`create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key,email text unique,password_hash text,password_salt text,factors jsonb not null default '[]');
grant usage on schema auth to service_role;grant all on auth.users to service_role;
create schema storage;create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);grant usage on schema storage to service_role;grant all on storage.objects to service_role;`;
// Vault contract stub for local SQL tests only. Production uses encrypted Supabase Vault.
const testVaultSchema=`create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text,new_name text default null,new_description text default null) returns uuid language plpgsql as $$declare result uuid;begin insert into vault.secrets(secret,name) values(new_secret,new_name) returning id into result;return result;end $$;
create function vault.update_secret(secret_id uuid,new_secret text default null) returns void language sql as $$update vault.secrets set secret=new_secret where id=secret_id$$;`;
export const DEMO_PASSWORD='24681012';
export async function createRuntime({dataDir=path.join(root,'work/isolated-api'),memory=true,debug=false,origin='http://127.0.0.1:8080',sourceRoot=process.env.ZZWS_API_SOURCE_ROOT,beforeSchemaFile}={}){
 if(globalThis.__ZZWS_OFFLINE__)throw Error('Only one offline runtime per process');
 if(!memory)await mkdir(dataDir,{recursive:true});
 const db=new PGlite(memory?undefined:path.join(dataDir,'postgres'));
 const fresh=!(await db.query("select to_regclass('public.zzws_users') as table_name")).rows[0].table_name;
 if(fresh){
  await db.exec(authSchema);
  await db.exec(testVaultSchema);
  const manifest=await import('../../scripts/unified-schema.mjs');
  for(const file of manifest.schemaFiles||manifest.cleanSchemaFiles||manifest.cleanStagingPlan){await beforeSchemaFile?.(file,db);await db.exec(await readFile(path.join(root,file),'utf8'));}
 }
 const r={offline:true,db,debug,authSessions:new Map(),challenges:new Map(),telegramMessages:[],pushMessages:[],oneCDocuments:new Map(),lastEvents:new Map()};globalThis.__ZZWS_OFFLINE__=r;
 const reportAccepted=new Map();r.reportEmailOutcomes=[];r.reportEmails=[];r.reportEmailSend=async(job,message)=>{if(reportAccepted.has(job.id))return reportAccepted.get(job.id);const result=r.reportEmailOutcomes.shift()||'accepted';if(result==='accepted'||result==='lost'){const accepted={result:'accepted',id:randomUUID()};reportAccepted.set(job.id,accepted);r.reportEmails.push({subject:message.subject,text:message.text,jobId:job.id,to:message.to,cc:message.cc,bcc:message.bcc||[],envelopeTo:message.envelopeTo||[...message.to,...message.cc,...(message.bcc||[])],replyTo:message.reply_to,files:await Promise.all(message.attachments.map(async a=>({name:a.filename,hash:await (await import('../../supabase/functions/zzws-api/report-routes.mjs')).sha(Uint8Array.from(Buffer.from(a.content,'base64')))})))});if(result==='lost')throw Error('Simulated lost acknowledgement');return accepted;}return {result};};
 if(fresh)await seed(r);
 await db.exec('set role service_role');
 let envKey;
 if(!memory)try{envKey=JSON.parse(await readFile(path.join(dataDir,'runtime.json'),'utf8')).key;}catch{}
 if(!envKey){envKey=randomBytes(32).toString('hex');if(!memory)await writeFile(path.join(dataDir,'runtime.json'),JSON.stringify({key:envKey}),{mode:0o600});}
 const env={SUPABASE_URL:'http://127.0.0.1:8080/offline-supabase',SUPABASE_SERVICE_ROLE_KEY:envKey,SUPABASE_ANON_KEY:'offline-public',ZZWS_OFFLINE_MODE:'true',ZZWS_REPORT_EMAIL_MODE:'offline',ZZWS_REPORT_FROM:'report@zzws.invalid',ZZWS_APK_VERSION:'6.11.0-offline-review',ZZWS_ALLOWED_ORIGINS:origin+','+origin.replace('127.0.0.1','localhost'),ZZWS_TELEGRAM_MODE:'offline',ZZWS_APK_BUCKET:'offline-private',ZZWS_APK_PATH:'ZZWS-Admin-offline.apk'};
 globalThis.Deno={env:{get:name=>env[name]},serve:handler=>{r.handle=handler;}};
 const sdkURL=new URL('./supabase-client.mjs',import.meta.url).href;
 const hooks=registerHooks({resolve(specifier,context,next){if(specifier==='npm:@supabase/supabase-js@2.95.0')return {url:sdkURL,shortCircuit:true};return next(specifier,context);}});
 const handler=sourceRoot?new URL('file:///'+path.resolve(sourceRoot,'index.ts').replace(/\\/g,'/')):new URL('../../supabase/functions/zzws-api/index.ts',import.meta.url);
 await import(handler.href+'?offline='+randomUUID());
 if(!r.handle)throw Error('Actual ZZWS handler did not register');
 r.close=async()=>{hooks.deregister();await db.close();delete globalThis.__ZZWS_OFFLINE__;};
 return r;
}
async function seed(r){
 const {defaultRules}=await import('../../supabase/functions/zzws-api/rules.mjs');
 const definitions=[['owner','admin','owner',true,true],['manager','admin','manager',true,false],['viewer','admin','viewer',false,false],['price','admin','price',false,false],['dealer','client',null,false,false],['kp','client',null,false,false],['denied','admin',null,false,false],['disabled','admin','manager',true,true]];
 const users=[];
 for(const [name,role,scope,mobileAdminEnabled,telegramEnabled] of definitions){
  const id=randomUUID(),p=hashPassword(DEMO_PASSWORD),rowsList=[1,2,3].map(i=>({id:randomUUID(),organization:'ZZWS test '+name+' organization '+i,address:'Synthetic address '+i,contact:'Synthetic contact '+i}));
  const profile={role,customerCode:role==='client'?'zzws-test-'+name:'',client:'ZZWS test '+name,sheet:name==='kp'?'KP':'Dealers',brands:[],allBrands:true,rowsList};
  await r.db.query('insert into auth.users(id,email,password_hash,password_salt) values($1,$2,$3,$4)',[id,'zzws-test-'+name+'@users.zzws.invalid',p.hash,p.salt]);
  await r.db.query('insert into zzws_users(id,login,profile,active,needs_password_setup) values($1,$2,$3,$4,false)',[id,'zzws-test-'+name,JSON.stringify(profile),name!=='disabled']);
  if(scope)await r.db.query('insert into zzws_admin_scopes(user_id,scope) values($1,$2)',[id,scope]);users.push({id,name,rowsList});
  if((await r.db.query("select to_regclass('public.zzws_user_channels') as t")).rows[0].t)await r.db.query('insert into zzws_user_channels(user_id,mobile_admin_enabled,telegram_enabled) values($1,$2,$3) on conflict(user_id) do update set mobile_admin_enabled=excluded.mobile_admin_enabled,telegram_enabled=excluded.telegram_enabled',[id,mobileAdminEnabled,telegramEnabled]);
 }
 const products=Array.from({length:20},(_,i)=>({articul:'test-'+String(i+1).padStart(3,'0'),name:['ZZWS Test TV','ZZWS Test Fridge','ZZWS Test Washer'][i%3]+' '+(i+1),brand:['Samsung','Bosch','LG'][i%3],category:['Հեռուստացույց 65','Սառնարան','Լվացքի մեքենա'][i%3],retail:120000+i*1000,base:140000+i*1000,ws:100000+i*1000,kp:90000+i*1000,kpPromo:i%2?0:80000+i*1000,stocks:{'003':i%4===0?0:i%5,'023':i%2,'026':0,'031':0,'050':i%3===0?0:8}}));
 const version=randomUUID();await r.db.query('insert into zzws_versions(id,products,actor) values($1,$2,$3)',[version,JSON.stringify(products),users[0].id]);
 await r.db.query('update zzws_state set version=$1,rules=$2 where id',[version,JSON.stringify(defaultRules())]);
 await r.db.query("update zzws_user_channels set telegram_id='10001' where user_id=$1",[users[0].id]);
 await r.db.query("insert into zzws_notification_recipients(channel,destination,user_id,active) values('telegram','10001',$1,true),('android','offline-owner-device',$1,true)",[users[0].id]);
 await r.db.query("insert into zzws_admin_devices(user_id,device_id,token) values($1,'offline-seeded-device','offline-owner-device')",[users[0].id]);
 await r.db.exec("update zzws_notification_settings set enabled=true;update zzws_receipt_settings set mode='on'");
 r.seededUsers=users;
}
