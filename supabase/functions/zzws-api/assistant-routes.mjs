import {answerQuestion, validateQuestion} from './assistant.mjs';
import {conversationId,historyEntry} from './assistant-history.mjs';
import {feedbackKey,feedbackSemanticKey,combineLessons} from './assistant-learning.mjs';
const gates = new Map();
// Best-effort per-isolate protection in addition to authenticated application access.
export async function assistantRoutes(c) {
  const {path, req, user, body, current, project, json, fail, knowledge, publicCatalog, options = {}} = c;
  if (path !== 'assistant/chat' || req.method !== 'POST') return null;
  if (Number(req.headers.get('content-length') || 0) > 16000) fail(413, 'Հարցումը չափազանց մեծ է։');
  const payload = await body(req),validated=validateQuestion(payload);
  const conversation=conversationId(payload.conversationId,fail);
  const now = Date.now();
  for (const [id, gate] of gates) if (now - gate.start > 60000 && !gate.active) gates.delete(id);
  const gate = gates.get(user.id) || {start: now, count: 0, active: 0};
  if (now - gate.start >= 60000) { gate.start = now; gate.count = 0; }
  if (gate.count >= 15 || gate.active >= 2) fail(429, 'Խնդրում ենք մի փոքր սպասել և կրկին փորձել։');
  gate.count++; gate.active++; gates.set(user.id, gate);
  try {
    const version = await current();
    const products = project(version.products, user, version.rules,{mainWarehouses:version.mainWarehouses});
    // The request may select KP only for an authenticated administrator.
    // Prices still come from the server-projected catalogue on every turn.
    const orderPriceMode=user.role==='admin'&&payload.orderPriceMode==='KP'?'KP':'WS';
    // Production assistant is fully deterministic: no provider request or usage charge,
    // even if legacy free-tier provider variables remain configured on the project.
    const baseOptions={...options,freeTierConfirmed:false,orderPriceMode,publicCatalog};
    let result=await answerQuestion(payload, products, knowledge, baseOptions);
    const semanticKey=feedbackSemanticKey(result.advisor),family=result.advisor?.category;
    const keys=[feedbackKey(validated),...(semanticKey?[semanticKey]:[]),...(family?['similar-category:'+family]:[])];
    const lessons=c.table&&c.query?await c.query(c.table('assistant_lessons').select('history_id,correction,excluded_articuls').in('intent_key',keys).order('updated',{ascending:true})):[];
    const learning=combineLessons(lessons);
    if(lessons.length)result=await answerQuestion(payload, products, knowledge, {...baseOptions,learning});
    if(result.choices)result.choices=result.choices.filter(p=>!learning.excluded.has(p.articul));
    if(learning.ids.length)result.learningApplied={count:learning.ids.length};
    if(c.table&&c.query){
      const saved=await c.query(c.table('assistant_history').insert(historyEntry(user,{...validated,orderPriceMode,learningKey:semanticKey||feedbackKey(validated)},result,conversation)).select('id').single());
      return json({...result,historyId:saved.id,conversationId:conversation});
    }
    return json(result);
  } finally { gate.active--; }
}
