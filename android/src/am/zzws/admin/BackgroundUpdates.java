package am.zzws.admin;

import android.app.*;
import android.app.job.*;
import android.content.*;
import android.content.pm.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import java.io.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;
import org.json.JSONObject;

/** All state transitions and file work run on IO; no Activity is retained by a download. */
final class BackgroundUpdates {
 static final ExecutorService IO=Executors.newSingleThreadExecutor();
 static final int PERIODIC_JOB=42101,COMPLETION_JOB=42102,READY_NOTIFICATION=42103;
 private static final String CHANNEL="zzws_partner_updates";
 private static final String STARTED="Թարմացման ֆայլի ներբեռնումը սկսվել է";
 private static final String DOWNLOADING="Թարմացումը ներբեռնվում է ֆոնային ռեժիմում";
 private static final String READY="Թարմացումը պատրաստ է տեղադրման";
 private static final String FAILED="Չհաջողվեց ներբեռնել թարմացումը։ Կրկին կփորձենք ավելի ուշ։";
 private static android.content.SharedPreferences state(Context c){return c.getSharedPreferences("zzws_partner_background_updates_v1",0);}
 private static DownloadManager downloads(Context c){return c.getSystemService(DownloadManager.class);}
 private static File verified(Context c){return new File(c.getFilesDir(),"updates/partner-update.apk");}
 static long installed(Context c)throws Exception{PackageInfo p=c.getPackageManager().getPackageInfo(c.getPackageName(),0);return code(p);}
 private static long code(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
 private static AppUpdatePolicy.Release release(Context c){try{return AppUpdatePolicy.newer(new JSONObject(state(c).getString("release","")),0);}catch(Exception e){return null;}}
 private static boolean current(Context c,String token){
  try{return EndpointConfiguration.RELEASE&&!BuildConfig.DEBUG&&!Thread.currentThread().isInterrupted()&&state(c).getBoolean("enabled",false)&&token.matches("[a-f0-9]{64}")&&UpdateFilePolicy.fingerprint(token).equals(state(c).getString("session",""))&&token.equals(new SecureSessionStore(c).read(EndpointConfiguration.API));}catch(Exception e){return false;}
 }
 static void activate(Context c,String token){
  try{
   if(!token.equals(new SecureSessionStore(c).read(EndpointConfiguration.API)))return;
   String fingerprint=UpdateFilePolicy.fingerprint(token);
   if(!fingerprint.equals(state(c).getString("session","")))clearTransfer(c);
   if(!state(c).edit().putBoolean("enabled",true).putString("session",fingerprint).commit())return;
   JobScheduler jobs=c.getSystemService(JobScheduler.class);
   if(jobs.getPendingJob(PERIODIC_JOB)==null)jobs.schedule(new JobInfo.Builder(PERIODIC_JOB,new ComponentName(c,UpdateCheckJobService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(15*60*1000L).setPersisted(true).build());
  }catch(Exception ignored){}
 }
 static void disable(Context c){
  // Invalidate a check already in flight before queuing cleanup behind it.
  state(c).edit().putBoolean("enabled",false).commit();
  JobScheduler jobs=c.getSystemService(JobScheduler.class);jobs.cancel(PERIODIC_JOB);jobs.cancel(COMPLETION_JOB);
  IO.execute(()->{clearTransfer(c);state(c).edit().clear().commit();});
 }
 static void completion(Context c,long id){
  if(id<=0||id!=state(c).getLong("download",-1)||!state(c).getBoolean("enabled",false))return;
  // The broadcast does no file/network work. The job checks the actual DownloadManager row.
  c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(COMPLETION_JOB,new ComponentName(c,UpdateCheckJobService.class)).setOverrideDeadline(0).setPersisted(true).build());
 }
 static void background(Context c,boolean completionOnly,BooleanSupplier stopped){
  if(!state(c).getBoolean("enabled",false)||stopped.getAsBoolean())return;
  String token=new SecureSessionStore(c).read(EndpointConfiguration.API);
  if(!current(c,token))return;
  if(completionOnly){try{reconcile(c,token);}catch(Exception ignored){fail(c);}return;}
  check(c,token,false,stopped);
 }
 static void check(Context c,String token,boolean manual,BooleanSupplier stopped){
  L10n.initialize(c);
  try{
   if(!current(c,token)||stopped.getAsBoolean())return;
   reconcile(c,token);
   ApiClient api=new ApiClient();api.configure(EndpointConfiguration.API,EndpointConfiguration.PUBLIC_KEY);api.restoreToken(token);
   AppUpdatePolicy.Release candidate=AppUpdatePolicy.newer(api.apkRelease().optJSONObject("release"),installed(c));
   if(!current(c,token)||stopped.getAsBoolean())return;
   String status=state(c).getString("status","");
   if(candidate==null){if(manual)AppUpdateNotice.information("ready".equals(status)?READY:"downloading".equals(status)?DOWNLOADING:"Ավելի նոր տարբերակ չկա");return;}
   if(UpdateFilePolicy.sameRelease(candidate,release(c))&&("ready".equals(status)||"downloading".equals(status))){
    if("ready".equals(status))notifyReady(c,candidate);
    if(manual)AppUpdateNotice.information("ready".equals(status)?READY:DOWNLOADING);
    return;
   }
   if(!manual&&!UpdateFilePolicy.retryDue(System.currentTimeMillis(),state(c).getLong("failedAt",0)))return;
   JSONObject linkData=api.apkDownloadLink(candidate.code);String link=linkData.optString("url");
   if(!AppUpdatePolicy.safeDownload(link,EndpointConfiguration.API,candidate))throw new IOException("Invalid update location");
   if(!current(c,token)||stopped.getAsBoolean())return;
   clearTransfer(c);
   File directory=c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
   if(directory==null)throw new IOException("Download storage unavailable");
   File target=new File(directory,"updates/"+candidate.sha256+".download");
   if(!target.getParentFile().isDirectory()&&!target.getParentFile().mkdirs())throw new IOException("Download directory unavailable");
   if(target.exists()&&!target.delete())throw new IOException("Cannot replace partial download");
   DownloadManager.Request request=new DownloadManager.Request(Uri.parse(link))
    .setTitle("ZZWS "+candidate.version).setDescription(L10n.t(STARTED))
    .setMimeType("application/octet-stream").setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
    .setAllowedOverMetered(true).setAllowedOverRoaming(false)
    .setDestinationInExternalFilesDir(c,Environment.DIRECTORY_DOWNLOADS,"updates/"+candidate.sha256+".download");
   // Signed URL is short-lived; it is not copied into our preferences or notifications.
   long id=downloads(c).enqueue(request);
   if(!state(c).edit().putLong("download",id).putString("release",candidate.json().toString()).putString("status","downloading").putString("reportId",linkData.optString("downloadId")).putBoolean("reported",false).remove("failedAt").commit()){
    downloads(c).remove(id);throw new IOException("Cannot remember download");
   }
   AppUpdateNotice.information(STARTED);
  }catch(Exception e){
   if(e instanceof ApiClient.ApiError&&(((ApiClient.ApiError)e).status==401||((ApiClient.ApiError)e).status==403))disable(c);
   if(manual)AppUpdateNotice.information("Չհաջողվեց ստուգել թարմացումը։ Կրկին փորձեք։");
  }
 }
 private static void reconcile(Context c,String token)throws Exception{
  AppUpdatePolicy.Release r=release(c);if(r==null){if(state(c).getLong("download",-1)>0)clearTransfer(c);return;}
  if(r.code<=installed(c)){clearTransfer(c);return;}
  if("ready".equals(state(c).getString("status",""))){if(!verified(c).isFile()||verified(c).length()!=r.bytes)fail(c);else reportVerified(c,token,r);return;}
  long id=state(c).getLong("download",-1);if(id<=0)return;
  try(Cursor row=downloads(c).query(new DownloadManager.Query().setFilterById(id))){
   if(row==null||!row.moveToFirst()){fail(c);return;}
   int status=row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
   if(status==DownloadManager.STATUS_PENDING||status==DownloadManager.STATUS_RUNNING||status==DownloadManager.STATUS_PAUSED)return;
   if(status!=DownloadManager.STATUS_SUCCESSFUL){fail(c);return;}
  }
  File destination=verified(c),temporary=new File(destination.getParentFile(),"verified.tmp.apk");
  if(!destination.getParentFile().isDirectory()&&!destination.getParentFile().mkdirs())throw new IOException("Update directory unavailable");
  try{
   try(ParcelFileDescriptor fd=downloads(c).openDownloadedFile(id);InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd);FileOutputStream out=new FileOutputStream(temporary)){
    UpdateFilePolicy.copyVerified(in,out,r.bytes,r.sha256);out.getFD().sync();
   }
   verifyArchive(c,temporary,r);
   if(!current(c,token)){clearTransfer(c);return;}
   if(destination.exists()&&!destination.delete())throw new IOException("Cannot replace update");
   if(!temporary.renameTo(destination))throw new IOException("Cannot stage update");
   if(!state(c).edit().putString("status","ready").remove("download").commit())throw new IOException("Cannot remember verified update");
   downloads(c).remove(id);reportVerified(c,token,r);notifyReady(c,r);
  }catch(Exception e){fail(c);throw e;}finally{temporary.delete();}
 }
 private static void reportVerified(Context c,String token,AppUpdatePolicy.Release r){
  String id=state(c).getString("reportId","");if(state(c).getBoolean("reported",false)||!id.matches("[a-fA-F0-9-]{36}")||!current(c,token))return;
  try{ApiClient api=new ApiClient();api.configure(EndpointConfiguration.API,EndpointConfiguration.PUBLIC_KEY);api.restoreToken(token);api.apkDownloadComplete(id,r.sha256,r.bytes);if(current(c,token))state(c).edit().putBoolean("reported",true).commit();}catch(Exception ignored){/* Retry independently of the verified installable file on the next check. */}
 }
 private static byte[][] signatures(PackageInfo p){
  Signature[] values=Build.VERSION.SDK_INT>=28?(p.signingInfo==null?null:p.signingInfo.getApkContentsSigners()):p.signatures;
  if(values==null)return null;byte[][] result=new byte[values.length][];for(int i=0;i<values.length;i++)result[i]=values[i].toByteArray();return result;
 }
 private static void verifyArchive(Context c,File file,AppUpdatePolicy.Release r)throws Exception{
  PackageManager pm=c.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
  PackageInfo archive=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags),own=pm.getPackageInfo(c.getPackageName(),flags);
  if(archive==null||!c.getPackageName().equals(archive.packageName)||code(archive)!=r.code||!r.version.equals(archive.versionName)||code(own)>=r.code||!UpdateFilePolicy.sameSigners(signatures(own),signatures(archive)))throw new IOException("Update package or signing certificate mismatch");
 }
 private static void clearTransfer(Context c){
  AppUpdatePolicy.Release r=release(c);long id=state(c).getLong("download",-1);
  try{if(id>0)downloads(c).remove(id);}catch(Exception ignored){}
  if(r!=null){File directory=c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(directory!=null)new File(directory,"updates/"+r.sha256+".download").delete();}
  verified(c).delete();new File(verified(c).getParentFile(),"verified.tmp.apk").delete();
  c.getSystemService(NotificationManager.class).cancel(READY_NOTIFICATION);
  state(c).edit().remove("download").remove("release").remove("status").remove("failedAt").remove("reportId").remove("reported").commit();
 }
 private static void fail(Context c){clearTransfer(c);state(c).edit().putString("status","failed").putLong("failedAt",System.currentTimeMillis()).commit();}
 private static void notifyReady(Context c,AppUpdatePolicy.Release r){
  L10n.initialize(c);NotificationManager manager=c.getSystemService(NotificationManager.class);
  manager.createNotificationChannel(new NotificationChannel(CHANNEL,L10n.t("Հավելվածի թարմացումներ"),NotificationManager.IMPORTANCE_LOW));
  PendingIntent open=PendingIntent.getActivity(c,READY_NOTIFICATION,new Intent(c,UpdateInstallActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification notice=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification_partner).setContentTitle("ZZWS "+r.version).setContentText(L10n.t(READY)).setContentIntent(open).setOnlyAlertOnce(true).setAutoCancel(true).addAction(new Notification.Action.Builder(null,L10n.t("Տեղադրել թարմացումը"),open).build()).build();
  try{manager.notify(READY_NOTIFICATION,notice);}catch(SecurityException ignored){/* The profile also exposes the install action. */}
 }
 static String status(Context c){
  switch(state(c).getString("status","")){case "downloading":return DOWNLOADING;case "ready":return READY;case "failed":return FAILED;default:return "";}
 }
 static boolean ready(Context c){return "ready".equals(state(c).getString("status",""));}
 static void install(Activity a){a.startActivity(new Intent(a,UpdateInstallActivity.class));}
 /** Called off the UI thread, again validating the private APK before granting read access. */
 static File installable(Context c)throws Exception{
  String token=new SecureSessionStore(c).read(EndpointConfiguration.API);
  if(!current(c,token))throw new IOException("No active update session");
  reconcile(c,token);AppUpdatePolicy.Release r=release(c);File file=verified(c);
  if(!ready(c)||r==null)throw new IOException("No verified update");
  try{
   try(InputStream in=new FileInputStream(file)){UpdateFilePolicy.copyVerified(in,new OutputStream(){public void write(int b){}public void write(byte[] b,int off,int len){}},r.bytes,r.sha256);}
   verifyArchive(c,file,r);return file;
  }catch(Exception e){fail(c);throw e;}
 }
}
