package am.zzws.admin;

import android.app.Activity;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Environment;
import android.widget.Toast;
import java.io.File;
import org.json.JSONObject;

/** Updates are a manual action on our website in the external browser.
 * No APK download, staging, installer, or scheduled update work remains. */
final class BrowserUpdates {
 static final String WEBSITE="https://patverparts-bot.github.io/ZZWS/";
 private static boolean initialized;
 static synchronized void initialize(Context context){
  if(initialized)return;
  initialized=true;
  Context application=context.getApplicationContext();
  new Thread(()->cleanupLegacy(application),"zzws-legacy-update-cleanup").start();
 }
 /** Only cancel/remove resources owned by the previous ZZWS updater. Never touch account data. */
 static void cleanupLegacy(Context context){
  SharedPreferences old=context.getSharedPreferences("zzws_partner_background_updates_v1",0);
  old.edit().putBoolean("enabled",false).commit();
  try{JobScheduler jobs=context.getSystemService(JobScheduler.class);if(jobs!=null){jobs.cancel(42101);jobs.cancel(42102);}}catch(RuntimeException ignored){}
  try{NotificationManager notifications=context.getSystemService(NotificationManager.class);if(notifications!=null)notifications.cancel(42103);}catch(RuntimeException ignored){}
  long download=old.getLong("download",-1);
  boolean removed=download<0;
  try{DownloadManager downloads=context.getSystemService(DownloadManager.class);if(download>=0&&downloads!=null){downloads.remove(download);removed=true;}}catch(RuntimeException ignored){}
  new File(context.getFilesDir(),"updates/partner-update.apk").delete();
  new File(context.getFilesDir(),"updates/verified.tmp.apk").delete();
  try{
   String sha=new JSONObject(old.getString("release","{}")).optString("sha256");
   File directory=context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
   if(directory!=null&&sha.matches("[a-f0-9]{64}"))new File(directory,"updates/"+sha+".download").delete();
  }catch(Exception ignored){}
  // Retain a failed cancellation ID so a subsequent launch can retry it.
  if(removed)old.edit().clear().commit();
 }
 static Intent websiteIntent(){return new Intent(Intent.ACTION_VIEW,Uri.parse(WEBSITE)).addCategory(Intent.CATEGORY_BROWSABLE);}
 static void open(Activity activity){
  if(!AppSession.authenticated()||activity.isFinishing()||activity.isDestroyed())return;
  try{activity.startActivity(websiteIntent());}
  catch(android.content.ActivityNotFoundException e){Toast.makeText(activity,L10n.t("Չհաջողվեց բացել հավելվածը"),Toast.LENGTH_LONG).show();}
 }
}
