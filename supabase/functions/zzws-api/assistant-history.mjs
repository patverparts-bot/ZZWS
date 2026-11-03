import {validateCorrection,lessonFromReview} from './assistant-learning.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function conversationId(value,fail){
  if(value==null)return crypto.randomUUID();
  if(typeof value!=='string'||!uuid.test(value))fail(400,'Սխալ զրույցի համար');
  return value;
}
export function historyEntry(user,payload,result,conversation){
  const actor={login:user.login||'',name:user.person?.name||user.client||user.login||'',role:user.role};
  const response=JSON.parse(JSON.stringify(result));
  const request={message:payload.message.trim(),context:payload.context||[],advisor:payload.advisor||null,locale:payload.locale||null,refresh:payload.refresh===true,orderPriceMode:payload.orderPriceMode||'WS',...(payload.learningKey?{learningKey:payload.learningKey}:{})};
  const names=['products','choices','recommendations','publicRecommendations'].flatMap(key=>(response[key]||[]).map(p=>p.name+' '+p.articul));
  return {user_id:user.id,actor,conversation_id:conversation,request,response,search_text:[actor.login,actor.name,request.message,response.answer,...names].join('\n')};
}
function dateBoundary(value,end,fail){
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,'Ստուգեք ամսաթիվը');
  const date=new Date(value+'T00:00:00+04:00');
  if(!Number.isFinite(+date)||new Date(+date+4*3600000).toISOString().slice(0,10)!==value)fail(400,'Ստուգեք ամսաթիվը');
  return new Date(+date+(end?86400000:0)).toISOString();
}
export async function assistantHistoryRoutes({path,req,user,body,table,query,json,fail,audit,service}){
  if(path!=='admin/assistant-history'&&path!=='admin/assistant-history/review')return null;
  if(user.role!=='admin'||user.adminScope!=='owner')fail(403,'Հասանելի է միայն սեփականատիրոջը');
  if(path==='admin/assistant-history'&&req.method==='GET'){
    const params=new URL(req.url).searchParams,offset=Number(params.get('offset')||0),search=(params.get('search')||'').trim(),status=params.get('status')||'';
    const from=dateBoundary(params.get('from'),false,fail),to=dateBoundary(params.get('to'),true,fail),conversation=params.get('conversation')||'';
    if(!Number.isSafeInteger(offset)||offset<0||offset>100000||search.length>100||!['','unreviewed','incorrect','correct'].includes(status)||from&&to&&from>=to||conversation&&!uuid.test(conversation))fail(400,'Ստուգեք որոնման պայմանները');
    let q=table('assistant_history').select('id,created,user_id,actor,conversation_id,request,response,review_status,review_note,review_correction,reviewed_at,revision',{count:'exact'}).order('created',{ascending:false}).order('id',{ascending:false}).range(offset,offset+19);
    if(from)q=q.gte('created',from);if(to)q=q.lt('created',to);if(status)q=q.eq('review_status',status);if(conversation)q=q.eq('conversation_id',conversation);
    if(search)q=q.ilike('search_text','%'+search.replace(/[\\%_]/g,'\\$&')+'%');
    const result=await q;if(result.error)fail(500,'Չհաջողվեց բեռնել պատմությունը');
    return json({rows:result.data,total:result.count,offset,limit:20});
  }
  if(path==='admin/assistant-history/review'&&req.method==='POST'){
    const p=await body(req);
    if(!uuid.test(p.id||'')||!['unreviewed','incorrect','correct'].includes(p.status)||typeof p.note!=='string'||p.note.length>2000||!Number.isSafeInteger(p.revision)||p.revision<0)fail(400,'Ստուգեք գնահատականը և մեկնաբանությունը');
    let correction;try{correction=validateCorrection(p.correction);}catch(error){fail(error.code||400,error.message);}
    const original=await query(table('assistant_history').select('id,request,response').eq('id',p.id).maybeSingle());if(!original)fail(404,'Գրառումը չի գտնվել');
    let lesson;try{lesson=lessonFromReview(original,correction);}catch(error){fail(error.code||400,error.message);}
    const row=await query(service.rpc('zzws_review_assistant_answer',{p_id:p.id,p_actor:user.id,p_revision:p.revision,p_status:p.status,p_note:p.note.trim(),p_correction:correction,p_key:lesson.intent_key,p_excluded:lesson.excluded_articuls}));
    if(!row)fail(409,'Գրառումն արդեն փոխվել է։ Թարմացրեք պատմությունը');
    await audit(user.id,'assistant_review',JSON.stringify({id:p.id,status:p.status}));
    return json(row);
  }
  fail(405,'Մեթոդը չի թույլատրվում');
}
