export async function apkDownloadsRoute({path,req,user,service,query,json,fail}){
 if(path!=='admin/users/apk-downloads')return null;
 if(req.method!=='GET'||user.role!=='admin'||!user.permissions?.includes('users'))fail(403,'Հասանելիությունն արգելված է');
 const params=new URL(req.url).searchParams,version=Number(params.get('versionCode')),offset=Number(params.get('offset')||0),search=(params.get('search')||'').trim(),status=params.get('status')||'';
 if(!Number.isSafeInteger(version)||version<1||version>2147483647||!Number.isSafeInteger(offset)||offset<0||offset>100000||search.length>100||!['','downloaded','requested','unknown'].includes(status))fail(400,'Ստուգեք APK-ի որոնման տվյալները');
 return json(await query(service.rpc('zzws_apk_download_report',{p_version:version,p_query:search,p_status:status,p_offset:offset})));
}
