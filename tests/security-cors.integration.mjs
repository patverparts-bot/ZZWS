import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRuntime} from './support/runtime.mjs';

test('API and APK preserve existing origins and narrowly add the Pages origin without changing shared configuration',async()=>{
 const candidate=path.resolve(process.env.ZZWS_SECURITY_SOURCE_ROOT||'.');
 const runtime=await createRuntime({memory:true,debug:true,sourceRoot:path.join(candidate,'supabase/functions/zzws-api'),schemaRoot:process.env.ZZWS_SCHEMA_ROOT||candidate});
 const originalGet=Deno.env.get,newOrigin='https://zzws-1z2.pages.dev';
 const initialOrders=Number((await runtime.db.query('select count(*)::int n from zzws_orders')).rows[0].n);
 let checks=0;
 try{
  for(const config of [undefined,'https://configured.example,http://localhost:9090']){
   Deno.env.get=name=>name==='ZZWS_ALLOWED_ORIGINS'?config:originalGet(name);
   for(const service of ['zzws-api','zzws-apk']){
    await import(pathToFileURL(path.join(candidate,'supabase/functions',service,'index.ts')).href+'?cors='+crypto.randomUUID());
    const allowed=config?config.split(','):['https://patverparts-bot.github.io',...(service==='zzws-api'?['http://127.0.0.1:8080']:[])];
    for(const origin of [...allowed,newOrigin])for(const [method,expected] of [['OPTIONS',204],['GET',200]]){
     const response=await runtime.handle(new Request('https://offline.invalid/functions/v1/'+service+'/health',{method,headers:{Origin:origin}}));
     assert.equal(response.status,expected,service+' accepts '+origin+' '+method);
     assert.equal(response.headers.get('access-control-allow-origin'),origin,'Only the exact requesting trusted origin is echoed');
     assert.ok(response.headers.get('vary')?.split(',').some(value=>value.trim().toLowerCase()==='origin'));
     if(method==='GET')assert.equal((await response.json()).ok,true);
     checks++;
    }
    for(const origin of ['https://untrusted.example','https://zzws-1z2.pages.dev.attacker.example','http://zzws-1z2.pages.dev'])for(const method of ['OPTIONS','GET']){
     const response=await runtime.handle(new Request('https://offline.invalid/functions/v1/'+service+'/health',{method,headers:{Origin:origin}}));
     assert.equal(response.status,403,service+' rejects '+origin);
     assert.equal(response.headers.get('access-control-allow-origin'),null);checks++;
    }
    assert.equal(Deno.env.get('ZZWS_ALLOWED_ORIGINS'),config,'No shared configuration is created or rewritten');
   }
  }
  assert.equal(Number((await runtime.db.query('select count(*)::int n from zzws_orders')).rows[0].n),initialOrders);
  assert.equal(runtime.reportEmails.length,0);assert.equal(runtime.telegramMessages.length,0);assert.equal(runtime.pushMessages.length,0);
  console.log('CORS checks:',checks,'OPTIONS/health responses; no publication, orders, mail or notifications.');
 }finally{Deno.env.get=originalGet;await runtime.close();}
});
