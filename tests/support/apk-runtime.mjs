import {createHash} from 'node:crypto';
import {createClient} from './supabase-client.mjs';
import {createApkHandler} from '../../supabase/functions/zzws-apk/handler.mjs';
export function createTrackedApkRuntime(runtime,{origin='http://127.0.0.1:8080'}={}){
 const bytes=Buffer.alloc(64);bytes.set([80,75,3,4]);const sha256=createHash('sha256').update(bytes).digest('hex');
 const objects=new Map(),addRelease=(versionCode,version)=>{const release={schemaVersion:1,package:'am.zzws.admin',versionCode,version,filename:'ZZWS-'+version+'-production.apk',bytes:bytes.length,sha256,description:'Synthetic isolated APK',objectPath:'files/'+sha256+'.apk'};objects.set('releases/'+String(versionCode).padStart(10,'0')+'.json',Buffer.from(JSON.stringify(release)));objects.set(release.objectPath,bytes);return release;};
 const release=addRelease(70112,'7.1.12'),service=createClient('http://127.0.0.1:8080/offline-supabase','offline-test');
 service.storage={async getBucket(){return {data:{public:false},error:null};},from(){return {async list(prefix,{limit=100,sortBy}={}){let names=[...objects.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>p.slice(prefix.length+1)).sort();if(sortBy?.order==='desc')names.reverse();return {data:names.slice(0,limit).map(name=>({name})),error:null};},async download(path){return objects.has(path)?{data:new Blob([objects.get(path)]),error:null}:{data:null,error:{statusCode:404}};},async createSignedUrl(path,expires){return {data:{signedUrl:'https://example.invalid/storage/v1/object/sign/'+path+'?token=synthetic'},error:null};}};}};
 return {handle:createApkHandler({service,origins:[origin]}),release,objects,addRelease,bytes};
}
