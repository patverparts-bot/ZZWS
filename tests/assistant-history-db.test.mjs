import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
let pg;try{pg=await import('@electric-sql/pglite');}catch{pg=await import('../work/admin-notifications-stage1/supabase/tests/node_modules/@electric-sql/pglite/dist/index.js');}
test('history is private; service can insert and review but cannot change the saved question/answer',async()=>{
 const db=new pg.PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261103102526_assistant_review_history.sql',import.meta.url),'utf8'));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from zzws_assistant_history'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');const {rows:[row]}=await db.query("insert into zzws_assistant_history(user_id,actor,conversation_id,request,response,search_text) values(gen_random_uuid(),'{}',gen_random_uuid(),'{\"message\":\"fridge\"}','{\"answer\":\"answer\"}','fridge') returning id");
 await db.query("update zzws_assistant_history set review_status='incorrect',review_note='Wrong category',revision=1 where id=$1",[row.id]);
 await assert.rejects(db.query("update zzws_assistant_history set response='{}' where id=$1",[row.id]),/permission denied/);
 const {rows:[saved]}=await db.query('select * from zzws_assistant_history where id=$1',[row.id]);assert.equal(saved.response.answer,'answer');assert.equal(saved.review_status,'incorrect');
 }finally{await db.close();}
});
