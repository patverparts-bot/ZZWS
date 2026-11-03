import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {answerQuestion} from '../supabase/functions/zzws-api/assistant.mjs';import {historyEntry} from '../supabase/functions/zzws-api/assistant-history.mjs';
import {feedbackSemanticKey,lessonFromReview,validateCorrection,combineLessons} from '../supabase/functions/zzws-api/assistant-learning.mjs';
let pg;try{pg=await import('@electric-sql/pglite');}catch{pg=await import('../work/admin-notifications-stage1/supabase/tests/node_modules/@electric-sql/pglite/dist/index.js');}
const products=Array.from({length:7},(_,i)=>({articul:'81100'+i,name:'Bosch FR'+i,brand:'Bosch',category:i<4?'Սառնարաններ':'Ներկառուցվող սառնարաններ',wholesale:100000+i*1000}));
const knowledge={products:Object.fromEntries(products.map((p,i)=>[p.articul,[p.name,'https://www.zigzag.am/en/'+p.articul+'.html','2026-11-03T00:00:00Z',[['Total volume(l)','300 l'],['Freezer volume (l)','80'],['Dimensions(HxWxD)','180 x 60 x 65 cm'],...(i>=4?[['Embedding Dimensions(HxWxD) (cm)','178 x 56 x 55']]:[])]]]))};
test('owner feedback changes future semantic-equivalent answers; undo and stale revisions work atomically',async()=>{
 const db=new pg.PGlite(),owner=randomUUID(),viewer=randomUUID();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create table zzws_users(id uuid primary key,active boolean,profile jsonb);create table zzws_admin_scopes(user_id uuid,scope text);grant select on zzws_users,zzws_admin_scopes to service_role;');
 for(const [id,scope]of [[owner,'owner'],[viewer,'viewer']]){await db.query("insert into zzws_users values($1,true,'{\"role\":\"admin\"}')",[id]);await db.query('insert into zzws_admin_scopes values($1,$2)',[id,scope]);}
 for(const name of ['20261103102526_assistant_review_history.sql','20261103105414_assistant_feedback_learning.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const original={message:'Холодильник до 200 тысяч драм',locale:'ru'},paraphrase={message:'Подбери холодильник бюджет 200000 драм',locale:'ru'},answer=await answerQuestion(original,products,knowledge),same=await answerQuestion(paraphrase,products,knowledge);
 assert.equal(feedbackSemanticKey(answer.advisor),feedbackSemanticKey(same.advisor));
 const entry=historyEntry({id:owner,role:'admin'},original,answer,randomUUID()),id=randomUUID(),correction=validateCorrection({reason:'irrelevant'});entry.id=id;
 await db.query('insert into zzws_assistant_history(id,user_id,actor,conversation_id,request,response,search_text) values($1,$2,$3,$4,$5,$6,$7)',[id,owner,JSON.stringify(entry.actor),entry.conversation_id,JSON.stringify(entry.request),JSON.stringify(entry.response),entry.search_text]);
 const lesson=lessonFromReview(entry,correction),review=async(revision,status,actor=owner,c=correction,l=lesson)=>(await db.query('select zzws_review_assistant_answer($1,$2,$3,$4,$5,$6,$7,$8) as result',[id,actor,revision,status,'Owner correction',JSON.stringify(c),l.intent_key,l.excluded_articuls])).rows[0].result;
 await db.exec('set role service_role');assert.equal((await review(0,'incorrect')).learningActive,true);
 const lessons=(await db.query('select * from zzws_assistant_lessons where intent_key=$1',[feedbackSemanticKey(same.advisor)])).rows;
 const learned=await answerQuestion(paraphrase,products,knowledge,{learning:combineLessons(lessons)});assert.equal(learned.recommendations.some(p=>answer.recommendations.some(old=>old.articul===p.articul)),false);assert.ok(learned.recommendations.length);
 assert.equal(await review(0,'correct'),null);assert.equal((await review(1,'correct')).learningActive,false);assert.equal((await db.query('select * from zzws_assistant_lessons')).rows.length,0);
 await assert.rejects(review(2,'incorrect',viewer),/owner_required/);
 const corrected=validateCorrection({reason:'requirements',expectedRequest:'Встраиваемый холодильник'}),rule=lessonFromReview(entry,corrected);await review(2,'incorrect',owner,corrected,rule);
 const refined=await answerQuestion(paraphrase,products,knowledge,{learning:combineLessons((await db.query('select * from zzws_assistant_lessons')).rows)});assert.equal(refined.advisor.budgetMax,200000);assert.equal(refined.advisor.builtIn,true);assert.ok(refined.recommendations.length);for(const p of refined.recommendations)assert.match(products.find(x=>x.articul===p.articul).category,/Ներկառուցվող/);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from zzws_assistant_lessons'),/permission denied/);
 }finally{await db.close();}
});
test('feedback cannot silently apply an arbitrary broad correction or reject products absent from that answer',()=>{
 for(const c of [{scope:'global'},{scope:'category',reason:'category'},{expectedRequest:'x'.repeat(1201)},{excludedArticuls:['x'.repeat(101)]}])assert.throws(()=>validateCorrection(c));
 assert.throws(()=>lessonFromReview({request:{message:'hello'},response:{choices:[]}},validateCorrection({excludedArticuls:['missing']})));
 assert.deepEqual(combineLessons([]).ids,[]);
});
