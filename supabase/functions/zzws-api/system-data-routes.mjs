// The password is verified by the existing account helper, never stored in a job/archive.
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export async function systemDataRoutes(c){
 const {path,req,user,hash,mfaVerified,service,body,json,fail,digest,random,confirmAccountPassword}=c;
 if(!path.startsWith('admin/system-data/'))return null;
 if(user.role!=='admin'||user.adminScope!=='owner'||user.capabilities?.systemDataMaintenance!==true)fail(403,'Միայն հիմնական ադմինիստրատոր-սեփականատիրոջը');
 const rpc=async(name,args={})=>{const {data,error}=await service.rpc('zzws_maintenance_'+name,{p_actor:user.id,p_hash:hash,...args});if(error){if(error.code==='PT403')fail(403,'Մուտքագրեք սեփականատիրոջ ընթացիկ գաղտնաբառը և կրկին բացեք բաժինը');if(['PT409','23505','55P03'].includes(error.code))fail(409,'Տվյալները կամ գործողության վիճակը փոխվել են։ Թարմացրեք ստուգումը։');if(error.code==='PT404')fail(404,'Պահուստը կամ գործողությունը չի գտնվել');if(error.code==='PT400')fail(400,'Ստուգեք ընտրված բաժինները և հաստատումը');fail(500,'Գործողությունը չի ավարտվել։ Ստուգեք վիճակը և պահուստը։');}return data;};
 const token=async value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?digest(value):fail(403,'Կրկին հաստատեք մուտքը ընթացիկ գաղտնաբառով');
 const jobResponse=value=>{const response=json({job:value});if(value?.state==='completed'&&value.result){response.headers.set('X-ZZWS-Orders-Generation',String(value.result.ordersGeneration));response.headers.set('X-ZZWS-Workspace-Generation',String(value.result.workspaceGeneration));}return response;};
 if(path==='admin/system-data/unlock'&&req.method==='POST'){
  const p=await body(req);await confirmAccountPassword(req,user,hash,p.password,mfaVerified);const unlockToken=random(),result=await rpc('unlock',{p_token_hash:await digest(unlockToken)});return json({...result,unlockToken});
 }
 if(['admin/system-data/preview','admin/system-data/restore-preview'].includes(path)&&req.method==='POST'){
  const p=await body(req),restore=path.endsWith('/restore-preview');if(restore&&!uuid(p.archiveId))fail(400,'Ընտրեք պահուստը');
  if(!restore&&(!Array.isArray(p.categories)||p.categories.some(v=>typeof v!=='string')))fail(400,'Ընտրեք տվյալների բաժինները');
  return json(await rpc('preview',{p_unlock:await token(p.unlockToken),p_selected:restore?[]:p.categories,p_source_archive:restore?p.archiveId:null}));
 }
 if(['admin/system-data/start','admin/system-data/restore-start'].includes(path)&&req.method==='POST'){
  const p=await body(req);if(!uuid(p.previewId)||!uuid(p.requestId)||typeof p.fingerprint!=='string'||p.acknowledge!==true)fail(400,'Հաստատեք ստուգված հետևանքները');
  // PW2 is required for every start, even if PW1 or an unrelated five-minute reauth succeeded.
  await confirmAccountPassword(req,user,hash,p.password,mfaVerified);
  return jobResponse(await rpc('start',{p_unlock:await token(p.unlockToken),p_preview:p.previewId,p_fingerprint:p.fingerprint,p_request:p.requestId}));
 }
 if(path==='admin/system-data/current'&&req.method==='GET')return jobResponse(await rpc('status'));
 if(path==='admin/system-data/archives'&&req.method==='GET')return json(await rpc('archives_list'));
 const download=/^admin\/system-data\/archives\/([^/]+)\/download$/.exec(path);
 if(download&&req.method==='GET'){
  if(!uuid(download[1]))fail(400,'Սխալ պահուստ');const unlock=req.headers.get('X-ZZWS-Maintenance-Unlock');const result=await rpc('download',{p_archive:download[1],p_unlock:unlock?await token(unlock):null});
  const headers=new Headers(json(null).headers);headers.set('Content-Type','application/octet-stream');headers.set('Content-Disposition','attachment; filename="ZZWS-data-'+result.id+'.zzwsarchive.json"');headers.set('X-ZZWS-Archive-SHA256',result.sha256);headers.set('X-ZZWS-Archive-Bytes',String(result.downloadBytes));
  return new Response(result.payloadText,{headers}); // Exact SQL payload::text bytes, not JSON.stringify(decoded JSONB).
 }
 const job=/^admin\/system-data\/jobs\/([^/]+)(?:\/(step|confirm-delete|cancel))?$/.exec(path);
 if(job){
  if(!uuid(job[1]))fail(400,'Սխալ գործողություն');
  if(!job[2]&&req.method==='GET')return jobResponse(await rpc('status',{p_job:job[1]}));
  if(req.method==='POST'&&job[2]==='step')return jobResponse(await rpc('step',{p_job:job[1]}));
  if(req.method==='POST'&&job[2]==='cancel')return jobResponse(await rpc('cancel',{p_job:job[1]}));
  if(req.method==='POST'&&job[2]==='confirm-delete'){
   const p=await body(req);if(p.acknowledge!==true||p.fileSaved!==true||typeof p.fingerprint!=='string'||typeof p.archiveSha!=='string')fail(400,'Ներբեռնեք, պահեք և հաստատեք պահուստը');
   // PW3 is independent from PW1/PW2 and always checks the CURRENT password server-side.
   await confirmAccountPassword(req,user,hash,p.password,mfaVerified);
   return jobResponse(await rpc('confirm',{p_job:job[1],p_fingerprint:p.fingerprint,p_archive_sha:p.archiveSha}));
  }
 }
 fail(404,'Չի գտնվել');
}
