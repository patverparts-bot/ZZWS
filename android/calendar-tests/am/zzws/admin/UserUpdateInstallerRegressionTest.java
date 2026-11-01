package am.zzws.admin;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.os.Looper;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowActivity;
import org.robolectric.shadows.ShadowPackageManager;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class UserUpdateInstallerRegressionTest {
 private Context context;private JSONObject previousUser;private String previousToken;private ShadowPackageManager packages;
 private final String token=new String(new char[64]).replace('\0','b');
 @Before public void setup()throws Exception{
  context=RuntimeEnvironment.getApplication();previousUser=AppSession.user;previousToken=AppSession.api.sessionToken();VersionReminder.reset();
  context.getSharedPreferences(UserUpdateDownload.PREFS,0).edit().clear().commit();
  AppSession.user=new JSONObject().put("id","installer-owner");AppSession.api.restoreToken(token);
  packages=Shadows.shadowOf(context.getPackageManager());packages.setCanRequestPackageInstalls(true);
  PackageInfo installed=packages.getInternalMutablePackageInfo(context.getPackageName());installed.versionCode=BuildConfig.VERSION_CODE;signers(installed,"trusted");
  configureProviderStrategy();
 }
 @After public void cleanup()throws Exception{idle();VersionReminder.reset();clearProviderStrategies();AppSession.user=previousUser;if(previousToken.isEmpty())AppSession.api.clear();else AppSession.api.restoreToken(previousToken);}
 private static Map<String,Object> providerStrategies()throws Exception{Field cache=FileProvider.class.getDeclaredField("sCache");cache.setAccessible(true);return (Map<String,Object>)cache.get(null);}
 private static void clearProviderStrategies()throws Exception{providerStrategies().clear();}
 private static File androidPath(File file)throws java.io.IOException{
  final String canonical=file.getCanonicalPath().replace('\\','/');
  return new File(file.getPath()){@Override public String getPath(){return canonical;}@Override public String getCanonicalPath(){return canonical;}};
 }
 private void configureProviderStrategy()throws Exception{
  clearProviderStrategies();String authority=context.getPackageName()+".verifiedupdate";
  android.content.pm.ProviderInfo provider=context.getPackageManager().resolveContentProvider(authority,android.content.pm.PackageManager.GET_META_DATA);
  assertNotNull("Manifest must register the private verified-update provider",provider);assertFalse(provider.exported);assertTrue(provider.grantUriPermissions);
  Method load=FileProvider.class.getDeclaredMethod("getPathStrategy",Context.class,String.class,int.class);load.setAccessible(true);Object strategy=load.invoke(null,context,authority,0);
  Field paths=strategy.getClass().getDeclaredField("mRoots");paths.setAccessible(true);Map<String,File> roots=(Map<String,File>)paths.get(strategy);
  assertEquals(java.util.Collections.singleton("verified_update"),roots.keySet());assertEquals(new File(context.getFilesDir(),"user-update").getCanonicalFile(),roots.get("verified_update"));
  if(File.separatorChar!='\\')return;
  // AndroidX compares canonical paths with a literal '/'. On Windows only,
  // adapt the host representation, retaining the real XML and URI/root checks.
  for(Map.Entry<String,File> entry:roots.entrySet())entry.setValue(androidPath(entry.getValue()));
  Class<?> contract=Class.forName("androidx.core.content.FileProvider$PathStrategy",true,FileProvider.class.getClassLoader());
  Object adapted=Proxy.newProxyInstance(contract.getClassLoader(),new Class<?>[]{contract},(proxy,method,args)->{
   if(method.getName().equals("getUriForFile"))args=new Object[]{androidPath((File)args[0])};
   method.setAccessible(true);try{return method.invoke(strategy,args);}catch(InvocationTargetException failure){throw failure.getCause();}
  });
  providerStrategies().put(authority,adapted);
 }
 private static Signature signature(String value){return new Signature(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
 private static void signers(PackageInfo info,String value){info.signatures=new Signature[]{signature(value)};if(Build.VERSION.SDK_INT>=28)Api28.signers(info);}
 private static final class Api28 {static void signers(PackageInfo info){info.signingInfo=new android.content.pm.SigningInfo();Shadows.shadowOf(info.signingInfo).setSignatures(info.signatures);}}
 private void idle()throws Exception{for(int i=0;i<3;i++){Shadows.shadowOf(Looper.getMainLooper()).idle();CountDownLatch done=new CountDownLatch(1);UserUpdateDownload.complete(context,-1,done::countDown);assertTrue(done.await(10,TimeUnit.SECONDS));Shadows.shadowOf(Looper.getMainLooper()).idle();}}
 private final class Fixture {
  final byte[] bytes=new byte[512];final AppUpdatePolicy.Release release;final long id;final File file;final PackageInfo candidate;
  Fixture()throws Exception{
   bytes[17]=42;String sha=UserUpdateDownload.hex(MessageDigest.getInstance("SHA-256").digest(bytes));release=new AppUpdatePolicy.Release(BuildConfig.VERSION_CODE+1L,"99.1.0","",sha,bytes.length);
   DownloadManager dm=context.getSystemService(DownloadManager.class);id=dm.enqueue(new DownloadManager.Request(android.net.Uri.parse("https://example.invalid/fixture.apk")));status(DownloadManager.STATUS_SUCCESSFUL);
   prefs().edit().clear().putLong("id",id).putLong("code",release.code).putString("release",release.json().toString()).putString("owner","installer-owner").putString("receipt","00000000-0000-4000-8000-000000000001").putBoolean("acknowledged",true).putBoolean("installRequested",true).putString("installState","pending").commit();
   file=UserUpdateDownload.verifiedFile(context,id);assertNotNull(file);assertTrue(file.getParentFile().isDirectory()||file.getParentFile().mkdirs());Files.write(file.toPath(),bytes);
   candidate=new PackageInfo();candidate.packageName="am.zzws.admin";candidate.versionCode=(int)release.code;candidate.versionName=release.version;signers(candidate,"trusted");packages.setPackageArchiveInfo(file.getAbsolutePath(),candidate);
  }
  SharedPreferences prefs(){return context.getSharedPreferences(UserUpdateDownload.PREFS,0);}
  void status(int value){DownloadManager dm=context.getSystemService(DownloadManager.class);Shadows.shadowOf(Shadows.shadowOf(dm).getRequest(id)).setStatus(value);}
 }
 private Intent installer(Activity activity){ShadowActivity.IntentForResult started=Shadows.shadowOf(activity).getNextStartedActivityForResult();assertNotNull("Expected installer; persisted state="+context.getSharedPreferences(UserUpdateDownload.PREFS,0).getAll()+"; latest notice="+org.robolectric.shadows.ShadowToast.getTextOfLatestToast(),started);assertEquals(UserUpdateInstaller.REQUEST_INSTALL,started.requestCode);assertTrue(started.requestCode<=65535);return started.intent;}
 @Test public void verifiedExplicitUpdateOpensProtectedInstallerOnceAndUnknownResultNeverClaimsSuccess()throws Exception{
  Fixture f=new Fixture();assertEquals("content",UserUpdateInstaller.installIntent(context,f.file).getData().getScheme());try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity activity=controller.get();UserUpdateInstaller.resume(activity);idle();Intent intent=installer(activity);
   assertEquals(Intent.ACTION_INSTALL_PACKAGE,intent.getAction());assertEquals("application/vnd.android.package-archive",intent.getType());assertEquals("content",intent.getData().getScheme());assertEquals(context.getPackageName()+".verifiedupdate",intent.getData().getAuthority());
   assertEquals(Intent.FLAG_GRANT_READ_URI_PERMISSION,intent.getFlags()&Intent.FLAG_GRANT_READ_URI_PERMISSION);assertEquals(0,intent.getFlags()&Intent.FLAG_GRANT_WRITE_URI_PERMISSION);assertEquals(intent.getData(),intent.getClipData().getItemAt(0).getUri());assertTrue(intent.getBooleanExtra(Intent.EXTRA_RETURN_RESULT,false));
   assertArrayEquals(f.bytes,Files.readAllBytes(f.file.toPath()));assertTrue(f.prefs().getBoolean("verified",false));assertEquals("installer_launched",f.prefs().getString("installState",""));
   UserUpdateInstaller.resume(activity);idle();assertNull(Shadows.shadowOf(activity).getNextStartedActivityForResult());
   UserUpdateInstaller.activityResult(activity,UserUpdateInstaller.REQUEST_INSTALL,Activity.RESULT_OK);assertEquals("returned",f.prefs().getString("installState",""));assertTrue(f.file.isFile());
   UserUpdateInstaller.resume(activity);idle();assertNull(Shadows.shadowOf(activity).getNextStartedActivityForResult());
   // Explicit retry reuses/rechecks the protected APK, even if Downloads removed its row.
   context.getSystemService(DownloadManager.class).remove(f.id);UserUpdateInstaller.userAction(activity);UserUpdateInstaller.requested(activity,f.id);idle();assertEquals(Intent.ACTION_INSTALL_PACKAGE,installer(activity).getAction());
  }
 }
 @Test @Config(sdk=26) public void androidEightPermissionDenialNeverLoopsAndGrantedReturnResumesUserFlow()throws Exception{
  Fixture f=new Fixture();packages.setCanRequestPackageInstalls(false);try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity activity=controller.get();UserUpdateInstaller.resume(activity);idle();ShadowActivity.IntentForResult permission=Shadows.shadowOf(activity).getNextStartedActivityForResult();assertNotNull(permission);assertEquals(UserUpdateInstaller.REQUEST_SOURCES,permission.requestCode);assertEquals(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,permission.intent.getAction());assertEquals("package:"+context.getPackageName(),permission.intent.getDataString());
   UserUpdateInstaller.pause(activity);UserUpdateInstaller.activityResult(activity,UserUpdateInstaller.REQUEST_SOURCES,Activity.RESULT_CANCELED);UserUpdateInstaller.resume(activity);idle();assertNull(Shadows.shadowOf(activity).getNextStartedActivityForResult());assertTrue(f.file.isFile());
   UserUpdateInstaller.userAction(activity);UserUpdateInstaller.requested(activity,f.id);idle();assertEquals(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Shadows.shadowOf(activity).getNextStartedActivityForResult().intent.getAction());
   packages.setCanRequestPackageInstalls(true);UserUpdateInstaller.activityResult(activity,UserUpdateInstaller.REQUEST_SOURCES,Activity.RESULT_CANCELED);UserUpdateInstaller.resume(activity);idle();assertEquals(Intent.ACTION_INSTALL_PACKAGE,installer(activity).getAction());
  }
 }
 @Test public void completionInBackgroundWaitsForForegroundAndRestoredPersonalSession()throws Exception{
  Fixture f=new Fixture();f.status(DownloadManager.STATUS_RUNNING);assertTrue(f.file.delete());try(ActivityController<Activity> first=Robolectric.buildActivity(Activity.class).setup()){
   UserUpdateInstaller.resume(first.get());idle();assertNull("A running transfer has no retained verified APK",Shadows.shadowOf(first.get()).getNextStartedActivityForResult());UserUpdateInstaller.pause(first.get());
   Files.write(f.file.toPath(),f.bytes);f.status(DownloadManager.STATUS_SUCCESSFUL);UserUpdateDownload.complete(context,f.id,()->{});idle();assertNull("Background completion must retain the APK without launching an activity",Shadows.shadowOf(first.get()).getNextStartedActivityForResult());assertTrue(f.prefs().getBoolean("verified",false));
  }
  UserUpdateInstaller.reset();AppSession.user=null;AppSession.api.clear();try(ActivityController<Activity> reopened=Robolectric.buildActivity(Activity.class).setup()){
   UserUpdateInstaller.resume(reopened.get());idle();assertNull(Shadows.shadowOf(reopened.get()).getNextStartedActivityForResult());AppSession.user=new JSONObject().put("id","installer-owner");AppSession.api.restoreToken(token);Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(300));assertEquals(Intent.ACTION_INSTALL_PACKAGE,installer(reopened.get()).getAction());
  }
 }
 @Test public void aPersistedVerifiedFlagCannotBypassTamperedBytes()throws Exception{
  Fixture f=new Fixture();f.prefs().edit().putBoolean("verified",true).commit();byte[] tampered=f.bytes.clone();tampered[17]++;Files.write(f.file.toPath(),tampered);
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){UserUpdateInstaller.resume(controller.get());idle();assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivityForResult());assertFalse(f.prefs().contains("id"));assertFalse(f.file.exists());}
 }
 @Test public void packageVersionAndSignerMismatchNeverReachInstaller()throws Exception{
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   for(int variant=0;variant<4;variant++){Fixture f=new Fixture();if(variant==0)f.candidate.packageName="am.zzws.other";if(variant==1)f.candidate.versionCode--;if(variant==2)f.candidate.versionName="wrong-version";if(variant==3)signers(f.candidate,"untrusted");packages.setPackageArchiveInfo(f.file.getAbsolutePath(),f.candidate);UserUpdateInstaller.resume(controller.get());idle();assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivityForResult());assertFalse(f.prefs().contains("id"));}
  }
 }
 @Test public void anotherAccountAndUnrequestedLegacyDownloadNeverOpenAnInstaller()throws Exception{
  Fixture f=new Fixture();AppSession.user=new JSONObject().put("id","another-account");try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   UserUpdateInstaller.resume(controller.get());idle();assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivityForResult());assertTrue(f.file.isFile());AppSession.user=new JSONObject().put("id","installer-owner");f.prefs().edit().remove("installRequested").commit();UserUpdateInstaller.resume(controller.get());idle();assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivityForResult());
  }
 }
 @Test public void providerCannotGrantAccessToOtherPrivateApplicationFiles()throws Exception{
  File unrelated=new File(context.getFilesDir(),"not-an-update.txt");Files.write(unrelated.toPath(),new byte[]{1,2,3});try{UserUpdateInstaller.installIntent(context,unrelated);fail("Unrelated app-private file was exposed");}catch(IllegalArgumentException expected){}
 }
 @Test public void unrelatedChooserAndDocumentResultsDoNotReadOrChangeInstallerState()throws Exception{
  SharedPreferences saved=context.getSharedPreferences(UserUpdateDownload.PREFS,0);saved.edit().putInt("owner",17).putString("installState","preserve").commit();
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   UserUpdateInstaller.activityResult(controller.get(),21,Activity.RESULT_OK);UserUpdateInstaller.activityResult(controller.get(),22,Activity.RESULT_CANCELED);
   assertEquals(17,saved.getInt("owner",0));assertEquals("preserve",saved.getString("installState",""));assertNull(Shadows.shadowOf(controller.get()).getNextStartedActivityForResult());
  }
 }
}
