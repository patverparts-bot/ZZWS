// Bound retained bytes before the multipart parser can allocate files.
export const XLSX_UPLOAD_BODY_LIMIT=10_100_000;
export const UPLOAD_READ_TIMEOUT_MS=45_000;
const bad=(code,message)=>Object.assign(new Error(message),{code});
export async function boundedMultipart(req,{maxBytes=XLSX_UPLOAD_BODY_LIMIT,maxReadMs=UPLOAD_READ_TIMEOUT_MS,sizeMessage='Ֆայլը չափազանց մեծ է',missingMessage='Ընտրեք ֆայլը'}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('Invalid multipart byte limit');
 if(!Number.isSafeInteger(maxReadMs)||maxReadMs<1)throw new TypeError('Invalid multipart read timeout');
 const contentType=req.headers.get('content-type')||'';
 if(!/^multipart\/form-data(?:\s*;|$)/i.test(contentType))throw bad(400,'Ընտրեք ֆայլը multipart ձևաչափով');
 const reader=req.body?.getReader();if(!reader)throw bad(400,missingMessage);
 const declared=req.headers.get('content-length');
 let oversized=!!(declared&&/^\d+$/.test(declared)&&Number(declared)>maxBytes);
 let size=0,complete=false,timer;const chunks=[],deadlineAt=performance.now()+maxReadMs;
 try{
  for(;;){
   const remaining=deadlineAt-performance.now();
   if(remaining<=0)throw bad(408,'Ֆայլի բեռնման ժամանակը սպառվել է');
   let next;
   try{next=await Promise.race([reader.read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(bad(408,'Ֆայլի բեռնման ժամանակը սպառվել է')),remaining);})]);}
   finally{clearTimeout(timer);}
   const {done,value}=next;
   if(done){complete=true;break;}
   size+=value.byteLength;
   if(!oversized&&size>maxBytes){oversized=true;chunks.length=0;}
   // The managed relay can withhold an early response to an unread body.
   // Discard oversized finite input without retaining or parsing it, then 413.
   // The absolute deadline also bounds slow/endless rejected uploads; delivery
   // after cancelling such an unfinished body still depends on the relay.
   if(!oversized)chunks.push(value);
  }
 }catch(error){
  if(oversized)throw bad(413,sizeMessage);
  throw error;
 }finally{
  clearTimeout(timer);
  if(!complete)try{void reader.cancel().catch(()=>{});}catch{/* Preserve the read/size error. */}
  reader.releaseLock();
 }
 if(oversized)throw bad(413,sizeMessage);
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return await new Response(bytes,{headers:{'content-type':contentType}}).formData();}
 catch{throw bad(400,'Ֆայլի ձևաչափը սխալ է');}
}
