import {clean,FAMILY_LABELS} from './appliance-taxonomy.mjs';
import {createHash} from 'node:crypto';
const omitted=new Set(['language','page','shown','pending']);
const hash=value=>createHash('sha256').update(value).digest('hex');
export function normalizeLearningKey(key){
 if(/^selection:[0-9a-f]{64}$|^request:[0-9a-f]{64}$|^similar-category:/i.test(key))return key;
 if(key.startsWith('selection:'))return 'selection:'+hash(key.slice(10));
 return 'request:'+hash(key);
}
export function feedbackSemanticKey(state){
 if(!state?.category)return null;
 const ignore=new Set([...omitted,'best','budgetSkipped']);
 return 'selection:'+hash(JSON.stringify(Object.fromEntries(Object.entries(state).filter(([key])=>!ignore.has(key)).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,key==='brand'?clean(value):value]))));
}
export function feedbackKey(payload){
 const state=Object.fromEntries(Object.entries(payload.advisor||{}).filter(([key])=>!omitted.has(key)).sort(([a],[b])=>a.localeCompare(b)));
 return 'request:'+hash(JSON.stringify({question:clean(payload.message),state,context:[...new Set(payload.context||[])].sort()}));
}
export function validateCorrection(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(Error('Ստուգեք ուղղումը'),{code:400});
 const reason=value.reason||'unspecified',expectedRequest=value.expectedRequest||'',scope=value.scope||'request';
 if(!['unspecified','category','subtype','requirements','too_distant','irrelevant'].includes(reason)||typeof expectedRequest!=='string'||expectedRequest.length>1200||!['request','category'].includes(scope)||scope==='category'&&(reason!=='too_distant'||!!expectedRequest.trim()))throw Object.assign(Error('Ստուգեք ուղղման պայմանները'),{code:400});
 if(value.excludedArticuls!=null&&(!Array.isArray(value.excludedArticuls)||value.excludedArticuls.length>30||value.excludedArticuls.some(id=>typeof id!=='string'||!id||id.length>100)))throw Object.assign(Error('Ստուգեք ապրանքների ցանկը'),{code:400});
 return {reason,expectedRequest:expectedRequest.trim(),scope,excludedArticuls:[...new Set(value.excludedArticuls||[])]};
}
export function lessonFromReview(row,correction){
 const products=['recommendations','publicRecommendations','choices'].flatMap(key=>row.response[key]||[]),offered=new Set(products.map(p=>p.articul));
 // Selecting specific bad cards keeps the good cards usable. With no selection,
 // a negative answer rejects that set only for the same query and requirements.
 const excluded=correction.excludedArticuls.length?correction.excludedArticuls.filter(id=>offered.has(id)):[...offered];
 if(correction.excludedArticuls.some(id=>!offered.has(id)))throw Object.assign(Error('Ապրանքը այս պատասխանում չկա'),{code:400});
 const family=row.response.advisor?.category;
 const key=correction.scope==='category'&&family&&Object.hasOwn(FAMILY_LABELS,family)?'similar-category:'+family:row.request.learningKey?normalizeLearningKey(row.request.learningKey):feedbackSemanticKey(row.response.advisor)||feedbackKey(row.request);
 return {intent_key:key,correction,excluded_articuls:correction.scope==='category'?[]:excluded};
}
export function combineLessons(lessons){
 const excluded=new Set(),ids=[];let expectedRequest='',strictSimilarity=false,avoidAnswer=false;
 for(const row of lessons||[]){for(const id of row.excluded_articuls||[])excluded.add(id);if(row.correction?.expectedRequest)expectedRequest=row.correction.expectedRequest;if(row.correction?.reason==='too_distant')strictSimilarity=true;if(!(row.excluded_articuls||[]).length&&!row.correction?.expectedRequest&&['unspecified','irrelevant'].includes(row.correction?.reason||'unspecified'))avoidAnswer=true;ids.push(row.history_id);}
 return {excluded,expectedRequest,strictSimilarity,avoidAnswer,ids};
}
