import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectApk} from '../supabase/functions/zzws-apk/apk.mjs';
import {verifyProductionApk,PRODUCTION_SIGNER_SHA256} from '../supabase/functions/zzws-apk/signature.mjs';
import {signedApkFixtures} from './support/signed-apk-fixtures.mjs';
import {unsignedApk,fake} from './support/apk-storage.mjs';
const fixtures=await signedApkFixtures(),signed={skip:!fixtures};
function locations(bytes){
 let end=bytes.length-22;while(bytes.readUInt32LE(end)!==0x06054b50)end--;
 const central=bytes.readUInt32LE(end+16),block=central-Number(bytes.readBigUInt64LE(central-24))-8;
 let pair=block+8;while(bytes.readUInt32LE(pair+8)!==0x7109871a)pair+=8+Number(bytes.readBigUInt64LE(pair));
 const field=at=>({body:at+4,end:at+4+bytes.readUInt32LE(at)});
 const signers=field(pair+12),signer=field(signers.body),data=field(signer.body),digests=field(data.body),digestRecord=field(digests.body),expected=field(digestRecord.body+4),certificates=field(digests.end),certificate=field(certificates.body),signatures=field(data.end),signatureRecord=field(signatures.body),signature=field(signatureRecord.body+4),key=field(signatures.end);
 return {end,central,block,data,digest:expected,certificate,signature,key};
}
test('missing or malformed v2 signature fails closed; no v1/header-only fallback',async()=>{
 for(const bytes of [new Uint8Array(),Buffer.from('APK Sig Block 42'),unsignedApk()])await assert.rejects(verifyProductionApk(bytes),e=>e.status===400);
});
test('existing signed production releases pass pin, signature and whole-file digest without changing bytes',signed,async()=>{
 for(const fixture of fixtures){const before=Buffer.from(fixture.bytes);assert.deepEqual(await verifyProductionApk(fixture.bytes),{scheme:2,algorithm:0x0103,signerSha256:PRODUCTION_SIGNER_SHA256});assert.deepEqual(fixture.bytes,before);}
});
test('existing valid APK signed by another certificate is rejected by the production pin',{skip:!process.env.ZZWS_APK_UNTRUSTED_FIXTURE},async()=>{
 const bytes=await readFile(process.env.ZZWS_APK_UNTRUSTED_FIXTURE);
 await assert.rejects(verifyProductionApk(bytes),e=>e.code==='apk_signer_untrusted');
});
test('stripping the signature block from a real APK leaves a valid ZIP but cannot publish',signed,async()=>{
 const fixture=fixtures[2],where=locations(fixture.bytes),unsigned=Buffer.concat([fixture.bytes.subarray(0,where.block),fixture.bytes.subarray(where.central)]);
 unsigned.writeUInt32LE(where.block,unsigned.length-(fixture.bytes.length-where.end)+16);
 assert.equal(inspectApk(unsigned).versionCode,70135);
 await assert.rejects(verifyProductionApk(unsigned),e=>e.code==='apk_signature_missing_v2');
 const f=fake();assert.equal((await f.publish(unsigned)).status,400);assert.equal(f.objects.size,0);assert.equal(f.state.exists,false);assert.equal(f.audits.length,0);
});
test('payload, Central Directory and EOCD changes invalidate the signed content digest',signed,async()=>{
 const fixture=fixtures[2],where=locations(fixture.bytes);
 for(const mutate of [b=>{b[1024]^=1;},b=>{b[where.central+46]^=1;},b=>{b.writeUInt16LE(b.readUInt16LE(where.end+8)+1,where.end+8);b.writeUInt16LE(b.readUInt16LE(where.end+10)+1,where.end+10);}]){
  const bytes=Buffer.from(fixture.bytes);mutate(bytes);await assert.rejects(verifyProductionApk(bytes),e=>e.code==='apk_content_digest_mismatch');
 }
});
test('certificate replacement fails the pinned DER digest and public key replacement cannot reuse the genuine signature',signed,async()=>{
 const bytes=fixtures[2].bytes,where=locations(bytes),certificate=Buffer.from(bytes),key=Buffer.from(bytes);
 certificate[where.certificate.body+100]^=1;await assert.rejects(verifyProductionApk(certificate),e=>e.code==='apk_signer_untrusted');
 key[where.key.end-1]^=1;await assert.rejects(verifyProductionApk(key),e=>e.code==='apk_signature_public_key_mismatch');
});
test('signature or signed digest modification is rejected cryptographically',signed,async()=>{
 const bytes=fixtures[2].bytes,where=locations(bytes);
 for(const offset of [where.signature.body+10,where.digest.body+10]){const changed=Buffer.from(bytes);changed[offset]^=1;await assert.rejects(verifyProductionApk(changed),e=>e.code==='apk_signature_invalid');}
});
test('block-length mismatch, truncated files and unaccounted trailing bytes are rejected',signed,async()=>{
 const bytes=fixtures[2].bytes,where=locations(bytes),length=Buffer.from(bytes);length[where.block]^=1;
 for(const changed of [length,bytes.subarray(0,bytes.length-1),Buffer.concat([bytes,Buffer.from([0])])])await assert.rejects(verifyProductionApk(changed),e=>e.status===400);
});
test('unsupported algorithm cannot silently fall back and mismatch algorithm lists cannot pass',signed,async()=>{
 const bytes=fixtures[2].bytes,where=locations(bytes);
 const changed=Buffer.from(bytes);changed.writeUInt32LE(0x0104,where.signature.body-8);await assert.rejects(verifyProductionApk(changed),e=>e.status===400);
});
test('tampered or differently certified APKs are rejected before any publication-side write',signed,async()=>{
 const fixture=fixtures[2],where=locations(fixture.bytes);
 for(const offset of [1024,where.certificate.body+100,where.signature.body+10]){
  const changed=Buffer.from(fixture.bytes);changed[offset]^=1;const f=fake(),result=await f.publish(changed);assert.equal(result.status,400);assert.equal(f.state.exists,false);assert.equal(f.objects.size,0);assert.equal(f.audits.length,0);assert.equal(f.state.removals.length,0);
 }
});
