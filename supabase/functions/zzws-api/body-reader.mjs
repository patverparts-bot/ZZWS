// Bound actual incoming bytes before the multipart parser can allocate files.
export const XLSX_UPLOAD_BODY_LIMIT=10_100_000;
const bad=(code,message)=>Object.assign(new Error(message),{code});
export async function boundedMultipart(req,{maxBytes=XLSX_UPLOAD_BODY_LIMIT,sizeMessage='Ֆայլը չափազանց մեծ է',missingMessage='Ընտրեք ֆայլը'}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new TypeError('Invalid multipart byte limit');
 const contentType=req.headers.get('content-type')||'';
 if(!/^multipart\/form-data(?:\s*;|$)/i.test(contentType))throw bad(400,'Ընտրեք ֆայլը multipart ձևաչափով');
 const reader=req.body?.getReader();if(!reader)throw bad(400,missingMessage);
 let size=0,complete=false;const chunks=[];
 try{
  const declared=req.headers.get('content-length');
  if(declared&&/^\d+$/.test(declared)&&Number(declared)>maxBytes)throw bad(413,sizeMessage);
  for(;;){
   const {done,value}=await reader.read();if(done){complete=true;break;}
   size+=value.byteLength;if(size>maxBytes)throw bad(413,sizeMessage);
   chunks.push(value);
  }
 }finally{
  // Some transports do not settle cancellation. Start it, but never delay the
  // size/read failure or let a cancellation rejection replace that failure.
  if(!complete)try{void reader.cancel().catch(()=>{});}catch{/* Keep the original error. */}
  reader.releaseLock();
 }
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return await new Response(bytes,{headers:{'content-type':contentType}}).formData();}
 catch{throw bad(400,'Ֆայլի ձևաչափը սխալ է');}
}
