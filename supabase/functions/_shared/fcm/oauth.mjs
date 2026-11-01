import {createSign} from 'node:crypto';
import {Buffer} from 'node:buffer';
// Private service-account key remains on the server. OAuth tokens are RAM-only.
export function firebaseAccessToken({account,enabled=false,fetchImpl=globalThis.fetch,now=()=>Date.now()}){
 if(!account||account.type!=='service_account'||!/^[-a-z0-9.]+@[-a-z0-9.]+\.iam\.gserviceaccount\.com$/.test(account.client_email||'')||typeof account.private_key!=='string')throw Error('invalid_service_account');
 let cached=null,expires=0,inFlight;
 return async()=>{
  if(!enabled)throw Error('firebase_disabled');if(cached&&now()<expires)return cached;if(inFlight)return inFlight;
  inFlight=(async()=>{
   const timestamp=Math.floor(now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:timestamp,exp:timestamp+3600});
   const signature=createSign('RSA-SHA256').update(payload).sign(account.private_key).toString('base64url');
   const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature}).toString()});
   const data=await response.json();if(response.status!==200||data.token_type!=='Bearer'||typeof data.access_token!=='string'||/\s/.test(data.access_token)||!Number.isFinite(data.expires_in)||data.expires_in<120)throw Error('oauth_failed');
   cached=data.access_token;expires=now()+(Math.min(data.expires_in,3600)-60)*1000;return cached;
  })();try{return await inFlight;}finally{inFlight=null;}
 };
}

