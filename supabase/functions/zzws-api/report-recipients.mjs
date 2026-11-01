import {email} from './report-email.mjs';

// Invalid destinations are visible ledger entries, never mail headers/envelopes.
export function reportRecipientPlan({author,rows,selected,automatic,additional,replyTo,includeDefaults=true}){
 if(typeof includeDefaults!=='boolean'||!Array.isArray(automatic)||automatic.length!==3)throw Error('Ստուգեք լրացուցիչ հասցեների ընտրությունը');
 if(typeof additional!=='string'||additional.length>13000)throw Error('Էլ․ փոստի հասցեների սխալ ցանկ');
 const raw=[];const add=(value,role,source)=>{if(typeof value!=='string')value='';raw.push({value,role,source});};
 if(author!==undefined)add(author,'to','primary');
 else{
  if(!Array.isArray(rows)||!Array.isArray(selected)||!selected.length||selected.length>5||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=rows.length||typeof rows[i]!=='string'||!rows[i].trim()))throw Error('Ընտրեք հաճախորդի էլ․ փոստի առնվազն մեկ տող');
  for(const i of selected)for(const value of rows[i].split(/[,;]/).map(s=>s.trim()).filter(Boolean))add(value,'to','primary');
 }
 if(includeDefaults)for(const [index,slot]of automatic.entries()){
  if(typeof slot!=='string')throw Error('Ստուգեք պատճենների երեք դաշտերը');
  const values=slot.split(/[,;]/).map(v=>v.trim()).filter(Boolean);if(values.length>20)throw Error('Մեկ դաշտում թույլատրվում է մինչև 20 հասցե');
  for(const value of values)add(value,index===2?'bcc':'cc','default');
 }
 for(const value of additional.split(/[,;]/).map(s=>s.trim()).filter(Boolean))add(value,'cc','additional');
 if(!raw.length||raw.length>250)throw Error('Թույլատրվում է ընդհանուր մինչև 50 ստացող');
 const seen=new Map(),deliveries=[],to=[],cc=[],bcc=[];
 for(const item of raw){let address,state='pending';try{address=email(item.value);}catch{address=item.value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,'').trim().slice(0,254);state='invalid';}
  const key=state==='pending'?address:JSON.stringify([item.role,item.source,item.value]);
  if(seen.has(key)){const prior=seen.get(key);if(prior.role!=='to'&&item.role==='bcc'){prior.role='bcc';prior.source=item.source;}continue;}
  const entry={id:'r'+deliveries.length,address,role:item.role,source:item.source,state,attempts:0,...(state==='invalid'?{reason:'invalid_address'}:{})};seen.set(key,entry);deliveries.push(entry);
 }
 if(deliveries.length>50)throw Error('Թույլատրվում է ընդհանուր մինչև 50 ստացող');
 for(const entry of deliveries)if(entry.state==='pending')(entry.role==='to'?to:entry.role==='bcc'?bcc:cc).push(entry.address);
 return {to,cc,bcc,replyTo:email(replyTo||''),deliveries};
}

export function recipientDeliveryDTO(job){
 if(job?.counts?.deliverySchema!==1)return null;
 const recipients=job.counts.deliveries.map(r=>({id:r.id,address:r.address,role:r.role,source:r.source,state:r.state,attempts:r.attempts,...(r.reason?{reason:r.reason}:{}),...(r.acceptedAt?{acceptedAt:r.acceptedAt}:{})}));
 return {jobId:job.id,state:job.state,recipients,acceptedCount:recipients.filter(r=>r.state==='accepted').length,pendingCount:recipients.filter(r=>r.state==='pending').length,retryCount:recipients.filter(r=>r.state==='retry').length,uncertainCount:recipients.filter(r=>r.state==='uncertain').length,failedCount:recipients.filter(r=>['failed','invalid'].includes(r.state)).length};
}
