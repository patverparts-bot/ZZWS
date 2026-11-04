import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectApk} from '../supabase/functions/zzws-apk/apk.mjs';
import {fake,unsignedApk,digest,envelope} from './support/apk-storage.mjs';
import {signedApkFixtures,seedSignedRelease} from './support/signed-apk-fixtures.mjs';
const fixtures=await signedApkFixtures(),signed={skip:!fixtures};
const codes=f=>[...f.objects.keys()].filter(p=>p.startsWith('releases/')).sort().map(p=>Number(p.slice(9,-5)));
const publish=(f,fixture)=>f.publish(fixture.bytes);

test('compiled manifest inspection is structural only and rejects malformed ZIP data',()=>{
 assert.deepEqual(inspectApk(unsignedApk()),{package:'am.zzws.admin',version:'1.0.0',versionCode:10000});
 for(const bytes of [Buffer.from('not an apk'),unsignedApk().subarray(0,100)])assert.throws(()=>inspectApk(bytes),e=>e.status===400);
});
test('owner scope, origin, setup and fresh password confirmation guard publication before writes',async()=>{
 const f=fake();assert.equal((await f.request('current',{auth:null})).status,401);assert.equal((await f.request('current',{requestOrigin:'https://evil.invalid'})).status,403);
 f.state.scope='manager';assert.equal((await f.publish()).status,403);f.state.scope='owner';f.state.confirmed=false;const r=await f.publish();assert.equal(r.status,428);assert.equal((await r.json()).reauthRequired,true);
 f.state.confirmed=true;f.state.setup=true;assert.equal((await f.publish()).status,403);f.state.setup=false;f.state.expired=true;assert.equal((await f.publish()).status,401);assert.equal(f.objects.size,0);assert.equal(f.audits.length,0);
});
test('unsigned ZIP never creates a bucket, binary, release manifest or audit entry',async()=>{
 const f=fake();assert.equal((await f.publish()).status,400);assert.equal(f.state.exists,false);assert.equal(f.objects.size,0);assert.equal(f.audits.length,0);assert.equal(f.state.removals.length,0);
});
test('upload check authenticates first and malformed or oversized bodies cannot publish',async()=>{
 const f=fake();assert.equal((await f.request('upload-check',{method:'POST'})).status,200);f.state.confirmed=false;assert.equal((await f.request('upload-check',{method:'POST'})).status,428);f.state.confirmed=true;f.state.scope='manager';assert.equal((await f.request('upload-check',{method:'POST'})).status,403);f.state.scope='owner';
 for(const body of [Buffer.alloc(2),Buffer.from([255,255,255,255]),envelope(unsignedApk(),'x'.repeat(4001)),envelope(unsignedApk(),'ok','bad.txt')])assert.equal((await f.request('publish',{method:'POST',body})).status,400);
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(50_100_001));},cancel(){cancelled=true;}});assert.equal((await f.request('publish',{method:'POST',body})).status,413);assert.ok(cancelled);assert.equal(f.objects.size,0);
});
test('stalled upload terminates with 408 without a release',async()=>{
 const f=fake({uploadReadTimeoutMs:25});let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array([0,0,0,20]));},cancel(){cancelled=true;}});
 assert.equal((await f.request('publish',{method:'POST',body})).status,408);assert.ok(cancelled);assert.equal(f.objects.size,0);
});
test('real signed APK publishes immutable exact bytes and supports scoped GET/HEAD downloads',signed,async()=>{
 const f=fake(),fixture=fixtures[0],response=await publish(f,fixture);assert.equal(response.status,200);const r=(await response.json()).release;
 assert.equal(r.versionCode,fixture.release.versionCode);assert.equal(r.sha256,fixture.release.sha256);assert.equal(r.bytes,fixture.bytes.length);assert.equal(f.state.options.public,false);assert.equal(f.audits[0].action,'apk_publish');
 assert.deepEqual((await(await f.request('current')).json()).release,r);const file=await f.request('download?versionCode='+r.versionCode);assert.equal(file.status,200);assert.equal(digest(Buffer.from(await file.arrayBuffer())),r.sha256);
 assert.equal((await f.request('download?versionCode='+r.versionCode,{method:'HEAD'})).headers.get('Content-Length'),String(r.bytes));
 f.state.mobile=false;assert.equal((await f.request('download?versionCode='+r.versionCode)).status,403);f.state.scope='viewer';assert.equal((await f.request('current')).status,403);
});
test('older signed releases, partial writes and session revocation preserve current release',signed,async()=>{
 const f=fake();await publish(f,fixtures[1]);assert.equal((await publish(f,fixtures[0])).status,409);
 f.state.failFile=true;assert.equal((await publish(f,fixtures[2])).status,503);f.state.failFile=false;
 f.state.failManifest=true;assert.equal((await publish(f,fixtures[2])).status,503);f.state.failManifest=false;
 f.state.revokeAfterFile=true;f.objects.delete(fixtures[2].release.objectPath);assert.equal((await publish(f,fixtures[2])).status,401);f.state.revoked=false;
 assert.equal((await(await f.request('current')).json()).release.versionCode,70134);
});
test('concurrent signed publications cannot replace a version or downgrade latest',signed,async()=>{
 const f=fake();const responses=await Promise.all([publish(f,fixtures[1]),publish(f,fixtures[2])]);assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal((await(await f.request('current')).json()).release.versionCode,70135);assert.equal((await publish(f,fixtures[1])).status,409);
});
test('download links require current permission and expire after two minutes',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[2]);let link;const original=f.service.storage.from;
 f.service.storage.from=()=>({...original(),async createSignedUrl(path,expires,options){link={path,expires,options};return {data:{signedUrl:'https://example.invalid/storage/v1/object/sign/temporary?token=synthetic'},error:null};}});
 const response=await f.request('download-link?versionCode=70135');assert.equal(response.status,200);assert.equal((await response.json()).expiresIn,120);assert.equal(link.expires,120);assert.equal(link.path,fixtures[2].release.objectPath);
 f.state.mobile=false;assert.equal((await f.request('download-link?versionCode=70135')).status,403);assert.equal((await f.request('download-link?versionCode=70135',{auth:null})).status,401);f.state.mobile=true;assert.equal((await f.request('download-link?versionCode=../private')).status,400);
});
test('retention verifies both real keepers and removes only older published objects',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[0]);seedSignedRelease(f,fixtures[1]);const orphan='files/'+'f'.repeat(64)+'.apk';f.objects.set(orphan,Buffer.from('in-flight'));
 const result=await publish(f,fixtures[2]);assert.equal(result.status,200);assert.deepEqual((await result.json()).retention,{keptVersions:2,cleanupPending:false});assert.deepEqual(codes(f),[70134,70135]);assert.ok(f.objects.has(orphan));assert.equal(f.objects.has(fixtures[0].release.objectPath),false);
 for(const r of fixtures.slice(1))assert.equal(digest(f.objects.get(r.release.objectPath)),r.release.sha256);
});
test('corrupt or missing previous keeper stops all deletes; verified repair permits idempotent retry',signed,async()=>{
 for(const missing of [false,true]){const f=fake();seedSignedRelease(f,fixtures[0]);seedSignedRelease(f,fixtures[1]);const previous=fixtures[1].release;
  if(missing)f.objects.delete(previous.objectPath);else{const corrupt=Buffer.from(fixtures[1].bytes);corrupt[1024]^=1;f.objects.set(previous.objectPath,corrupt);}
  const response=await publish(f,fixtures[2]);assert.equal(response.status,200);assert.equal((await response.json()).retention.cleanupPending,true);assert.equal(f.state.removals.length,0);assert.deepEqual(codes(f),[70133,70134,70135]);assert.ok(f.objects.has(fixtures[0].release.objectPath));
  f.objects.set(previous.objectPath,fixtures[1].bytes);const retry=await publish(f,fixtures[2]);assert.equal(retry.status,200);assert.equal((await retry.json()).retention.cleanupPending,false);assert.deepEqual(codes(f),[70134,70135]);
 }
});
test('a concurrently published new keeper pair is verified before any delete',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[0]);let inserted=false,downloads=0;const original=f.service.storage.from;
 f.service.storage.from=()=>{const storage=original();return {...storage,async download(path){const result=await storage.download(path);if(path===fixtures[1].release.objectPath)downloads++;if(!inserted&&path===fixtures[1].release.objectPath&&downloads===2){inserted=true;seedSignedRelease(f,fixtures[2]);f.objects.set(fixtures[2].release.objectPath,Buffer.from('corrupt newer keeper'));}return result;}};};
 const response=await publish(f,fixtures[1]);assert.equal(response.status,200);assert.equal((await response.json()).retention.cleanupPending,true);assert.ok(inserted);assert.equal(f.state.removals.length,0);assert.ok(f.objects.has(fixtures[0].release.objectPath));
});
test('failed metadata delete is discoverable and retry keeps both verified versions',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[0]);seedSignedRelease(f,fixtures[1]);f.state.failRemoveManifest=true;
 let response=await publish(f,fixtures[2]);assert.equal((await response.json()).retention.cleanupPending,true);assert.deepEqual(codes(f),[70133,70134,70135]);f.state.failRemoveManifest=false;
 response=await publish(f,fixtures[2]);assert.equal((await response.json()).retention.cleanupPending,false);assert.deepEqual(codes(f),[70134,70135]);
});
test('corrupt metadata cannot expand cleanup paths or remove keepers',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[0],{objectPath:'../unrelated'});seedSignedRelease(f,fixtures[1]);const response=await publish(f,fixtures[2]);assert.equal((await response.json()).retention.cleanupPending,true);assert.equal(f.state.removals.length,0);
});
test('retention drains multiple listing batches without skipping old manifests or current keepers',signed,async()=>{
 const f=fake();
 // Historical Storage metadata fixtures share an existing signed binary; no new
 // artifact is signed or published under these synthetic old version numbers.
 for(let code=70000;code<70051;code++)seedSignedRelease(f,fixtures[0],{versionCode:code,version:'7.0.'+(code-70000),filename:'ZZWS-7.0.'+(code-70000)+'-production.apk'});
 seedSignedRelease(f,fixtures[1]);const response=await publish(f,fixtures[2]);assert.equal((await response.json()).retention.cleanupPending,false);assert.deepEqual(codes(f),[70134,70135]);assert.equal(f.objects.size,4);
 for(const fixture of fixtures.slice(1))assert.equal(digest(f.objects.get(fixture.release.objectPath)),fixture.release.sha256);
});
test('primary clients can read releases but cannot publish; setup sessions are denied',signed,async()=>{
 const f=fake();seedSignedRelease(f,fixtures[1]);f.state.role='client';assert.equal((await f.request('current')).status,200);assert.equal((await f.request('download?versionCode=70134')).status,200);assert.equal((await publish(f,fixtures[2])).status,403);f.state.setup=true;assert.equal((await f.request('current')).status,403);
});
