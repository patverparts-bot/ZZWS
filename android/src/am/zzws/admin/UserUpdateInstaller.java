package am.zzws.admin;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import java.io.File;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

/** Resumes only a persisted, explicit Update action. Android always owns installation consent. */
final class UserUpdateInstaller {
 static final int REQUEST_SOURCES=12221,REQUEST_INSTALL=12222;
 private static final Handler main=new Handler(Looper.getMainLooper());
 private static WeakReference<Activity> foreground=new WeakReference<>(null);
 private static SharedPreferences prefs(Context c){return c.getSharedPreferences(UserUpdateDownload.PREFS,Context.MODE_PRIVATE);}
 private static boolean active(Activity a){return a!=null&&foreground.get()==a&&!a.isFinishing()&&!a.isDestroyed()&&(!(a instanceof androidx.lifecycle.LifecycleOwner)||((androidx.lifecycle.LifecycleOwner)a).getLifecycle().getCurrentState().isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED));}
 private static boolean owner(SharedPreferences p){try{return AppSession.authenticated()&&!AppSession.api.sessionToken().isEmpty()&&p.getString("owner","").equals(AppSession.user.optString("id"));}catch(RuntimeException e){return false;}}
 private static boolean actionable(String state){return state.equals("pending")||state.equals("permission")||state.equals("permission_allowed");}
 private static boolean permitted(Context c){try{return Build.VERSION.SDK_INT<26||c.getPackageManager().canRequestPackageInstalls();}catch(RuntimeException e){return false;}}
 static Intent sourcesIntent(Context c){return new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+c.getPackageName()));}
 static Intent installIntent(Context c,File file){
  Uri uri=FileProvider.getUriForFile(c,c.getPackageName()+".verifiedupdate",file);
  Intent intent=new Intent(Intent.ACTION_INSTALL_PACKAGE).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).putExtra(Intent.EXTRA_RETURN_RESULT,true);
  intent.setClipData(ClipData.newRawUri("ZZWS update",uri));return intent;
 }
 static void resume(Activity a){foreground=new WeakReference<>(a);UserUpdateDownload.reconcile(a.getApplicationContext());}
 static void pause(Activity a){if(foreground.get()==a)foreground.clear();}
 static void reset(){foreground.clear();main.removeCallbacksAndMessages(null);}
 static void userAction(Activity a){if(!a.isFinishing()&&!a.isDestroyed())foreground=new WeakReference<>(a);}
 static void requested(Activity a,long id){
  SharedPreferences p=prefs(a);if(!UserUpdateDownload.owns(a,id)||!owner(p))return;
  if(!p.edit().putBoolean("installRequested",true).putString("installState","pending").commit())return;
  UserUpdateDownload.reconcile(a.getApplicationContext());
 }
 static void verified(Context c,long id){main.post(()->attempt(foreground.get(),id,SystemClock.elapsedRealtime()+60000));}
 private static void say(Activity a,String text){Toast.makeText(a,L10n.t(text),Toast.LENGTH_LONG).show();}
 private static long installedCode(Context c){try{PackageInfo p=c.getPackageManager().getPackageInfo(c.getPackageName(),0);return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}catch(Exception e){return -1;}}
 private static void attempt(Activity a,long id,long deadline){
  if(!active(a))return;SharedPreferences p=prefs(a);
  if(!UserUpdateDownload.owns(a,id)||!p.getBoolean("verified",false))return;
  if(!AppSession.authenticated()||AppSession.api.sessionToken().isEmpty()){
   if(SystemClock.elapsedRealtime()<deadline)main.postDelayed(()->attempt(a,id,deadline),250);return;
  }
  if(!owner(p))return;
  UserUpdateDownload.acknowledgeVerified(a.getApplicationContext(),id);
  try{
   AppUpdatePolicy.Release release=AppUpdatePolicy.newer(new JSONObject(p.getString("release","{}")),0);
   File file=UserUpdateDownload.verifiedFile(a,id);
   if(release==null||file==null||!file.isFile()||file.length()!=release.bytes)return;
   if(installedCode(a)>=release.code){p.edit().putBoolean("installRequested",false).putString("installState","installed").apply();return;}
   if(!p.getBoolean("installRequested",false)||!actionable(p.getString("installState","")))return;
   if(!permitted(a)){
    // Settings returns RESULT_CANCELED on some devices even after permission was granted.
    // Never reopen it on every resume; another Update tap is required after denial.
    if(!p.getString("installState","").equals("pending"))return;
    if(!p.edit().putString("installState","permission").commit())return;
    say(a,"Թարմացումը ստուգված է։ Թույլատրեք ZZWS-ից տեղադրումը, ապա վերադարձեք հավելված։");
    a.startActivityForResult(sourcesIntent(a),REQUEST_SOURCES);return;
   }
   if(!p.edit().putString("installState","installer_launched").commit())return;
   a.startActivityForResult(installIntent(a,file),REQUEST_INSTALL);
  }catch(Exception e){p.edit().putString("installState","returned").apply();say(a,"Չհաջողվեց բացել տեղադրիչը։ Ստուգված ֆայլը պահպանված է։ Կրկին սեղմեք «Թարմացնել»։");}
 }
 static void activityResult(Activity a,int request,int result){
  if(request!=REQUEST_SOURCES&&request!=REQUEST_INSTALL)return;
  SharedPreferences p=prefs(a);if(!owner(p))return;
  if(request==REQUEST_SOURCES&&p.getString("installState","").equals("permission")){
   boolean allowed=permitted(a);
   p.edit().putString("installState",allowed?"permission_allowed":"permission_denied").apply();
   if(!allowed)say(a,"Տեղադրման թույլտվությունը չի տրվել։ Ֆայլը պահպանված է։ Կրկին սեղմեք «Թարմացնել»։");
  }else if(request==REQUEST_INSTALL&&p.getString("installState","").equals("installer_launched")){
   long target=p.getLong("code",Long.MAX_VALUE);boolean installed=installedCode(a)>=target;
   // RESULT_OK/unknown results alone never establish an installed package/version.
   p.edit().putString("installState",installed?"installed":"returned").putBoolean("installRequested",!installed).putInt("installerResult",result).apply();
  }
 }
}
