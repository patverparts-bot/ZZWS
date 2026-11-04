import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,'dist-cloudflare');
const roots=['index.html','offer.html','styles.css','favicon.svg','favicon-32.png','apple-touch-icon.png','logo.svg','logo-dark.svg','logo.png','logo-dark.png','zigzag-avatar.svg','bg-warehouse.jpg','bg-warehouse-login.webp','apk-release.json'];
const extensions=new Set(['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2']);
const selected=[];
function walk(dir){
 for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  const file=dir+'/'+entry.name;
  if(entry.isSymbolicLink())throw Error('Refuse symbolic link '+file);
  if(entry.name.startsWith('.'))continue;
  if(entry.isDirectory())walk(file);
  else if(extensions.has(path.extname(file))||file.startsWith('js/')&&path.extname(file)==='.json'||file.endsWith('LICENSE'))selected.push(file);
 }
}
for(const file of roots){if(!fs.lstatSync(path.join(root,file)).isFile())throw Error('Missing public file '+file);selected.push(file);}
for(const dir of ['admin','js','help'])walk(dir);
if(selected.length+2>20_000)throw Error('Pages Free asset count exceeded');
for(const file of selected){const stat=fs.lstatSync(path.join(root,file));if(stat.isSymbolicLink()||stat.size>25*1024*1024)throw Error('Unsupported Pages asset '+file);}
// This is the sole disposable build directory. Never delete/copy the repo root,
// Android artifacts, backend, credentials, backups or local workspace outputs.
if(path.dirname(out)!==root||path.basename(out)!=='dist-cloudflare')throw Error('Unsafe build output path');
if(fs.existsSync(out)&&fs.lstatSync(out).isSymbolicLink())throw Error('Refuse linked build output');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
const manifest=[];
for(const file of selected.sort()){
 const data=fs.readFileSync(path.join(root,file)),destination=path.join(out,file);
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
 manifest.push({path:file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
fs.copyFileSync(path.join(root,'cloudflare/_headers'),path.join(out,'_headers'));
fs.writeFileSync(path.join(out,'404.html'),'<!doctype html><html lang="hy"><meta charset="utf-8"><title>ZZWS — 404</title><p>404 — Page not found.</p><a href="/">ZZWS</a></html>\n');
fs.writeFileSync(path.join(root,'cloudflare-build-manifest.json'),JSON.stringify({sourceCommit:process.env.CF_PAGES_COMMIT_SHA||null,apiMode:'unchanged-direct-supabase',files:manifest},null,2));
console.log(`Built ${selected.length} public assets. Upload ONLY dist-cloudflare; backend and APK unchanged.`);
