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
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.URI;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** System-owned, user-requested APK transfer. No automatic starts, jobs or installer. */
final class UserUpdateDownload {
 static final String PREFS="zzws_user_update_download_v1";
 private static final String MIME="application/vnd.android.package-archive";
 private static final ExecutorService io=Executors.newSingleThreadExecutor();
 private static final Handler main=new Handler(Looper.getMainLooper());
 private static boolean starting;
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
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
  if(starting){say(activity,"Պատրաստվում է ներբեռնումը…");return;}
  starting=true;Context c=activity.getApplicationContext();String who=owner(),token=AppSession.api.sessionToken();
  say(c,"Պատրաստվում է ներբեռնումը…");
  io.execute(()->{try{
   if(AppUpdatePolicy.newer(release.json(),BuildConfig.VERSION_CODE)==null)throw new Exception("Invalid update");
   DownloadManager dm=c.getSystemService(DownloadManager.class);if(dm==null)throw new Exception("DownloadManager unavailable");
   SharedPreferences saved=prefs(c);long previous=saved.getLong("id",-1);int old=status(dm,previous);
   if(saved.getLong("code",-1)==release.code){
    if(old==DownloadManager.STATUS_PENDING||old==DownloadManager.STATUS_RUNNING||old==DownloadManager.STATUS_PAUSED){say(c,"Թարմացումն արդեն ներբեռնվում է։ Ընթացքը տեսանելի է ծանուցումների վահանակում։");return;}
    if(old==DownloadManager.STATUS_SUCCESSFUL&&saved.getBoolean("verified",false)){say(c,"Թարմացումը ներբեռնված է։ Բացեք «Ներբեռնումներ»-ը։");main.post(()->{if(!activity.isFinishing()&&!activity.isDestroyed())showDownloads(activity);});return;}
    if(old==DownloadManager.STATUS_SUCCESSFUL){verify(c,previous);say(c,"Թարմացումը ստուգվում է։ Բացեք «Ներբեռնումներ»-ը։");return;}
    if(old==DownloadManager.STATUS_FAILED)dm.remove(previous);
   }
   JSONObject link=links.get(release.code);Uri uri=checkedLink(link.getString("url"),api,release);
   String receipt=link.optString("downloadId");if(!receipt.matches("[a-fA-F0-9-]{36}"))throw new Exception("Invalid download receipt");
   if(!AppSession.authenticated()||!who.equals(owner())||!token.equals(AppSession.api.sessionToken()))return;
   long id=dm.enqueue(request(c,release,uri));
   if(!saved.edit().clear().putLong("id",id).putLong("code",release.code).putString("release",release.json().toString()).putString("owner",who).putString("receipt",receipt).commit()){dm.remove(id);throw new Exception("Download state not saved");}
   say(c,"Ներբեռնումը սկսված է։ Ընթացքը տեսանելի է ծանուցումների վահանակում։");
  }catch(Exception e){say(c,"Չհաջողվեց ներբեռնել թարմացումը։ Կրկին սեղմեք «Թարմացնել»։");}
  finally{synchronized(UserUpdateDownload.class){starting=false;}}});
 }
 static void reconcile(Context c){long id=prefs(c).getLong("id",-1);if(id>=0)complete(c,id,()->{});}
 static void complete(Context c,long id,Runnable done){io.execute(()->{try{verify(c,id);}finally{done.run();}});}
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
   if(status(dm,id)!=DownloadManager.STATUS_SUCCESSFUL)return;
   AppUpdatePolicy.Release release=AppUpdatePolicy.newer(new JSONObject(saved.getString("release","{}")),0);if(release==null)throw new Exception("Invalid saved release");
   if(!saved.getBoolean("verified",false)){
    File temporary=new File(c.getCacheDir(),"zzws-user-update-check.apk");
    try{
     try(ParcelFileDescriptor descriptor=dm.openDownloadedFile(id);InputStream input=new ParcelFileDescriptor.AutoCloseInputStream(descriptor);FileOutputStream output=new FileOutputStream(temporary)){
      copyVerified(input,output,release);
     }
     int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;PackageManager pm=c.getPackageManager();
     if(!sameIdentity(pm.getPackageArchiveInfo(temporary.getAbsolutePath(),flags),pm.getPackageInfo(c.getPackageName(),flags),release))throw new Exception("APK identity differs");
     if(!owns(c,id))return;saved.edit().putBoolean("verified",true).apply();
    }finally{temporary.delete();}
   }
   if(!saved.getBoolean("acknowledged",false)&&AppSession.authenticated()&&saved.getString("owner","").equals(owner())){
    try{AppSession.api.apkDownloadComplete(saved.getString("receipt",""),release.sha256,release.bytes);if(owns(c,id))saved.edit().putBoolean("acknowledged",true).apply();}catch(Exception ignored){/* Receipt retry never removes a verified APK. */}
   }
  }catch(Exception e){if(owns(c,id)){dm.remove(id);saved.edit().clear().apply();say(c,"Թարմացման ֆայլը չի անցել ստուգումը։ Կրկին ներբեռնեք այն։");}}
 }
}
