package am.zzws.admin;
import org.junit.Test;
import static org.junit.Assert.*;
import org.json.JSONObject;

public class AppUpdatePolicyTest {
 private JSONObject release(long code,String version)throws Exception{return new JSONObject().put("schemaVersion",1).put("package","am.zzws.admin").put("versionCode",code).put("version",version).put("bytes",1000).put("filename","ZZWS-"+version+"-production.apk").put("sha256",new String(new char[64]).replace('\0','a')).put("description","New release");}
 @Test public void comparesInternalVersionCodeAndIgnoresCurrentOrOlderVersions()throws Exception{
  assertNull(AppUpdatePolicy.newer(null,70010));assertNull(AppUpdatePolicy.newer(release(70010,"7.0.10"),70010));assertNull(AppUpdatePolicy.newer(release(70009,"7.0.9"),70010));
  assertEquals(70011,AppUpdatePolicy.newer(release(70011,"7.0.11"),70010).code);assertEquals("7.0.10",AppUpdatePolicy.newer(release(70010,"7.0.10"),70009).version);
 }
 @Test public void rejectsMalformedOrForeignReleaseMetadata()throws Exception{
  for(String field:new String[]{"package","sha256","filename","version"})assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put(field,"untrusted"),70010));
  assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put("versionCode","70011"),70010));assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put("bytes",50000001),70010));
  assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put("versionCode",70011.5),70010));
  assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put("bytes","1000"),70010));
  assertNull(AppUpdatePolicy.newer(release(70011,"7.0.11").put("bytes",1000.5),70010));
 }
 @Test public void checkThrottleSurvivesClockReset(){
  assertTrue(AppUpdatePolicy.due(10,-1));assertFalse(AppUpdatePolicy.due(300000,10));assertTrue(AppUpdatePolicy.due(300010,10));assertTrue(AppUpdatePolicy.due(0,10));
 }
 @Test public void remindersAreDailyButANewerReleaseOrClockResetIsNeverSuppressed(){
  assertTrue(AppUpdatePolicy.shouldRemind(70117,70116,100,100));
  assertFalse(AppUpdatePolicy.shouldRemind(70117,70117,1000,100));
  assertTrue(AppUpdatePolicy.shouldRemind(70117,70117,86400100,100));
  assertTrue(AppUpdatePolicy.shouldRemind(70117,70117,10,100));
  assertTrue(AppUpdatePolicy.shouldRemind(70117,-1,100,-1));
 }
}
