import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedMultipart,XLSX_UPLOAD_BODY_LIMIT} from '../functions/zzws-api/body-reader.mjs';
const encoder=new TextEncoder(),type='multipart/form-data; boundary=reader-test';
const valid=encoder.encode('--reader-test\r\nContent-Disposition: form-data; name="note"\r\n\r\nvalue\r\n--reader-test--\r\n');
function streamRequest({bytes=30*1024*1024,contentLength,body=valid,chunkSize=1024*1024,repeat=false}={}){
 let sent=0,pulls=0,cancelled=false;
 const stream=new ReadableStream({pull(controller){pulls++;if(repeat){if(sent>=bytes){controller.close();return;}const size=Math.min(chunkSize,bytes-sent);sent+=size;controller.enqueue(new Uint8Array(size));}else{if(sent>=body.byteLength){controller.close();return;}const size=Math.min(chunkSize,body.byteLength-sent);controller.enqueue(body.subarray(sent,sent+size));sent+=size;}},cancel(){cancelled=true;}});
 const request=new Request('https://example.invalid/upload',{method:'POST',headers:{'content-type':type,...(contentLength===undefined?{}:{'content-length':String(contentLength)})},body:stream,duplex:'half'});
 return {request,state:()=>({sent,pulls,cancelled})};
}
test('oversized actual multipart stream is cancelled without Content-Length or with a falsely small header',async()=>{
 for(const contentLength of [undefined,1]){const fixture=streamRequest({repeat:true,contentLength});await assert.rejects(boundedMultipart(fixture.request),e=>e.code===413);assert.equal(fixture.state().cancelled,true);assert.ok(fixture.state().sent<30*1024*1024);assert.ok(fixture.state().sent<=XLSX_UPLOAD_BODY_LIMIT+2*1024*1024);}
});
test('declared oversized length cancels before consuming the supplied body',async()=>{
 const fixture=streamRequest({repeat:true,contentLength:XLSX_UPLOAD_BODY_LIMIT+1});await assert.rejects(boundedMultipart(fixture.request),e=>e.code===413);assert.equal(fixture.state().cancelled,true);assert.ok(fixture.state().sent<=1024*1024);
});
test('a transport whose cancel promise never settles cannot delay the size rejection',async()=>{
 let cancelled=false,timer;
 const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(20));},cancel(){cancelled=true;return new Promise(()=>{});}});
 const request=new Request('https://example.invalid/upload',{method:'POST',headers:{'content-type':type},body,duplex:'half'});
 try{await assert.rejects(Promise.race([boundedMultipart(request,{maxBytes:10}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('size rejection waited for cancellation')),500);})]),e=>e.code===413);assert.equal(cancelled,true);}finally{clearTimeout(timer);}
});
test('exact byte boundary accepts unchanged fields and one-byte-smaller boundary rejects',async()=>{
 const exact=streamRequest({chunkSize:7});assert.equal((await boundedMultipart(exact.request,{maxBytes:valid.byteLength})).get('note'),'value');assert.equal(exact.state().cancelled,false);
 const over=streamRequest({chunkSize:7});await assert.rejects(boundedMultipart(over.request,{maxBytes:valid.byteLength-1}),e=>e.code===413);assert.equal(over.state().cancelled,true);
});
test('malformed multipart and absent body fail with a controlled validation error',async()=>{
 const broken=streamRequest({body:encoder.encode('not a multipart body')});await assert.rejects(boundedMultipart(broken.request),e=>e.code===400);
 const empty=new Request('https://example.invalid/upload',{method:'POST',headers:{'content-type':type}});await assert.rejects(boundedMultipart(empty),e=>e.code===400);
 const json=new Request('https://example.invalid/upload',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await assert.rejects(boundedMultipart(json),e=>e.code===400);
});
