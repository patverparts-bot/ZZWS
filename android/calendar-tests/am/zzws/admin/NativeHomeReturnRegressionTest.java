package am.zzws.admin;

import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28,application=android.app.Application.class)
public class NativeHomeReturnRegressionTest {
 public static class StatusTool extends ManagementNavigationRegressionTest.Tool {
  final java.util.List<String> scripts=new java.util.ArrayList<>();
  @Override protected android.webkit.WebView createWebView(){browser=new ManagementNavigationRegressionTest.RecordingWebView(this){@Override public void evaluateJavascript(String script,android.webkit.ValueCallback<String> callback){scripts.add(script);super.evaluateJavascript(script,callback);}};return browser;}
 }
 private Button home(View view){if(view instanceof Button&&"⌂".equals(((Button)view).getText().toString()))return (Button)view;if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){Button found=home(((ViewGroup)view).getChildAt(i));if(found!=null)return found;}return null;}
 @Test public void webManagementHomeReturnsToExistingUnifiedScreenWithoutClearingAuthentication()throws Exception{
  String previous=AppSession.api.sessionToken(),token=new String(new char[64]).replace('\0','f');AppSession.api.restoreToken(token);
  Intent launch=new Intent(RuntimeEnvironment.getApplication(),ManagementNavigationRegressionTest.Tool.class).putExtra("feature","ORDERS");
  try(ActivityController<ManagementNavigationRegressionTest.Tool> controller=Robolectric.buildActivity(ManagementNavigationRegressionTest.Tool.class,launch).setup()){
   ManagementNavigationRegressionTest.Tool tool=controller.get();Button home=home(tool.getWindow().getDecorView());assertNotNull(home);home.performClick();
   Intent target=Shadows.shadowOf(tool).getNextStartedActivity();assertNotNull(target);assertEquals(UnifiedActivity.class.getName(),target.getComponent().getClassName());assertTrue(target.getBooleanExtra("zzws_home",false));assertEquals(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP,target.getFlags()&(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP));assertEquals(token,AppSession.api.sessionToken());assertTrue(tool.isFinishing());
  }finally{if(previous.isEmpty())AppSession.api.clear();else AppSession.api.restoreToken(previous);}
 }
 @Test public void homeIntentContainsOnlyNavigationAndDoesNotImpersonateOrReplaceTheSession(){
  Intent target=NativeNavigationKt.returnHomeIntent(RuntimeEnvironment.getApplication());assertEquals(1,target.getExtras().size());assertTrue(target.getBooleanExtra("zzws_home",false));assertNull(target.getStringExtra("sessionToken"));assertNull(target.getStringExtra("userId"));
 }
 @Test public void externalWebsiteActionsUseCanonicalCloudflareWithoutPassingSessionCredentials(){
  Intent launch=new Intent(RuntimeEnvironment.getApplication(),ManagementNavigationRegressionTest.Tool.class).putExtra("feature","ORDERS");
  try(ActivityController<ManagementNavigationRegressionTest.Tool> controller=Robolectric.buildActivity(ManagementNavigationRegressionTest.Tool.class,launch).setup()){
   ManagementNavigationRegressionTest.Tool tool=controller.get();
   for(boolean admin:new boolean[]{false,true}){
    UnifiedActivityKt.openWebsite(tool,admin);Intent opened=Shadows.shadowOf(tool).getNextStartedActivity();
    assertNotNull(opened);assertEquals(Intent.ACTION_VIEW,opened.getAction());assertEquals("https://zzws-1z2.pages.dev/"+(admin?"admin/":""),opened.getDataString());
    assertNull(opened.getStringExtra("sessionToken"));assertNull(opened.getData().getQuery());
   }
  }
 }
 @Test public void webOrderStatusIsBoundedAndAppliedToTheRealManagerControl(){
  for(String status:new String[]{"new","in_progress","untrusted&status=received"}){
   Intent launch=new Intent(RuntimeEnvironment.getApplication(),StatusTool.class).putExtra("feature","ORDERS").putExtra("zzws_status",status);
   try(ActivityController<StatusTool> controller=Robolectric.buildActivity(StatusTool.class,launch).setup()){
    StatusTool tool=controller.get();tool.browser.client.onPageFinished(tool.browser,"https://zzws-1z2.pages.dev/admin/#tab=manager");
    long applications=tool.scripts.stream().filter(script->script.contains("document.getElementById('managerStatusFilter')")).count();assertEquals(NativeNavigationKt.validOrderStatus(status)?1:0,applications);
    if(NativeNavigationKt.validOrderStatus(status))assertTrue(tool.scripts.stream().anyMatch(script->script.contains("s.value=\""+status+"\"")&&script.contains("dispatchEvent(new Event('change'")));
    tool.browser.client.onPageFinished(tool.browser,"https://zzws-1z2.pages.dev/admin/#tab=manager");assertEquals(applications,tool.scripts.stream().filter(script->script.contains("document.getElementById('managerStatusFilter')")).count());
   }
  }
 }
 @Test public void bothOrderManagementRoutesCarryOnlyValidatedStatusExtras()throws Exception{
  for(boolean mobile:new boolean[]{false,true}){
   org.json.JSONObject user=new org.json.JSONObject().put("role","admin").put("permissions",new org.json.JSONArray().put("orders:read")).put("mobileAdminEnabled",mobile);
   assertEquals("new",NativeNavigationKt.orderManagementIntent(RuntimeEnvironment.getApplication(),user,"new").getStringExtra("zzws_status"));
   assertFalse(NativeNavigationKt.orderManagementIntent(RuntimeEnvironment.getApplication(),user,"bad").hasExtra("zzws_status"));
  }
 }
}
