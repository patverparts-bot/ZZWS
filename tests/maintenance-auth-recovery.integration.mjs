import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
let pg;try{pg=await import('@electric-sql/pglite');}catch{pg=await import('../work/admin-notifications-stage1/supabase/tests/node_modules/@electric-sql/pglite/dist/index.js');}
const migration=await readFile(new URL('../supabase/migrations/20261101224815_maintenance_auth_recovery.sql',import.meta.url),'utf8');
const password='Synthetic credential test 246810',salt='synthetic-recovery-salt',hash=scryptSync(password,salt,32).toString('hex');
async function fixture(){
 const db=new pg.PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;
 create table auth.users(id uuid primary key,email text unique,encrypted_password text not null,phone text,
 email_confirmed_at timestamptz,phone_confirmed_at timestamptz,
 confirmed_at timestamptz generated always as (coalesce(email_confirmed_at,phone_confirmed_at)) stored,
 confirmation_token text not null default '',recovery_token text not null default '',
 email_change_confirm_status integer not null default 0,recovery_sent_at timestamptz);
 create table auth.identities(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 provider text,identity_data jsonb,email text generated always as (identity_data->>'email') stored);
 create table auth.mfa_factors(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 secret text,status text,last_challenged_at timestamptz,last_webauthn_challenge_data jsonb);
 create table auth.mfa_recovery_code_sets(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,codes jsonb);
 create table auth.webauthn_credentials(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,credential_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,token text);
 create table public.zzws_users(id uuid primary key references auth.users(id) on delete cascade,active boolean,profile jsonb);
 create table public.zzws_admin_scopes(user_id uuid primary key references public.zzws_users(id),scope text);
 create table public.unrelated_inventory(id integer primary key,price integer,stock integer);
 insert into public.unrelated_inventory values(1,123456,7);`);
 await db.exec(migration);
 const owner=randomUUID(),other=randomUUID(),identity=randomUUID(),factor=randomUUID();
 for(const [id,email]of [[owner,'owner@example.invalid'],[other,'client@example.invalid']]){
  await db.query("insert into auth.users(id,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_confirm_status,recovery_sent_at) values($1,$2,$3,'2026-10-01','old-confirmation','old-recovery',1,now())",[id,email,hash]);
  await db.query('insert into public.zzws_users values($1,true,$2)',[id,JSON.stringify({role:id===owner?'admin':'client',label:id===owner?'protected':'restorable'})]);
 }
 await db.query("insert into public.zzws_admin_scopes values($1,'owner')",[owner]);
 await db.query("insert into auth.identities values($1,$2,'email',$3,default)",[identity,other,JSON.stringify({email:'client@example.invalid',sub:other})]);
 await db.query("insert into auth.mfa_factors values($1,$2,'synthetic-encrypted-factor','verified',now(),$3)",[factor,other,JSON.stringify({challenge:'must-not-revive'})]);
 await db.query('insert into auth.mfa_recovery_code_sets values($1,$2,$3)',[randomUUID(),other,JSON.stringify(['synthetic-hashed-recovery-code'])]);
 await db.query('insert into auth.webauthn_credentials values($1,$2,$3)',[randomUUID(),other,JSON.stringify({counter:12,publicKey:'synthetic-public-key'})]);
 await db.query("insert into auth.sessions values($1,$2,'synthetic-old-session')",[randomUUID(),other]);
 return {db,owner,other,identity,factor};
}
const capture=async(f)=>(await f.db.query('select zzws_maintenance_private.auth_snapshot($1::uuid[],$2::uuid) as value',[[f.other],f.owner])).rows[0].value;
const stable=async(db,sql)=>(await db.query(sql)).rows;

test('actual credential SQL restores passwords, identities and MFA while preserving the owner and unrelated data',{timeout:120000},async()=>{
 const f=await fixture(),{db,owner,other}=f;
 try{
  const main=await stable(db,`select to_jsonb(u) as value from auth.users u where id='${owner}'`),inventory=await stable(db,'select * from unrelated_inventory'),profile=(await db.query('select * from zzws_users where id=$1',[other])).rows[0];
  const snapshot=await capture(f);assert.equal(snapshot.sessionsRestored,false);assert.equal(snapshot.tables.users[0].recovery_token,'');assert.equal(snapshot.tables.users[0].confirmation_token,'');assert.equal(snapshot.tables.mfa_factors[0].last_webauthn_challenge_data,null);
  await assert.rejects(db.query('select zzws_maintenance_private.auth_delete($1::uuid[],$2::uuid)',[[other],owner]),e=>e.code==='PT409','account dependencies cannot be silently cascaded');
  await db.query('delete from zzws_users where id=$1',[other]);
  assert.equal((await db.query('select zzws_maintenance_private.auth_delete($1::uuid[],$2::uuid) as n',[[other],owner])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::integer as n from auth.identities')).rows[0].n,0);
  assert.equal((await db.query('select zzws_maintenance_private.auth_restore($1::jsonb,$2::uuid) as n',[JSON.stringify(snapshot),owner])).rows[0].n,1);
  await db.query('insert into zzws_users values($1,$2,$3)',[profile.id,profile.active,JSON.stringify(profile.profile)]);
  const restored=(await db.query('select * from auth.users where id=$1',[other])).rows[0];
  assert.ok(timingSafeEqual(Buffer.from(restored.encrypted_password,'hex'),scryptSync(password,salt,32)),'archived password verifier remains usable');
  assert.equal(restored.recovery_token,'');assert.equal(restored.confirmed_at.toISOString(),'2026-10-01T00:00:00.000Z');
  assert.equal((await db.query('select email from auth.identities where id=$1',[f.identity])).rows[0].email,'client@example.invalid');
  assert.equal((await db.query('select secret from auth.mfa_factors where id=$1',[f.factor])).rows[0].secret,'synthetic-encrypted-factor');
  assert.equal((await db.query('select count(*)::integer as n from auth.sessions')).rows[0].n,0,'historical login sessions are never revived');
  assert.deepEqual(await stable(db,`select to_jsonb(u) as value from auth.users u where id='${owner}'`),main);
  assert.deepEqual(await stable(db,'select * from unrelated_inventory'),inventory);
  await assert.rejects(db.query('select zzws_maintenance_private.auth_restore($1::jsonb,$2::uuid)',[JSON.stringify(snapshot),owner]),e=>e.code==='PT409','duplicate restore cannot overwrite existing credentials');
 }finally{await db.close();}
});

test('private credential helpers reject protected, malformed, incomplete and schema-mismatched archives',{timeout:120000},async()=>{
 const f=await fixture(),{db,owner,other}=f;
 try{
  const snapshot=await capture(f);assert.deepEqual((await db.query('select zzws_maintenance_private.auth_validate($1::jsonb,$2::uuid) as ids',[JSON.stringify(snapshot),owner])).rows[0].ids,[other]);
  for(const ids of [[owner],[other,other],[null]])await assert.rejects(db.query('select zzws_maintenance_private.auth_snapshot($1::uuid[],$2::uuid)',[ids,owner]),e=>e.code==='PT400');
  const mutations=[s=>delete s.format,s=>delete s.protectedOwner,s=>s.userIds.push(owner),s=>delete s.tables.users[0].encrypted_password,s=>s.schemas.users[0].type='text',s=>s.tables.users[0].id=owner,s=>s.tables.unapproved=[]];
  for(const mutate of mutations){const bad=structuredClone(snapshot);mutate(bad);await assert.rejects(db.query('select zzws_maintenance_private.auth_validate($1::jsonb,$2::uuid)',[JSON.stringify(bad),owner]),e=>['PT400','PT409'].includes(e.code));}
  await db.exec('set role service_role');await assert.rejects(db.query('select zzws_maintenance_private.auth_snapshot($1::uuid[],$2::uuid)',[[other],owner]),e=>e.code==='42501');await db.exec('reset role');
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select zzws_maintenance_private.auth_restore($1::jsonb,$2::uuid)',[JSON.stringify(snapshot),owner]),e=>e.code==='42501');await db.exec('reset role');}
  assert.equal((await db.query('select count(*)::integer as n from auth.users')).rows[0].n,2);
 }finally{await db.close();}
});
