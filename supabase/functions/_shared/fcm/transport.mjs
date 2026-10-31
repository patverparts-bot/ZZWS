// Server-only adapter. No network activity on import or while disabled.
export function fcmTransport({projectId,accessToken,enabled=false,fetchImpl=globalThis.fetch}){
 if(!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId||''))throw Error('invalid_firebase_project');
 return async(job)=>{
  if(!enabled)return {state:'disabled'};
  const kinds=['order.created','order.status','order.changed','order.comment','catalog.prices','catalog.offers','system'],kind=job?.kind||'order.changed';
  if(!job||!kinds.includes(kind)||typeof job.token!=='string'||job.token.length<20||job.token.length>4096||/\s/.test(job.token)||!/^[a-f0-9-]{36}$/i.test(job.eventId)||kind.startsWith('order.')&&!/^[a-f0-9-]{36}$/i.test(job.orderId)||!Number.isSafeInteger(job.revision)||job.revision<1)return {state:'dead',code:'invalid_job'};
  const data={eventId:job.eventId,revision:String(job.revision),...(kind.startsWith('order.')?{orderId:job.orderId}:{}),...(job.kind?{kind}:{}),...(/^[a-f0-9-]{36}$/i.test(job.userId||'')?{userId:job.userId}:{})};
  if(job.approvalAction!==undefined){if(!['requested','approved','declined','deferred'].includes(job.approvalAction)||!kind.startsWith('order.'))return {state:'dead',code:'invalid_job'};data.approvalAction=job.approvalAction;if(job.approvalAction==='deferred'){if(!Number.isSafeInteger(job.reviewMinutes)||job.reviewMinutes<1||job.reviewMinutes>60)return {state:'dead',code:'invalid_job'};data.reviewMinutes=String(job.reviewMinutes);}}
  let bearer;try{bearer=await accessToken();if(typeof bearer!=='string'||!bearer||/\s/.test(bearer))throw Error();}catch{return {state:'retry',code:'oauth_unavailable',retrySeconds:60};}
  try{
   // Data-only: Android checks local logout state and deduplicates before displaying.
   const response=await fetchImpl('https://fcm.googleapis.com/v1/projects/'+projectId+'/messages:send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({message:{token:job.token,data,android:{priority:'HIGH',ttl:'300s'}}})});
   const result=await response.json();
   if(response.status===200&&typeof result.name==='string'&&result.name.startsWith('projects/'+projectId+'/messages/'))return {state:'sent',messageId:result.name};
   if(response.status===429&&result.error?.status==='RESOURCE_EXHAUSTED')return {state:'retry',code:'rate_limit',retrySeconds:60};
   if([400,401,403,404].includes(response.status)&&result.error)return {state:'dead',code:'provider_rejected'};
   return {state:'uncertain',code:'ambiguous_response'};
  }catch(error){return ['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT'].includes(error?.cause?.code)?{state:'retry',code:'no_connection',retrySeconds:30}:{state:'uncertain',code:'transport_failure'};}
 };
}
