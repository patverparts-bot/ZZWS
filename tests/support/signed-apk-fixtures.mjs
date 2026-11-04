import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectApk} from '../../supabase/functions/zzws-apk/apk.mjs';

// Existing immutable public release artifacts only. Never create a signed APK
// or read signing keys. Supply ZZWS_APK_FIXTURE_DIR explicitly for this suite.
export async function signedApkFixtures(){
 const directory=process.env.ZZWS_APK_FIXTURE_DIR;
 if(!directory){if(process.env.ZZWS_REQUIRE_SIGNED_APK_FIXTURES==='true')throw Error('Set ZZWS_APK_FIXTURE_DIR to existing published release APKs.');return null;}
 return Promise.all(['7.1.33','7.1.34','7.1.35'].map(async version=>{
  const bytes=await readFile(join(directory,'ZZWS-'+version+'-production.apk'));
  const metadata=inspectApk(bytes),sha256=createHash('sha256').update(bytes).digest('hex');
  return {bytes,release:{schemaVersion:1,...metadata,filename:'ZZWS-'+metadata.version+'-production.apk',bytes:bytes.length,sha256,description:'Read-only signed fixture',objectPath:'files/'+sha256+'.apk',publishedAt:'2026-11-02T00:00:00Z',publisher:'owner'}};
 }));
}
export function seedSignedRelease(fake,fixture,overrides={}){
 const r={...fixture.release,...overrides};fake.state.exists=true;
 fake.objects.set(r.objectPath,fixture.bytes);
 fake.objects.set('releases/'+String(r.versionCode).padStart(10,'0')+'.json',Buffer.from(JSON.stringify(r)));return r;
}
