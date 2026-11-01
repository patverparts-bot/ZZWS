// Bounded Cron invocations reuse the same queue/leases/transport as the existing Node sender.
// No continuously running paid server is required. No sender or database is touched while disabled.
export function scheduledPush({env,createStore,createSender}){
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return async request=>{
  if(env('ZZWS_PUSH_EDGE_ENABLE_SEND')!=='true')return json({disabled:true});
  const secret=env('ZZWS_PUSH_WORKER_SECRET'),provided=request.headers.get('x-zzws-worker-key')||'';
  if(request.method!=='POST'||typeof secret!=='string'||secret.length<32||provided.length!==secret.length)return json({error:'Forbidden'},403);
  let difference=0;for(let i=0;i<secret.length;i++)difference|=secret.charCodeAt(i)^provided.charCodeAt(i);if(difference)return json({error:'Forbidden'},403);
  try{
   const send=await createSender();const store=await createStore();
   const {runAndroidBatch}=await import('./worker.mjs');return json(await runAndroidBatch({store,send,enabled:true,maxJobs:5}));
  }catch{return json({error:'Sender stopped safely'},503);}
 };
}

