package am.zzws.admin;

import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** Real Activity lifecycle/back dispatcher and teardown; the browser JS has separate UI tests. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,application=android.app.Application.class)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
public class ManagementNavigationRegressionTest {
 public static class Tool extends PartnerWebActivity {
  RecordingWebView browser;
  @Override protected WebView createWebView(){browser=new RecordingWebView(this);return browser;}
  @Override protected void authenticateAndLoad(){/* No account or network needed to test navigation/lifecycle. */}
 }
 public static class RecordingWebView extends WebView {
  WebViewClient client;String response="\"root\"",pageUrl="https://patverparts-bot.github.io/ZZWS/admin/";int backRequests,historyBacks;boolean disposed,holdCallback;ValueCallback<String> pending;
  RecordingWebView(android.content.Context context){super(context);}
  @Override public void setWebViewClient(WebViewClient value){client=value;super.setWebViewClient(value);}
  @Override public void evaluateJavascript(String script,ValueCallback<String> callback){if(callback!=null){backRequests++;if(holdCallback)pending=callback;else callback.onReceiveValue(response);}}
  @Override public void goBack(){historyBacks++;}
  @Override public String getUrl(){return pageUrl;}
  @Override public void destroy(){assertNull("Detach WebView before destroy",getParent());disposed=true;super.destroy();}
  @Override public void loadUrl(String url){assertNotEquals("Do not navigate to bootstrap/blank during teardown","about:blank",url);super.loadUrl(url);}
 }
 private ActivityController<Tool> screen(){Intent intent=new Intent(org.robolectric.RuntimeEnvironment.getApplication(),Tool.class).putExtra("feature","ADMIN");return Robolectric.buildActivity(Tool.class,intent).setup().visible();}
 private void loaded(Tool tool){tool.browser.client.onPageFinished(tool.browser,"https://patverparts-bot.github.io/ZZWS/admin/#tab=users");}
 private Button find(View view,String text){if(view instanceof Button&&((Button)view).getText().toString().equals(text))return (Button)view;if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){Button result=find(((ViewGroup)view).getChildAt(i),text);if(result!=null)return result;}return null;}
 @Test public void hardwareBackInsideSectionDoesNotFinishTheTool(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();loaded(tool);tool.browser.response="\"handled\"";tool.getOnBackPressedDispatcher().onBackPressed();assertFalse(tool.isFinishing());assertEquals(1,tool.browser.backRequests);assertEquals(0,tool.browser.historyBacks);}}
 @Test public void toolbarBackUsesExactlyTheSameSectionNavigation(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();loaded(tool);tool.browser.response="\"handled\"";find(tool.getWindow().getDecorView(),"‹").performClick();assertFalse(tool.isFinishing());assertEquals(1,tool.browser.backRequests);}}
 @Test public void rootBackReturnsToParentInsteadOfLoadingSignInHistory(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();loaded(tool);tool.getOnBackPressedDispatcher().onBackPressed();assertTrue(tool.isFinishing());assertEquals(0,tool.browser.historyBacks);}}
 @Test public void closeDetachesBrowserBeforeDestroyAndNeverClearsSession()throws Exception{
  String previous=AppSession.api.sessionToken(),token=new String(new char[64]).replace('\0','a');AppSession.api.restoreToken(token);
  try{ActivityController<Tool> controller=screen();Tool tool=controller.get();RecordingWebView browser=tool.browser;
   find(tool.getWindow().getDecorView(),"×").performClick();assertTrue(tool.isFinishing());controller.pause().stop().destroy();assertTrue(browser.disposed);assertNull(browser.getParent());assertEquals(token,AppSession.api.sessionToken());
  }finally{if(previous.isEmpty())AppSession.api.clear();else AppSession.api.restoreToken(previous);}
 }
 @Test public void closingWhileLoadingDoesNotWaitForAuthentication(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();tool.getOnBackPressedDispatcher().onBackPressed();assertTrue(tool.isFinishing());assertEquals(0,tool.browser.backRequests);}}
 @Test public void rapidBackAndLateJavascriptAfterCloseAreIgnored(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();loaded(tool);tool.browser.holdCallback=true;tool.getOnBackPressedDispatcher().onBackPressed();tool.getOnBackPressedDispatcher().onBackPressed();assertEquals(1,tool.browser.backRequests);find(tool.getWindow().getDecorView(),"×").performClick();tool.browser.pending.onReceiveValue("\"handled\"");assertTrue(tool.isFinishing());assertEquals(0,tool.browser.historyBacks);}}
 @Test public void bootstrapIsNotTreatedAsAReadyTool(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();tool.browser.client.onPageFinished(tool.browser,"https://patverparts-bot.github.io/ZZWS/");tool.getOnBackPressedDispatcher().onBackPressed();assertTrue(tool.isFinishing());assertEquals(0,tool.browser.backRequests);}}
 @Test public void toolsCanBeOpenedAndClosedRepeatedly(){for(int i=0;i<5;i++){ActivityController<Tool> controller=screen();Tool tool=controller.get();loaded(tool);RecordingWebView browser=tool.browser;find(tool.getWindow().getDecorView(),"×").performClick();controller.pause().stop().destroy();assertTrue(browser.disposed);}}
 @Test public void rendererFailureReturnsToHubWithoutKillingTheApplication(){try(ActivityController<Tool> controller=screen()){Tool tool=controller.get();loaded(tool);RecordingWebView browser=tool.browser;assertTrue(browser.client.onRenderProcessGone(browser,null));assertTrue(tool.isFinishing());assertTrue(browser.disposed);}}
 @Test public void kitchenFixIsBundledOnlyForTheExactTrustedDealerScript()throws Exception{
  try(ActivityController<Tool> controller=screen()){
   Tool tool=controller.get();android.webkit.WebResourceResponse response=tool.browser.client.shouldInterceptRequest(tool.browser,request("https://patverparts-bot.github.io/ZZWS/js/dealer-tools.js?v=old"));
   assertNotNull(response);assertEquals("application/javascript",response.getMimeType());
   try(java.io.InputStream in=response.getData()){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);assertTrue(out.toString("UTF-8").contains("function bundleType"));}
   for(String url:new String[]{"https://example.com/ZZWS/js/dealer-tools.js","https://patverparts-bot.github.io/OTHER/js/dealer-tools.js","https://patverparts-bot.github.io/ZZWS/js/api.js"})assertNull(tool.browser.client.shouldInterceptRequest(tool.browser,request(url)));
  }
 }
 @Test public void viberShareRequiresTrustedPageTopFrameAndUserGesture(){
  try(ActivityController<Tool> controller=screen()){
   Tool tool=controller.get();String link="viber://forward?text=%D4%B2%D5%A1%D6%80%D6%87%20%2342";
   org.robolectric.shadows.ShadowActivity activity=org.robolectric.Shadows.shadowOf(tool);
   assertTrue(tool.browser.client.shouldOverrideUrlLoading(tool.browser,request(link,true,true)));
   Intent opened=activity.getNextStartedActivity();assertNotNull(opened);assertEquals(Intent.ACTION_VIEW,opened.getAction());assertEquals("com.viber.voip",opened.getPackage());assertEquals(link,opened.getDataString());
   for(android.webkit.WebResourceRequest req:new android.webkit.WebResourceRequest[]{request(link,false,true),request(link,true,false),request("viber://chat?number=%2B37491123456&draft=Hello",true,true),request("viber://forward?text=Hello&number=%2B37491123456",true,true)}){
    assertTrue(tool.browser.client.shouldOverrideUrlLoading(tool.browser,req));assertNull(activity.getNextStartedActivity());
   }
   tool.browser.pageUrl="https://example.com/";
   assertTrue(tool.browser.client.shouldOverrideUrlLoading(tool.browser,request(link,true,true)));assertNull(activity.getNextStartedActivity());
  }
 }
 private android.webkit.WebResourceRequest request(String url){return request(url,false,false);}
 private android.webkit.WebResourceRequest request(String url,boolean top,boolean gesture){return new android.webkit.WebResourceRequest(){public android.net.Uri getUrl(){return android.net.Uri.parse(url);}public boolean isForMainFrame(){return top;}public boolean isRedirect(){return false;}public boolean hasGesture(){return gesture;}public String getMethod(){return "GET";}public java.util.Map<String,String> getRequestHeaders(){return java.util.Collections.emptyMap();}};}
}
