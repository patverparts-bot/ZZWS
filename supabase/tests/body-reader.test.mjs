import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {boundedMultipart} from '../functions/zzws-api/body-reader.mjs';

const encoder=new TextEncoder(),type='multipart/form-data; boundary=finite-test';
const multipart=value=>encoder.encode('--finite-test\r\nContent-Disposition: form-data; name="note"\r\n\r\n'+value+'\r\n--finite-test--\r\n');
function finite(body,{chunkSize=17,length,afterOverflowError=false}={}){
 let sent=0,cancelled=false,eof=false,pulls=0;
 const stream=new ReadableStream({pull(controller){pulls++;if(sent===body.length){eof=true;if(afterOverflowError)controller.error(Error('synthetic transport closed'));else controller.close();return;}const end=Math.min(sent+chunkSize,body.length);controller.enqueue(body.subarray(sent,end));sent=end;},cancel(){cancelled=true;}});
 return {request:new Request('https://offline.invalid/upload',{method:'POST',headers:{'content-type':type,...(length===undefined?{}:{'content-length':String(length)})},body:stream,duplex:'half'}),state:()=>({sent,cancelled,eof,pulls})};
}

test('exact retained-byte boundary accepts fields; overflow drains finite input and returns 413 for missing or false length',async()=>{
 const bytes=multipart('synthetic value');
 for(const length of [undefined,1,bytes.length]){
  const exact=finite(bytes,{length});assert.equal((await boundedMultipart(exact.request,{maxBytes:bytes.length})).get('note'),'synthetic value');assert.equal(exact.state().eof,true);assert.equal(exact.state().cancelled,false);
  const over=finite(bytes,{length});await assert.rejects(boundedMultipart(over.request,{maxBytes:bytes.length-1}),error=>error.code===413);assert.deepEqual({sent:over.state().sent,eof:over.state().eof,cancelled:over.state().cancelled},{sent:bytes.length,eof:true,cancelled:false});
 }
});

test('declared oversize still rejects a smaller actual finite body after draining instead of parsing it',async()=>{
 const bytes=multipart('short'),fixture=finite(bytes,{length:10000});
 await assert.rejects(boundedMultipart(fixture.request,{maxBytes:bytes.length}),error=>error.code===413);
 assert.equal(fixture.state().eof,true);assert.equal(fixture.state().sent,bytes.length);assert.equal(fixture.state().cancelled,false);
});

test('oversized finite input never invokes the multipart parser or creates its contiguous buffer',async()=>{
 const bytes=multipart('x'.repeat(128*1024)),fixture=finite(bytes,{chunkSize:4096});
 const NativeResponse=globalThis.Response;let constructions=0;
 globalThis.Response=class extends NativeResponse {constructor(...args){constructions++;super(...args);throw Error('oversized input reached multipart parser');}};
 try{await assert.rejects(boundedMultipart(fixture.request,{maxBytes:1024}),error=>error.code===413);assert.equal(constructions,0);assert.equal(fixture.state().sent,bytes.length);assert.equal(fixture.state().eof,true);}finally{globalThis.Response=NativeResponse;}
});

test('malformed finite multipart below cap reports 400 after EOF; absent body and wrong type stay controlled',async()=>{
 const fixture=finite(encoder.encode('not a multipart document'));
 await assert.rejects(boundedMultipart(fixture.request,{maxBytes:1024}),error=>error.code===400);assert.equal(fixture.state().eof,true);assert.equal(fixture.state().cancelled,false);
 await assert.rejects(boundedMultipart(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':type}})),error=>error.code===400);
 await assert.rejects(boundedMultipart(new Request('https://offline.invalid',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})),error=>error.code===400);
});

test('transport errors during discard preserve the established 413 instead of parsing partial data',async()=>{
 const fixture=finite(new Uint8Array(100),{chunkSize:20,afterOverflowError:true});
 await assert.rejects(boundedMultipart(fixture.request,{maxBytes:10}),error=>error.code===413);
});

test('one finite read deadline returns 408 before overflow or retains 413 after overflow, even if cancel never settles',async()=>{
 for(const [bytes,expected]of [[1,408],[20,413]]){
  let cancelled=false;const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(bytes));},cancel(){cancelled=true;return new Promise(()=>{});}});
  const request=new Request('https://offline.invalid/upload',{method:'POST',headers:{'content-type':type},body,duplex:'half'}),started=performance.now();
  await assert.rejects(boundedMultipart(request,{maxBytes:10,maxReadMs:35}),error=>error.code===expected);
  assert.ok(performance.now()-started<1000,'Application rejection must not await transport cancellation');assert.equal(cancelled,true);assert.equal(request.body.locked,false);
 }
});

test('the deadline is shared across reads rather than restarted for every incoming chunk',async()=>{
 let sent=0;const body=new ReadableStream({async pull(controller){await new Promise(resolve=>setTimeout(resolve,25));if(sent++<8)controller.enqueue(new Uint8Array(1));else controller.close();}});
 const request=new Request('https://offline.invalid/upload',{method:'POST',headers:{'content-type':type},body,duplex:'half'}),started=performance.now();
 await assert.rejects(boundedMultipart(request,{maxBytes:1024,maxReadMs:60}),error=>error.code===408);
 assert.ok(performance.now()-started<180,'Slow chunks cannot extend the absolute read deadline');
});

test('wall-clock jumps do not change the monotonic upload deadline',async()=>{
 const fixture=finite(multipart('value'));const originalNow=Date.now;let calls=0;
 Date.now=()=>++calls%2===1?0:1_000_000_000_000;
 try{assert.equal((await boundedMultipart(fixture.request,{maxBytes:1024,maxReadMs:500})).get('note'),'value');}finally{Date.now=originalNow;}
});

test('finite discard releases buffered chunks and retains a constant amount across an 8 MiB rejected stream',{skip:typeof globalThis.gc!=='function'?'Run node --expose-gc --test for the retained-memory regression':false},async()=>{
 globalThis.gc();const before=process.memoryUsage().arrayBuffers;let peak=before,produced=0,eof=false,first;
 const body=new ReadableStream({async pull(controller){
  if(produced%8===0){await nextTurn();globalThis.gc();peak=Math.max(peak,process.memoryUsage().arrayBuffers);}
  if(produced===128){eof=true;controller.close();return;}
  const chunk=new Uint8Array(64*1024);if(produced===0)first=new WeakRef(chunk);produced++;controller.enqueue(chunk);
 }});
 const request=new Request('https://offline.invalid/upload',{method:'POST',headers:{'content-type':type},body,duplex:'half'});
 await assert.rejects(boundedMultipart(request,{maxBytes:128*1024,maxReadMs:15000}),error=>error.code===413);
 assert.equal(eof,true);assert.equal(produced,128);assert.equal(first.deref(),undefined,'Buffered input from before overflow must be released while discard continues');
 assert.ok(peak-before<4*1024*1024,'Retained ArrayBuffer memory must not grow with the rejected 8 MiB body; observed '+(peak-before));
});
