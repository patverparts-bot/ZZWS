export async function runAndroidBatch({store,send,enabled=false,maxJobs=10}){
 const report={sent:0,retry:0,uncertain:0,dead:0,stopped:0};if(!enabled)return {...report,disabled:true};
 if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>100)throw Error('invalid_batch');
 for(let i=0;i<maxJobs;i++){
  const job=await store.rpc('zzws_claim_android',{});if(!job)break;
  const args={p_id:job.id,p_token:job.leaseToken};
  const current=await store.rpc('zzws_begin_android',args);if(!current){report.stopped++;break;}
  let result,described=current;
  // Read the summary only after the existing lease and recipient permissions pass.
  if(current.kind?.startsWith('order.')&&store.orderSummary){
   try{const summary=await store.orderSummary(current.orderId,current.revision);if(!summary)result={state:'dead'};else described={...current,orderSummary:summary};}
   catch{result={state:'retry',retrySeconds:30};}
  }
  if(!result)try{result=await send(described);}catch{result={state:'uncertain'};}
  if(!['sent','retry','dead','uncertain'].includes(result.state)){report.stopped++;break;}
  const saved=await store.rpc('zzws_finish_notification',{...args,p_result:result.state,p_message:result.messageId||null,p_retry_seconds:result.retrySeconds||30});
  if(!saved){report.stopped++;break;}report[result.state]++;
 }
 return report;
}

