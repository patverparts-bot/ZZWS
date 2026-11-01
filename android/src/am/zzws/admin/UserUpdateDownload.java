package am.zzws.admin;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.widget.Toast;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.URI;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** User-requested APK transfer; verification precedes a foreground, consent-owned installer. */
final class UserUpdateDownload {
 static final String PREFS="zzws_user_update_download_v1";
 private static final String MIME="application/vnd.android.package-archive";
 private static final ExecutorService io=Executors.newSingleThreadExecutor();
 private static final ExecutorService receipts=Executors.newSingleThreadExecutor();
 private static final Set<Long> acknowledging=new HashSet<>();
 private static final Handler main=new Handler(Looper.getMainLooper());
 private static boolean starting;
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
 static File verifiedFile(Context c,long id){
  if(!owns(c,id))return null;
  try{AppUpdatePolicy.Release release=AppUpdatePolicy.newer(new JSONObject(prefs(c).getString("release","{}")),0);return release==null?null:new File(new File(c.getFilesDir(),"user-update"),release.sha256+".apk");}catch(Exception e){return null;}
 }
 static boolean owns(Context c,long id){return id>=0&&prefs(c).getLong("id",-1)==id;}
 private static String owner(){return AppSession.user==null?"":AppSession.user.optString("id");}
 private static void say(Context c,String message){main.post(()->{if(AppSession.user!=null)Toast.makeText(c,L10n.t(message),Toast.LENGTH_LONG).show();});}
 static Intent downloadsIntent(){return new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);}
 static void showDownloads(Activity a){try{a.startActivity(downloadsIntent());}catch(android.content.ActivityNotFoundException e){say(a,"Չհաջողվեց բացել ներբեռնումները։");}}
 static Uri checkedLink(String value,String api,AppUpdatePolicy.Release release)throws Exception{
  URI url=new URI(value),origin=new URI(api);
  String expected="/storage/v1/object/sign/zzws-android-releases/files/"+release.sha256+".apk";
  if(value.length()>16000||value.matches("(?s).*[\\x00-\\x20\\x7f].*")||!"https".equals(url.getScheme())||!origin.getHost().equalsIgnoreCase(url.getHost())||url.getUserInfo()!=null||url.getFragment()!=null||(url.getPort()!=-1&&url.getPort()!=443)||!expected.equals(url.getRawPath())||url.getRawQuery()==null||!url.getRawQuery().matches("(?:.*&)?token=[^&]+(?:&.*)?"))throw new Exception("Invalid APK download link");
  return Uri.parse(value);
 }
 static DownloadManager.Request request(Context c,AppUpdatePolicy.Release release,Uri uri){
  DownloadManager.Request request=new DownloadManager.Request(uri).setTitle("ZZWS "+release.version).setDescription(L10n.t("Ներբեռնվում է հավելվածի թարմացումը…")).setMimeType(MIME).setAllowedOverRoaming(false).setAllowedOverMetered(true).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
  String filename="ZZWS-"+release.version+"-production.apk";
  File directory=Build.VERSION.SDK_INT>=29?Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS):c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
  if(directory!=null&&new File(directory,filename).exists())filename="ZZWS-"+release.version+"-production-"+System.currentTimeMillis()+".apk";
  if(Build.VERSION.SDK_INT>=29)request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,filename);
  else request.setDestinationInExternalFilesDir(c,Environment.DIRECTORY_DOWNLOADS,filename);
  return request;
 }
 private static int status(DownloadManager dm,long id){
  if(id<0)return -1;
  try(Cursor row=dm.query(new DownloadManager.Query().setFilterById(id))){return row!=null&&row.moveToFirst()?row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)):-1;}
 }
 interface LinkProvider {JSONObject get(long code)throws Exception;}
 static void start(Activity activity,AppUpdatePolicy.Release release){start(activity,release,AppSession.api::apkDownloadLink,EndpointConfiguration.API);}
 static synchronized void start(Activity activity,AppUpdatePolicy.Release release,LinkProvider links,String api){
  if(!AppSession.authenticated()||AppSession.api.sessionToken().isEmpty()||activity.isFinishing()||activity.isDestroyed())return;
  UserUpdateInstaller.userAction(activity);
  if(starting){say(activity,"Պատրաստվում է ներբեռնումը…");return;}
  starting=true;Context c=activity.getApplicationContext();String who=owner(),token=AppSession.api.sessionToken();
  say(c,"Պատրաստվում է ներբեռնումը…");
  io.execute(()->{try{
   if(AppUpdatePolicy.newer(release.json(),BuildConfig.VERSION_CODE)==null)throw new Exception("Invalid update");
   DownloadManager dm=c.getSystemService(DownloadManager.class);if(dm==null)throw new Exception("DownloadManager unavailable");
   SharedPreferences saved=prefs(c);long previous=saved.getLong("id",-1);int old=status(dm,previous);
   AppUpdatePolicy.Release oldRelease=AppUpdatePolicy.newer(new JSONObject(saved.getString("release","{}")),0);
   if(oldRelease!=null&&oldRelease.code==release.code&&oldRelease.bytes==release.bytes&&oldRelease.version.equals(release.version)&&oldRelease.sha256.equals(release.sha256)&&saved.getString("owner","").equals(who)){
    if(old==DownloadManager.STATUS_PENDING||old==DownloadManager.STATUS_RUNNING||old==DownloadManager.STATUS_PAUSED){main.post(()->UserUpdateInstaller.requested(activity,previous));say(c,"Թարմացումն արդեն ներբեռնվում է։ Ստուգումից հետո կբացվի տեղադրիչը։");return;}
    File retained=verifiedFile(c,previous);
    if(old==DownloadManager.STATUS_SUCCESSFUL||retained!=null&&retained.isFile()){main.post(()->UserUpdateInstaller.requested(activity,previous));say(c,"Թարմացման ֆայլը ստուգվում է։ Հետո կբացվի Android-ի տեղադրիչը։");return;}
    if(old==DownloadManager.STATUS_FAILED)dm.remove(previous);
   }
   JSONObject link=links.get(release.code);Uri uri=checkedLink(link.getString("url"),api,release);
   String receipt=link.optString("downloadId");if(!receipt.matches("[a-fA-F0-9-]{36}"))throw new Exception("Invalid download receipt");
   if(!AppSession.authenticated()||!who.equals(owner())||!token.equals(AppSession.api.sessionToken()))return;
   long id=dm.enqueue(request(c,release,uri));
   if(!saved.edit().clear().putLong("id",id).putLong("code",release.code).putString("release",release.json().toString()).putString("owner",who).putString("receipt",receipt).putBoolean("installRequested",true).putString("installState","pending").commit()){dm.remove(id);throw new Exception("Download state not saved");}
   complete(c,id,()->{});
   say(c,"Ներբեռնումը սկսված է։ Ստուգումից հետո կբացվի Android-ի տեղադրիչը։");
  }catch(Exception e){say(c,"Չհաջողվեց ներբեռնել թարմացումը։ Կրկին սեղմեք «Թարմացնել»։");}
  finally{synchronized(UserUpdateDownload.class){starting=false;}}});
 }
 static void reconcile(Context c){long id=prefs(c).getLong("id",-1);if(id>=0)complete(c,id,()->{});}
 static void complete(Context c,long id,Runnable done){io.execute(()->{try{verify(c,id);}finally{done.run();}});}
 private static void acknowledge(Context c,long id,AppUpdatePolicy.Release release){
  SharedPreferences saved=prefs(c);
  if(saved.getBoolean("acknowledged",false)||!AppSession.authenticated()||!saved.getString("owner","").equals(owner()))return;
  synchronized(UserUpdateDownload.class){if(!acknowledging.add(id))return;}
  receipts.execute(()->{try{
   if(!owns(c,id)||!AppSession.authenticated()||!saved.getString("owner","").equals(owner()))return;
   AppSession.api.apkDownloadComplete(saved.getString("receipt",""),release.sha256,release.bytes);
   if(owns(c,id))saved.edit().putBoolean("acknowledged",true).apply();
  }catch(Exception ignored){/* Persisted false retries on foreground reconciliation; never block installation. */}
  finally{synchronized(UserUpdateDownload.class){acknowledging.remove(id);}}});
 }
 static void acknowledgeVerified(Context c,long id){
  if(!owns(c,id)||!prefs(c).getBoolean("verified",false))return;
  try{AppUpdatePolicy.Release release=AppUpdatePolicy.newer(new JSONObject(prefs(c).getString("release","{}")),0);if(release!=null)acknowledge(c,id,release);}catch(Exception ignored){}
 }
 static String hex(byte[] bytes){StringBuilder result=new StringBuilder();for(byte b:bytes)result.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return result.toString();}
 static void copyVerified(InputStream input,OutputStream output,AppUpdatePolicy.Release release)throws Exception{
  MessageDigest digest=MessageDigest.getInstance("SHA-256");long bytes=0;byte[] buffer=new byte[65536];int count;
  while((count=input.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Interrupted APK verification");bytes+=count;if(bytes>release.bytes)throw new IOException("APK too large");digest.update(buffer,0,count);output.write(buffer,0,count);}
  if(bytes!=release.bytes||!release.sha256.equals(hex(digest.digest())))throw new IOException("APK checksum differs");
 }
 static boolean sameIdentity(PackageInfo candidate,PackageInfo installed,AppUpdatePolicy.Release release){
  if(candidate==null||installed==null||!"am.zzws.admin".equals(candidate.packageName)||!candidate.packageName.equals(installed.packageName)||!release.version.equals(candidate.versionName)||(Build.VERSION.SDK_INT>=28?candidate.getLongVersionCode():candidate.versionCode)!=release.code)return false;
  Signature[] a=Build.VERSION.SDK_INT>=28&&candidate.signingInfo!=null?candidate.signingInfo.getApkContentsSigners():candidate.signatures;
  Signature[] b=Build.VERSION.SDK_INT>=28&&installed.signingInfo!=null?installed.signingInfo.getApkContentsSigners():installed.signatures;
  if(a==null||b==null||a.length==0||a.length!=b.length)return false;
  for(Signature signer:a){boolean found=false;for(Signature known:b)if(Arrays.equals(signer.toByteArray(),known.toByteArray()))found=true;if(!found)return false;}return true;
 }
 private static void verify(Context c,long id){
  if(!owns(c,id))return;SharedPreferences saved=prefs(c);DownloadManager dm=c.getSystemService(DownloadManager.class);if(dm==null)return;
  try{
   AppUpdatePolicy.Release release=AppUpdatePolicy.newer(new JSONObject(saved.getString("release","{}")),0);if(release==null)throw new Exception("Invalid saved release");
   File verified=verifiedFile(c,id);if(verified==null)throw new Exception("Invalid verified path");
   if(status(dm,id)!=DownloadManager.STATUS_SUCCESSFUL&&!verified.isFile())return;
   File directory=verified.getParentFile();if(!directory.isDirectory()&&!directory.mkdirs())throw new Exception("Update directory unavailable");
   File temporary=new File(directory,release.sha256+".checking");
   if(!verified.isFile()){
    try{
     try(ParcelFileDescriptor descriptor=dm.openDownloadedFile(id);InputStream input=new ParcelFileDescriptor.AutoCloseInputStream(descriptor);FileOutputStream output=new FileOutputStream(temporary)){
      copyVerified(input,output,release);
     }
     int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;PackageManager pm=c.getPackageManager();
     if(!sameIdentity(pm.getPackageArchiveInfo(temporary.getAbsolutePath(),flags),pm.getPackageInfo(c.getPackageName(),flags),release))throw new Exception("APK identity differs");
     if(!owns(c,id))return;if(!temporary.renameTo(verified))throw new Exception("Verified APK was not retained");
    }finally{temporary.delete();}
   }
   // Never treat a persisted boolean as proof: private bytes and identity are rechecked.
   try(InputStream input=new FileInputStream(verified)){copyVerified(input,new OutputStream(){public void write(int b){}public void write(byte[] b,int start,int length){}},release);}
   int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;PackageManager pm=c.getPackageManager();
   if(!sameIdentity(pm.getPackageArchiveInfo(verified.getAbsolutePath(),flags),pm.getPackageInfo(c.getPackageName(),flags),release))throw new Exception("Retained APK identity differs");
   if(!owns(c,id))return;if(!saved.edit().putBoolean("verified",true).commit())throw new Exception("Verification state not saved");
   UserUpdateInstaller.verified(c,id);
   acknowledge(c,id,release);
  }catch(Exception e){if(owns(c,id)){File rejected=verifiedFile(c,id);dm.remove(id);saved.edit().clear().apply();if(rejected!=null)rejected.delete();say(c,"Թարմացման ֆայլը չի անցել ստուգումը։ Կրկին ներբեռնեք այն։");}}
 }
}
