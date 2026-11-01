package am.zzws.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.widget.Toast;
import java.lang.ref.WeakReference;
import java.util.concurrent.Executors;

/** Foreground checks show a reminder; only the explicit Update button starts a download. */
final class VersionReminder {
 private static final Handler main=new Handler(Looper.getMainLooper());
 private static final java.util.concurrent.ExecutorService io=Executors.newSingleThreadExecutor();
 private static WeakReference<Activity> foreground=new WeakReference<>(null);
 private static long lastCheck=-1;
 private static String checkedToken="";
 private static boolean checking;
 private static AlertDialog visible;
 private static final Runnable tick=new Runnable(){public void run(){Activity a=foreground.get();if(a!=null){check(a);main.postDelayed(this,AppUpdatePolicy.CHECK_INTERVAL);}}};
 static void resume(Activity a){foreground=new WeakReference<>(a);UserUpdateInstaller.resume(a);main.removeCallbacks(tick);check(a);main.postDelayed(tick,AppUpdatePolicy.CHECK_INTERVAL);}
 static void pause(Activity a){UserUpdateInstaller.pause(a);if(foreground.get()==a){foreground.clear();main.removeCallbacks(tick);if(visible!=null){visible.dismiss();visible=null;}}}
 static void reset(){checkedToken="";lastCheck=-1;UserUpdateInstaller.reset();if(visible!=null){visible.dismiss();visible=null;}}
 private static boolean eligible(Activity a){return EndpointConfiguration.RELEASE&&!BuildConfig.DEBUG&&AppSession.authenticated()&&!AppSession.api.sessionToken().isEmpty()&&foreground.get()==a&&!a.isFinishing()&&!a.isDestroyed();}
 static void check(Activity a){start(a,false);}
 static void manual(Activity a){start(a,true);}
 private static void start(Activity a,boolean manual){
  if(!eligible(a)||checking)return;
  String token=AppSession.api.sessionToken();
  if(!token.equals(checkedToken)){checkedToken=token;lastCheck=-1;}
  if(!manual&&!AppUpdatePolicy.due(SystemClock.elapsedRealtime(),lastCheck))return;
  checking=true;lastCheck=SystemClock.elapsedRealtime();
  WeakReference<Activity> owner=new WeakReference<>(a);
  io.execute(()->{
   AppUpdatePolicy.Release release=null;boolean failed=false;
   try{release=AppUpdatePolicy.newer(AppSession.api.apkRelease().optJSONObject("release"),BuildConfig.VERSION_CODE);}catch(Exception e){failed=true;}
   final AppUpdatePolicy.Release result=release;final boolean error=failed;
   main.post(()->{
    checking=false;Activity activity=owner.get();
    if(activity==null||!eligible(activity)||!token.equals(AppSession.api.sessionToken()))return;
    if(error){if(manual)information(activity,"Չհաջողվեց ստուգել թարմացումը։ Կրկին փորձեք։");return;}
    if(result==null){if(manual)information(activity,"Ավելի նոր տարբերակ չկա");return;}
    SharedPreferences seen=activity.getSharedPreferences("zzws_version_reminder_v1",Context.MODE_PRIVATE);
    long now=System.currentTimeMillis();
    if(manual||AppUpdatePolicy.shouldRemind(result.code,seen.getLong("code",-1),now,seen.getLong("shownAt",-1))){
     if(prompt(activity,result))seen.edit().putLong("code",result.code).putLong("shownAt",now).apply();
    }
   });
  });
 }
 private static void information(Activity a,String text){Toast.makeText(a,L10n.t(text),Toast.LENGTH_LONG).show();}
 static boolean prompt(Activity a,AppUpdatePolicy.Release release){
  return prompt(a,release,()->UserUpdateDownload.start(a,release));
 }
 static boolean prompt(Activity a,AppUpdatePolicy.Release release,Runnable confirmed){
  if(visible!=null&&visible.isShowing())return false;
  visible=new AlertDialog.Builder(a)
   .setTitle(L10n.t("Հասանելի է ZZWS-ի նոր տարբերակ՝ ")+release.version)
   .setMessage(L10n.t("Սեղմեք «Թարմացնել»՝ նոր տարբերակը ներբեռնելու և Android-ի տեղադրիչը բացելու համար։"))
   .setPositiveButton(L10n.t("Թարմացնել"),(dialog,which)->confirmed.run())
   .setNegativeButton(L10n.t("Ավելի ուշ"),(dialog,which)->{}).create();
  AlertDialog shown=visible;
  shown.setOnDismissListener(dialog->{if(visible==shown)visible=null;});
  shown.show();
  return true;
 }
}
