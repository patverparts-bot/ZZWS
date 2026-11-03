import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist-cloudflare');
// Fixed output and positive allowlist: never publish the repository root.
const roots=['index.html','offer.html','styles.css','favicon.svg','favicon-32.png','apple-touch-icon.png','logo.svg','logo-dark.svg','logo.png','logo-dark.png','zigzag-avatar.svg','bg-warehouse.jpg','bg-warehouse-login.webp','apk-release.json'];
const extensions=new Set(['.html','.js','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2']);
const json=new Set(['js/product-photo-sources.json','js/storefront-category-photo-sources.json']);
const selected=[];
function walk(dir){ for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){ const p=dir+'/'+e.name; if(e.isSymbolicLink())throw Error('Refuse symbolic link '+p); if(e.name.startsWith('.'))continue; if(e.isDirectory())walk(p); else if(extensions.has(path.extname(p))||json.has(p)||p.endsWith('-LICENSE'))selected.push(p); } }
for(const p of roots){if(!fs.statSync(path.join(root,p)).isFile())throw Error('Missing '+p);selected.push(p);}
for(const d of ['admin','js','help'])walk(d);
for(const p of selected){const st=fs.lstatSync(path.join(root,p)); if(st.isSymbolicLink())throw Error('Refuse symlink '+p); if(st.size>25*1024*1024)throw Error('Oversize Pages file '+p);}
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
const manifest=[];
for(const p of selected.sort()){const data=fs.readFileSync(path.join(root,p));fs.mkdirSync(path.dirname(path.join(out,p)),{recursive:true});fs.writeFileSync(path.join(out,p),data);manifest.push({path:p,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}
fs.copyFileSync(path.join(root,'cloudflare/_headers'),path.join(out,'_headers'));
fs.writeFileSync(path.join(out,'404.html'),'<!doctype html><html lang="hy"><meta charset="utf-8"><title>ZZWS — 404</title><p>404 — Page not found.</p><a href="/">ZZWS</a></html>');
let sourceCommit=process.env.CF_PAGES_COMMIT_SHA || null;
if(!sourceCommit){try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{ /* A source archive may have no Git metadata. */ }}
fs.writeFileSync(path.join(root,'cloudflare-build-manifest.json'),JSON.stringify({sourceCommit,apiMode:'unchanged-direct-supabase',files:manifest},null,2));
console.log(`Built ${selected.length} frontend files. Upload ONLY dist-cloudflare. API unchanged.`);
