// APK v2 verification, using the reviewed production signing profile only.
// AOSP format/content-digest specification:
// https://source.android.com/docs/security/features/apksigning/v2
// No v1 fallback, certificate-name trust, private keys or third-party parser.
export const PRODUCTION_SIGNER_SHA256='85e2356e5269ac94f016858551b5c06ede293c31b649b8e1acedc05a407a0115';
const V2_ID=0x7109871a,ALGORITHM=0x0103,CHUNK=1024*1024,MAX_BYTES=50_000_000;
const fail=code=>{throw Object.assign(new Error('APK-ի ստորագրությունը չի անցել ստուգումը։ Ընտրեք ZZWS production APK ֆայլը։'),{status:400,code});};
const equal=(a,b)=>{if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
function reader(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let position=0;
 const take=count=>{if(!Number.isSafeInteger(count)||count<0||count>bytes.length-position)fail('apk_signature_bounds');const value=bytes.subarray(position,position+count);position+=count;return value;};
 const u32=()=>{const at=position;take(4);return view.getUint32(at,true);};
 return {take,u32,field:()=>take(u32()),done:()=>position===bytes.length};
}
function onlyField(bytes){const r=reader(bytes),value=r.field();if(!r.done())fail('apk_signature_trailing_data');return value;}
function singleRecord(bytes){const r=reader(onlyField(bytes)),algorithm=r.u32(),value=r.field();if(!r.done()||algorithm!==ALGORITHM)fail('apk_signature_unsupported_algorithm');return {algorithm,value};}
// DER is parsed only to locate SubjectPublicKeyInfo in an already pinned certificate.
function certificateKey(certificate){
 const item=(at,limit)=>{
  const start=at;if(at+2>limit)fail('apk_certificate_der');const tag=certificate[at++];let length=certificate[at++];
  if(length&128){const count=length&127;if(count===0||count>4||at+count>limit||certificate[at]===0)fail('apk_certificate_der');length=0;for(let i=0;i<count;i++)length=length*256+certificate[at++];if(length<128)fail('apk_certificate_der');}
  if(!Number.isSafeInteger(length)||length>limit-at)fail('apk_certificate_der');return {tag,start,body:at,end:at+length};
 };
 const outer=item(0,certificate.length);if(outer.tag!==0x30||outer.end!==certificate.length)fail('apk_certificate_der');
 const tbs=item(outer.body,outer.end);if(tbs.tag!==0x30)fail('apk_certificate_der');let at=tbs.body;
 if(item(at,tbs.end).tag===0xa0)at=item(at,tbs.end).end;
 // serialNumber, signature, issuer, validity, subject, then SPKI.
 for(const tag of [0x02,0x30,0x30,0x30,0x30]){const field=item(at,tbs.end);if(field.tag!==tag)fail('apk_certificate_der');at=field.end;}
 const spki=item(at,tbs.end);if(spki.tag!==0x30)fail('apk_certificate_der');return certificate.subarray(spki.start,spki.end);
}
function sections(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=bytes.length;let eocd=-1;
 for(let at=length-22;at>=Math.max(0,length-65557);at--)if(view.getUint32(at,true)===0x06054b50&&at+22+view.getUint16(at+20,true)===length){eocd=at;break;}
 if(eocd<0||view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true)||view.getUint16(eocd+8,true)!==view.getUint16(eocd+10,true))fail('apk_signature_zip');
 const central=view.getUint32(eocd+16,true),centralSize=view.getUint32(eocd+12,true);
 if(central<32||central+centralSize!==eocd||centralSize===0||central>=eocd||view.getUint32(central,true)!==0x02014b50)fail('apk_signature_zip');
 if(!equal(bytes.subarray(central-16,central),new TextEncoder().encode('APK Sig Block 42')))fail('apk_signature_missing_v2');
 const size=view.getBigUint64(central-24,true);if(size<24n||size>BigInt(central-8))fail('apk_signature_block');
 const start=central-Number(size)-8;if(view.getBigUint64(start,true)!==size)fail('apk_signature_block');
 let at=start+8,v2=null;const ids=new Set();
 while(at<central-24){if(at+8>central-24)fail('apk_signature_block');const count=view.getBigUint64(at,true);at+=8;if(count<4n||count>BigInt(central-24-at))fail('apk_signature_block');const id=view.getUint32(at,true);if(ids.has(id))fail('apk_signature_duplicate_block');ids.add(id);if(id===V2_ID)v2=bytes.subarray(at+4,at+Number(count));at+=Number(count);}
 if(at!==central-24||!v2)fail('apk_signature_missing_v2');
 // The reviewed production profile is v2-only; fail closed if another signing
 // scheme is advertised, rather than silently omitting its verification.
 if(ids.has(0xf05368c0)||ids.has(0x1b93ad61))fail('apk_signature_unsupported_scheme');
 return {start,central,eocd,v2};
}
async function contentDigest(bytes,{start,central,eocd}){
 const tail=new Uint8Array(bytes.subarray(eocd));new DataView(tail.buffer).setUint32(16,start,true);
 const pieces=[bytes.subarray(0,start),bytes.subarray(central,eocd),tail],count=pieces.reduce((n,p)=>n+Math.ceil(p.length/CHUNK),0);
 const top=new Uint8Array(5+count*32),topView=new DataView(top.buffer);top[0]=0x5a;topView.setUint32(1,count,true);let offset=5;
 for(const piece of pieces)for(let at=0;at<piece.length;at+=CHUNK){const part=piece.subarray(at,Math.min(at+CHUNK,piece.length)),input=new Uint8Array(5+part.length);input[0]=0xa5;new DataView(input.buffer).setUint32(1,part.length,true);input.set(part,5);top.set(await digest(input),offset);offset+=32;}
 return digest(top);
}
export async function verifyProductionApk(input){
 try{
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length<32||bytes.length>MAX_BYTES)fail('apk_signature_bounds');
  const layout=sections(bytes),signer=reader(onlyField(onlyField(layout.v2))),signedData=signer.field(),signatures=signer.field(),publicKey=signer.field();if(!signer.done())fail('apk_signature_trailing_data');
  const signature=singleRecord(signatures),signed=reader(signedData),digests=signed.field(),certificates=signed.field(),attributes=signed.field();
  // Current AOSP apksig appends an empty length-prefixed field after attributes
  // (V2SchemeSigner.generateSignerBlock). It remains covered by the signature.
  if(!signed.done()&&(signed.field().length!==0||!signed.done()))fail('apk_signature_trailing_data');
  const expected=singleRecord(digests);if(signature.algorithm!==expected.algorithm||expected.value.length!==32)fail('apk_signature_algorithm_mismatch');
  const certificate=onlyField(certificates);if(hex(await digest(certificate))!==PRODUCTION_SIGNER_SHA256)fail('apk_signer_untrusted');
  if(!equal(certificateKey(certificate),publicKey))fail('apk_signature_public_key_mismatch');
  // The pinned production profile has no signed additional attributes. In
  // particular, do not ignore a signed stronger-scheme stripping-protection hint.
  if(attributes.length!==0)fail('apk_signature_unsupported_attributes');
  const key=await crypto.subtle.importKey('spki',publicKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(key.algorithm.modulusLength<2048||!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,signature.value,signedData))fail('apk_signature_invalid');
  if(!equal(await contentDigest(bytes,layout),expected.value))fail('apk_content_digest_mismatch');
  return {scheme:2,algorithm:ALGORITHM,signerSha256:PRODUCTION_SIGNER_SHA256};
 }catch(error){if(error?.status===400)throw error;fail('apk_signature_invalid');}
}
