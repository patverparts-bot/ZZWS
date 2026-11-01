package am.zzws.admin;

import android.app.Activity;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.AlertDialog;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import java.io.File;
import java.nio.file.Files;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.shadows.ShadowAlertDialog;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;
import android.database.Cursor;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class BrowserUpdatesRegressionTest {
 public static class OtherJob extends android.app.job.JobService {
  public boolean onStartJob(JobParameters p){return false;}
  public boolean onStopJob(JobParameters p){return false;}
 }
 @Test public void downloadsOpensTheSystemManagerWithoutAWebsiteOrInstaller()throws Exception{
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   UserUpdateDownload.showDownloads(controller.get());
   Intent intent=Shadows.shadowOf(controller.get()).getNextStartedActivity();
   assertEquals(DownloadManager.ACTION_VIEW_DOWNLOADS,intent.getAction());
   assertNull(intent.getDataString());
   assertNull(intent.getComponent());assertNull(intent.getExtras());assertNull(intent.getClipData());assertNull(intent.getType());
   assertEquals(0,intent.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);
  }
 }
 @Test public void noDownloadWithoutAnAuthenticatedUser(){
  JSONObject previous=AppSession.user;
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   AppSession.user=null;UserUpdateDownload.start(controller.get(),new AppUpdatePolicy.Release(70119,"7.1.19","","",100));assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivity());
   try(Cursor rows=controller.get().getSystemService(DownloadManager.class).query(new DownloadManager.Query())){assertEquals(0,rows.getCount());}
  }finally{AppSession.user=previous;}
 }
 @Test public void reminderWaitsForAUserActionAndLaterDoesNotLaunchAnything()throws Exception{
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity a=controller.get();
   VersionReminder.prompt(a,new AppUpdatePolicy.Release(70117,"7.1.17","Release notes","",100));
   AlertDialog dialog=ShadowAlertDialog.getLatestAlertDialog();assertTrue(dialog.isShowing());
   assertTrue(Shadows.shadowOf(dialog).getTitle().toString().contains("7.1.17"));
   assertNull(Shadows.shadowOf(a).getNextStartedActivity());
   dialog.getButton(AlertDialog.BUTTON_NEGATIVE).performClick();
   Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
   assertNull(Shadows.shadowOf(a).getNextStartedActivity());VersionReminder.reset();
  }finally{VersionReminder.reset();}
 }
 @Test public void reminderConfirmationRunsOnlyTheDownloadAction()throws Exception{
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity a=controller.get();java.util.concurrent.atomic.AtomicInteger requested=new java.util.concurrent.atomic.AtomicInteger();
   VersionReminder.prompt(a,new AppUpdatePolicy.Release(70119,"7.1.19","Very long release notes must not obscure the update button","",100),requested::incrementAndGet);
   assertEquals(0,requested.get());assertEquals(L10n.t("Թարմացնել"),ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).getText().toString());
   ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();
   Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();
   assertEquals(1,requested.get());assertNull(Shadows.shadowOf(a).getNextStartedActivity());VersionReminder.reset();
  }finally{VersionReminder.reset();}
 }
 @Test public void migrationCancelsOnlyOldUpdaterAndPreservesAccountAndUnrelatedResources()throws Exception{
  Context c=RuntimeEnvironment.getApplication();
  JobScheduler jobs=c.getSystemService(JobScheduler.class);
  for(int id:new int[]{42101,42102,94123})jobs.schedule(new JobInfo.Builder(id,new ComponentName(c,OtherJob.class)).setMinimumLatency(10000).build());
  DownloadManager dm=c.getSystemService(DownloadManager.class);
  long owned=dm.enqueue(new DownloadManager.Request(Uri.parse("https://example.invalid/owned.apk")));
  long other=dm.enqueue(new DownloadManager.Request(Uri.parse("https://example.invalid/unrelated.pdf")));
  String sha=new String(new char[64]).replace('\0','a');
  c.getSharedPreferences("zzws_partner_background_updates_v1",0).edit().putBoolean("enabled",true).putLong("download",owned).putString("release",new JSONObject().put("sha256",sha).toString()).commit();
  c.getSharedPreferences("zzws_account_test",0).edit().putString("token","preserve-me").commit();
  File apk=new File(c.getFilesDir(),"updates/partner-update.apk"),tmp=new File(c.getFilesDir(),"updates/verified.tmp.apk"),keep=new File(c.getFilesDir(),"updates/unrelated.txt");
  apk.getParentFile().mkdirs();Files.write(apk.toPath(),new byte[]{1});Files.write(tmp.toPath(),new byte[]{1});Files.write(keep.toPath(),new byte[]{1});
  File partial=new File(c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"updates/"+sha+".download");partial.getParentFile().mkdirs();Files.write(partial.toPath(),new byte[]{1});
  BrowserUpdates.cleanupLegacy(c);BrowserUpdates.cleanupLegacy(c);
  assertNull(jobs.getPendingJob(42101));assertNull(jobs.getPendingJob(42102));assertNotNull(jobs.getPendingJob(94123));
  try(Cursor rows=dm.query(new DownloadManager.Query().setFilterById(owned))){assertEquals(0,rows.getCount());}
  try(Cursor rows=dm.query(new DownloadManager.Query().setFilterById(other))){assertEquals(1,rows.getCount());}
  assertFalse(apk.exists());assertFalse(tmp.exists());assertFalse(partial.exists());assertTrue(keep.exists());
  assertTrue(c.getSharedPreferences("zzws_partner_background_updates_v1",0).getAll().isEmpty());
  assertEquals("preserve-me",c.getSharedPreferences("zzws_account_test",0).getString("token",""));
 }
 @Test public void malformedLegacyMetadataCannotDeleteUnrelatedFiles()throws Exception{
  Context c=RuntimeEnvironment.getApplication();File keep=new File(c.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),"keep.download");Files.write(keep.toPath(),new byte[]{1});
  c.getSharedPreferences("zzws_partner_background_updates_v1",0).edit().putString("release",new JSONObject().put("sha256","../keep").toString()).commit();
  BrowserUpdates.cleanupLegacy(c);assertTrue(keep.exists());
 }
}
