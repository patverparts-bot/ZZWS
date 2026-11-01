import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {scheduledPush} from '../_shared/fcm/scheduled.mjs';
import {firebaseAccessToken} from '../_shared/fcm/oauth.mjs';
import {fcmTransport} from '../_shared/fcm/transport.mjs';
import {readOrderSummary} from '../_shared/fcm/order-summary.mjs';
const env=(name:string)=>Deno.env.get(name);
Deno.serve(scheduledPush({env,
 createStore:()=>{
  const url=env('SUPABASE_URL')!,key=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}').default||env('SUPABASE_SERVICE_ROLE_KEY');
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)||!key)throw Error('Server configuration unavailable');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  return {rpc:async(name:string,args:unknown)=>{if(!['zzws_claim_android','zzws_begin_android','zzws_finish_notification'].includes(name))throw Error('Unsupported operation');const r=await client.rpc(name,args);if(r.error)throw Error('Queue failure');return r.data;},
   orderSummary:(id:string,revision:number)=>readOrderSummary(client,id,revision)};
 },
 createSender:()=>{
  const account=JSON.parse(env('ZZWS_FIREBASE_SERVICE_ACCOUNT_JSON')||'null'),projectId=env('ZZWS_FIREBASE_PROJECT_ID');if(!account||account.project_id!==projectId)throw Error('Firebase configuration unavailable');
  return fcmTransport({projectId,accessToken:firebaseAccessToken({account,enabled:true}),enabled:true});
 }
}));

