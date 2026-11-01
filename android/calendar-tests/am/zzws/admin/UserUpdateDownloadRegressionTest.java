package am.zzws.admin;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.database.Cursor;
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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class UserUpdateDownloadRegressionTest {
 private final String sha=new String(new char[64]).replace('\0','a'),api="https://updates.example.invalid/functions/v1/zzws-api/";
 private AppUpdatePolicy.Release release(){return new AppUpdatePolicy.Release(70119,"7.1.19","",sha,100);}
 private String link(){return "https://updates.example.invalid/storage/v1/object/sign/zzws-android-releases/files/"+sha+".apk?token=test-signed-token";}
 private void idle(Context c)throws Exception{CountDownLatch done=new CountDownLatch(1);UserUpdateDownload.complete(c,-1,done::countDown);assertTrue(done.await(10,TimeUnit.SECONDS));Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();}
 @Test public void updateButtonEnqueuesTheExactApkOnceWithoutOpeningAWebsite()throws Exception{
  JSONObject previous=AppSession.user;String token=AppSession.api.sessionToken();
  try(ActivityController<Activity> controller=Robolectric.buildActivity(Activity.class).setup()){
   Activity a=controller.get();a.getSharedPreferences(UserUpdateDownload.PREFS,0).edit().clear().commit();AppSession.user=new JSONObject().put("id","test-owner");AppSession.api.restoreToken(new String(new char[64]).replace('\0','b'));
   AtomicInteger requests=new AtomicInteger();UserUpdateDownload.LinkProvider provider=code->{assertEquals(70119,code);requests.incrementAndGet();return new JSONObject().put("url",link()).put("downloadId","00000000-0000-4000-8000-000000000001");};
   VersionReminder.prompt(a,release(),()->UserUpdateDownload.start(a,release(),provider,api));DownloadManager dm=a.getSystemService(DownloadManager.class);
   try(Cursor rows=dm.query(new DownloadManager.Query())){assertEquals(0,rows.getCount());}
   ShadowAlertDialog.getLatestAlertDialog().getButton(AlertDialog.BUTTON_POSITIVE).performClick();idle(a);
   long id=a.getSharedPreferences(UserUpdateDownload.PREFS,0).getLong("id",-1);assertTrue(id>=0);assertTrue(UserUpdateDownload.owns(a,id));assertFalse(UserUpdateDownload.owns(a,id+1));
   try(Cursor rows=dm.query(new DownloadManager.Query().setFilterById(id))){assertTrue(rows.moveToFirst());assertEquals(link(),rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_URI)));}
   org.robolectric.shadows.ShadowDownloadManager.ShadowRequest request=Shadows.shadowOf(Shadows.shadowOf(dm).getRequest(id));
   assertEquals("application/vnd.android.package-archive",request.getMimeType());assertEquals(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED,request.getNotificationVisibility());assertFalse(request.getAllowedOverRoaming());assertTrue(request.getRequestHeaders().isEmpty());assertTrue(request.getDestination().toString().endsWith("ZZWS-7.1.19-production.apk"));
   request.setStatus(DownloadManager.STATUS_RUNNING);UserUpdateDownload.start(a,release(),provider,api);idle(a);assertEquals(1,Shadows.shadowOf(dm).getRequestCount());
   assertEquals(1,requests.get());assertNull(Shadows.shadowOf(a).getNextStartedActivity());
   dm.remove(id);
  }finally{VersionReminder.reset();AppSession.user=previous;if(token.isEmpty())AppSession.api.clear();else AppSession.api.restoreToken(token);}
 }
 @Test public void linksMustMatchTheConfiguredOriginAndExactReleaseHash()throws Exception{
  assertEquals(link(),UserUpdateDownload.checkedLink(link(),api,release()).toString());
  for(String invalid:new String[]{link().replace("https:","http:"),link().replace("updates.example.invalid","evil.example.invalid"),link().replace("updates.example.invalid","user@updates.example.invalid"),link().replace(sha,new String(new char[64]).replace('\0','b')),link()+"#fragment",link().replace("/sign/","/public/"),link().replace("?token=test-signed-token","")}){
   try{UserUpdateDownload.checkedLink(invalid,api,release());fail("Untrusted link accepted");}catch(Exception expected){}
  }
 }
 @Test public void verifiesTheExactBytesBeforeAcceptingAFile()throws Exception{
  byte[] bytes=new byte[256];bytes[100]=12;String hash=UserUpdateDownload.hex(MessageDigest.getInstance("SHA-256").digest(bytes));AppUpdatePolicy.Release r=new AppUpdatePolicy.Release(70119,"7.1.19","",hash,bytes.length);ByteArrayOutputStream output=new ByteArrayOutputStream();
  UserUpdateDownload.copyVerified(new ByteArrayInputStream(bytes),output,r);assertArrayEquals(bytes,output.toByteArray());
  for(AppUpdatePolicy.Release bad:new AppUpdatePolicy.Release[]{new AppUpdatePolicy.Release(r.code,r.version,"",r.sha256,255),new AppUpdatePolicy.Release(r.code,r.version,"",r.sha256,257),new AppUpdatePolicy.Release(r.code,r.version,"",sha,256)}){
   try{UserUpdateDownload.copyVerified(new ByteArrayInputStream(bytes),new ByteArrayOutputStream(),bad);fail("Unverified bytes accepted");}catch(java.io.IOException expected){}
  }
 }
 private PackageInfo identity(String pkg,int code,String version,String signer){PackageInfo p=new PackageInfo();p.packageName=pkg;p.versionCode=code;p.versionName=version;p.signatures=new Signature[]{new Signature(signer.getBytes(java.nio.charset.StandardCharsets.UTF_8))};return p;}
 @Test public void packageVersionAndSigningCertificateMustMatch(){
  PackageInfo installed=identity("am.zzws.admin",70118,"7.1.18","release-certificate");assertTrue(UserUpdateDownload.sameIdentity(identity("am.zzws.admin",70119,"7.1.19","release-certificate"),installed,release()));
  assertFalse(UserUpdateDownload.sameIdentity(identity("am.zzws.partner",70119,"7.1.19","release-certificate"),installed,release()));assertFalse(UserUpdateDownload.sameIdentity(identity("am.zzws.admin",70119,"7.1.19","other-certificate"),installed,release()));assertFalse(UserUpdateDownload.sameIdentity(identity("am.zzws.admin",70118,"7.1.19","release-certificate"),installed,release()));
 }
}
