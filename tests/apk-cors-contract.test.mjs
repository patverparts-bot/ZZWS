import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createApkHandler} from '../supabase/functions/zzws-apk/handler.mjs';
import {fake} from './support/apk-storage.mjs';

test('actual APK entry point preserves configured origins and adds only the exact new Pages origin',async()=>{
 const source=stripTypeScriptTypes(await readFile(new URL('../supabase/functions/zzws-apk/index.ts',import.meta.url),'utf8')).replace(/^import\s.*;\s*$/gm,'');
 const added='https://zzws-1z2.pages.dev';let checks=0;
 for(const configured of [undefined,'https://configured.example,http://localhost:9090','https://configured.example,https://zzws-1z2.pages.dev,https://configured.example']){
  const fixture=fake();let handle,options;
  const environment={SUPABASE_URL:'https://offline.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',ZZWS_ALLOWED_ORIGINS:configured};
  const before=JSON.stringify(environment);
  const scope={Deno:{env:{get:name=>environment[name]},serve:value=>{handle=value;}},createClient:(url,key,settings)=>{assert.equal(url,'https://offline.invalid');assert.equal(key,'test-service-role');assert.equal(settings.auth.persistSession,false);assert.equal(settings.auth.autoRefreshToken,false);return fixture.service;},createApkHandler:value=>{options=value;return createApkHandler(value);}};
  vm.runInNewContext(source,scope,{filename:'zzws-apk/index.ts'});
  const existing=configured?configured.split(','):['https://patverparts-bot.github.io'];
  assert.deepEqual(Array.from(options.origins),[...new Set([...existing,added])]);
  for(const origin of [...new Set([...existing,added])])for(const method of ['OPTIONS','GET']){
   const response=await handle(new Request('https://offline.invalid/functions/v1/zzws-apk/health',{method,headers:{Origin:origin}}));
   assert.equal(response.status,method==='OPTIONS'?204:200);
   assert.equal(response.headers.get('access-control-allow-origin'),origin);
   assert.match(response.headers.get('vary'),/origin/i);checks++;
  }
  for(const origin of ['https://foreign.example','https://zzws-1z2.pages.dev.foreign.example','http://zzws-1z2.pages.dev'])for(const method of ['OPTIONS','GET']){
   const response=await handle(new Request('https://offline.invalid/functions/v1/zzws-apk/health',{method,headers:{Origin:origin}}));
   assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null);checks++;
  }
  assert.equal((await handle(new Request('https://offline.invalid/functions/v1/zzws-apk/current'))).status,401,'Native requests still require the existing opaque session');
  assert.equal(JSON.stringify(environment),before,'No environment configuration is rewritten');
  assert.equal(fixture.objects.size,0);assert.equal(fixture.audits.length,0);assert.equal(fixture.state.removals.length,0);
 }
 assert.equal(checks,32);
});
