package am.zzws.admin;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.print.PrintManager;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import android.graphics.Color;
import org.json.*;
import java.io.*;
import java.net.URI;
import java.util.concurrent.Executors;

/** Authenticated, origin-pinned tools. There is deliberately no JavaScript interface. */
public class PartnerWebActivity extends ComponentActivity {
 private static final String SITE="https://patverparts-bot.github.io/ZZWS/";
 private final Handler main=new Handler();
 private final java.util.concurrent.ExecutorService io=Executors.newSingleThreadExecutor();
 private WebView web;private TextView status;private ProgressBar progress;private boolean destroyed,ready,leaving,backPending;
 private String token="",downloadUrl="",downloadMime="application/octet-stream",downloadName="ZZWS-export";
 private boolean downloadBusy;private OutputStream activeOutput;
 private ValueCallback<Uri[]> chooser;private PartnerFeature feature;
 @Override protected void onResume(){super.onResume();VersionReminder.resume(this);}
 @Override protected void onPause(){VersionReminder.pause(this);super.onPause();}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);AppSession.initialize(getApplicationContext());L10n.initialize(this);
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){navigateBack();}});
  try{feature=PartnerFeature.valueOf(getIntent().getStringExtra("feature"));}catch(Exception e){finish();return;}
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);
  androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{androidx.core.graphics.Insets safe=insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars()|androidx.core.view.WindowInsetsCompat.Type.displayCutout());view.setPadding(safe.left,safe.top,safe.right,safe.bottom);return insets;});
  LinearLayout bar=new LinearLayout(this);bar.setPadding(0,0,0,0);bar.setGravity(android.view.Gravity.CENTER_VERTICAL);
  Button back=button("‹",this::navigateBack);back.setContentDescription(L10n.t("Հետ"));
  TextView title=new TextView(this);title.setText(L10n.t(feature.getTitle()));title.setTextSize(16);title.setTextColor(0xff0f172a);title.setGravity(android.view.Gravity.CENTER_VERTICAL);
  Button close=button("×",this::returnToParent);close.setContentDescription(L10n.t("Փակել"));bar.addView(back);bar.addView(title,new LinearLayout.LayoutParams(0,-1,1));bar.addView(button("Տպել",this::print));bar.addView(close);root.addView(bar,new LinearLayout.LayoutParams(-1,Math.round(48*getResources().getDisplayMetrics().density)));
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,new LinearLayout.LayoutParams(-1,5));
  status=new TextView(this);status.setPadding(16,8,16,8);status.setText(L10n.t("Տվյալները բեռնվում են…"));root.addView(status);
  web=createWebView();root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setGeolocationEnabled(false);settings.setSafeBrowsingEnabled(true);settings.setSaveFormData(false);settings.setUserAgentString(settings.getUserAgentString()+" ZZWS/7.1.10");
  CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    // Ship this tool's fix with the APK, independently of the site's publication schedule.
    if("GET".equals(request.getMethod())&&PartnerPolicyKt.trustedPartnerPage(request.getUrl().toString())&&"/ZZWS/js/dealer-tools.js".equals(request.getUrl().getPath())){
     try{return new WebResourceResponse("application/javascript","UTF-8",getAssets().open("dealer-tools.js"));}catch(IOException ignored){}
    }
    return null;
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    if(destroyed||leaving)return true;
    String url=request.getUrl().toString();if(PartnerPolicyKt.trustedPartnerPage(url))return false;
    if(request.isForMainFrame()&&request.hasGesture()&&PartnerPolicyKt.trustedPartnerPage(view.getUrl()))external(url);return true;
   }
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon){if(destroyed||leaving)return;if(!PartnerPolicyKt.trustedPartnerPage(url)){view.stopLoading();status.setText(L10n.t("Հասցեն թույլատրված չէ"));return;}progress.setVisibility(View.VISIBLE);}
   @Override public void onPageFinished(WebView view,String url){
    if(!PartnerPolicyKt.trustedPartnerPage(url)||destroyed||leaving)return;
    if(!ready&&!Uri.parse(url).getPath().startsWith("/ZZWS/admin/")&&Uri.parse(url).getQueryParameter("partner")==null)return;
    ready=true;progress.setVisibility(View.GONE);status.setVisibility(View.GONE);
    injectNavigation(view);
    if(Uri.parse(url).getPath().startsWith("/ZZWS/admin/")){applyAdminStyle(view);applyAdminLabels(view);}
    String action="";
    switch(feature){
     case ASSISTANT:action="if(window.ZZWS_ASSISTANT){ZZWS_ASSISTANT.open();return true;}";break;
     case TEAM:action="if(window.ZZWS_TEAM){ZZWS_TEAM.open();return true;}";break;
     case SAVED_CARTS:action="if(typeof openOrderModal==='function')openOrderModal();var p=document.getElementById('savedCartsPanel');if(p){p.open=true;p.scrollIntoView();return true;}";break;
     case TECHNICAL:action="if(window.ZZWS_STOREFRONT)ZZWS_STOREFRONT.navigate('catalog');var f=document.getElementById('compactFiltersRow');if(f){f.click();if(f.getAttribute('aria-expanded')!=='true')f.click();}else if(typeof toggleMobileFilters==='function')toggleMobileFilters(true);var p=document.getElementById('dealerTechFilters');if(p){p.open=true;var focus=p.querySelector('select,input,summary');if(focus)focus.focus({preventScroll:true});p.scrollIntoView();return true;}";break;
     case SELLER:action="if(window.ZZWS_STOREFRONT)ZZWS_STOREFRONT.navigate('catalog');var p=document.getElementById('storefrontTools')||document.getElementById('dealerAdvancedTools');if(p){p.open=true;p.scrollIntoView();return true;}";break;
     default:break;
    }
    if(!action.isEmpty())view.evaluateJavascript("(function(){var n=0;function open(){if(typeof catalogLoaded!=='undefined'&&catalogLoaded){"+action+"}if(n++<40)setTimeout(open,250);}open();})()",null);
   }
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(!destroyed&&!leaving&&request.isForMainFrame()){progress.setVisibility(View.GONE);status.setVisibility(View.VISIBLE);status.setText(L10n.t("Կապն ընդհատվել է։ Կրկին բացեք գործիքը։"));}}
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
    if(web==view){web=null;ready=false;releaseBrowser(view);if(!destroyed&&!leaving){Toast.makeText(PartnerWebActivity.this,L10n.t("Կապն ընդհատվել է։ Կրկին բացեք գործիքը։"),Toast.LENGTH_LONG).show();returnToParent();}}
    return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(destroyed||leaving||!PartnerPolicyKt.trustedPartnerPage(view.getUrl()))return false;
    if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
    try{startActivityForResult(intent,21);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;
   }
   @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
  });
  web.setDownloadListener((url,agent,disposition,mime,length)->download(url,disposition,mime));
  authenticateAndLoad();
 }
 protected WebView createWebView(){return new WebView(this);}
 protected void authenticateAndLoad(){
  submitIo(()->{try{
   if(AppSession.api.sessionToken().isEmpty()&&!AppSession.restore())throw new Exception();
   JSONObject user=AppSession.api.call("GET","me",null);
   if(!PartnerPolicyKt.canOpenFeature(feature,user))throw new Exception();
   AppSession.user=user;token=AppSession.api.sessionToken();if(!token.matches("[a-f0-9]{64}"))throw new Exception();
   final String html="<!doctype html><meta charset=utf-8><script>sessionStorage.clear();sessionStorage.setItem('zzws_session_v3',"+JSONObject.quote(token)+");localStorage.setItem('zzws_language_v1',"+JSONObject.quote(L10n.language())+");location.replace("+JSONObject.quote(SITE+feature.getPath())+");</script>";
   main.post(()->{if(!destroyed&&!leaving&&web!=null)web.loadDataWithBaseURL(SITE,html,"text/html","UTF-8",null);});
  }catch(Exception e){main.post(()->{if(!destroyed&&!leaving){progress.setVisibility(View.GONE);status.setText(L10n.t("Մուտք գործեք ձեր հաշիվ և կրկին բացեք գործիքը։"));}});}});
 }
 private void submitIo(Runnable work){if(destroyed||leaving||io.isShutdown())return;try{io.execute(work);}catch(java.util.concurrent.RejectedExecutionException ignored){/* The tool was closed while a callback was queued. */}}
 private void injectNavigation(WebView view){try(InputStream in=getAssets().open("partner-navigation.js")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);view.evaluateJavascript(out.toString("UTF-8"),null);}catch(IOException ignored){}}
 private void returnToParent(){if(destroyed||leaving)return;leaving=true;backPending=false;finish();}
 private boolean canReturnInsideTool(){
  if(web==null||!web.canGoBack())return false;
  WebBackForwardList history=web.copyBackForwardList();int previous=history.getCurrentIndex()-1;if(previous<0)return false;
  String current=web.getUrl(),target=history.getItemAtIndex(previous).getUrl();
  if(!PartnerPolicyKt.trustedPartnerPage(target))return false;
  // Authentication HTML uses the catalogue origin; it is never a tool destination.
  Uri destination=Uri.parse(target);
  return current!=null&&!Uri.parse(current).getPath().startsWith("/ZZWS/admin/")&&(destination.getQueryParameter("partner")!=null||destination.getPath().startsWith("/ZZWS/admin/"));
 }
 private void navigateBack(){
  if(destroyed||leaving||backPending)return;
  if(web==null||!ready){returnToParent();return;}
  backPending=true;
  try{web.evaluateJavascript("(function(){try{return window.ZZWS_PARTNER_NAV?ZZWS_PARTNER_NAV.back():'browser';}catch(e){return 'blocked';}})()",value->{
   if(destroyed||leaving)return;backPending=false;
   String action="blocked";try{action=String.valueOf(new JSONTokener(value).nextValue());}catch(Exception ignored){}
   if("handled".equals(action))return;
   if("root".equals(action)){returnToParent();return;}
   if("browser".equals(action)){if(canReturnInsideTool())web.goBack();else returnToParent();return;}
   Toast.makeText(this,L10n.t("Գործողությունը չի ավարտվել"),Toast.LENGTH_SHORT).show();
  });}catch(RuntimeException error){backPending=false;returnToParent();}
 }
 private Button button(String title,Runnable action){Button b=new Button(this);b.setText(L10n.t(title));b.setAllCaps(false);b.setTextColor(0xff1d4ed8);b.setTextSize(14);b.setMinWidth(0);b.setMinimumWidth(0);b.setMinHeight(Math.round(44*getResources().getDisplayMetrics().density));b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffeff6ff));b.setOnClickListener(v->action.run());return b;}
 private void applyAdminStyle(WebView view){try(InputStream in=getAssets().open("partner-admin.css")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);String css=out.toString("UTF-8");view.evaluateJavascript("(function(){document.body.classList.add('zzws-partner-admin');var s=document.getElementById('zzwsPartnerStyle');if(!s){s=document.createElement('style');s.id='zzwsPartnerStyle';document.head.appendChild(s);}s.textContent="+JSONObject.quote(css)+";})()",null);}catch(IOException ignored){}}
 private void applyAdminLabels(WebView view){try(InputStream in=getAssets().open("partner-admin.js")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);view.evaluateJavascript(out.toString("UTF-8"),null);}catch(IOException ignored){}}
 private void external(String value){try{URI uri=new URI(value);if(PartnerPolicyKt.viberShareLink(value)){startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(value)).setPackage("com.viber.voip"));}else if("https".equals(uri.getScheme())||"mailto".equals(uri.getScheme())||"tel".equals(uri.getScheme()))startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(value)));}catch(Exception ignored){Toast.makeText(this,L10n.t("Չհաջողվեց բացել հավելվածը"),Toast.LENGTH_LONG).show();}}
 private void print(){if(destroyed||leaving||web==null||!ready||!PartnerPolicyKt.trustedPartnerPage(web.getUrl()))return;((PrintManager)getSystemService(PRINT_SERVICE)).print("ZZWS",web.createPrintDocumentAdapter("ZZWS"),null);}
 private void download(String url,String disposition,String mime){
  if(destroyed||leaving||web==null||downloadBusy||!PartnerPolicyKt.trustedPartnerPage(web.getUrl()))return;
  if(url.startsWith("blob:https://patverparts-bot.github.io/")){
   downloadUrl=url;downloadMime=mime==null?"application/octet-stream":mime;downloadName=URLUtil.guessFileName("export",disposition,downloadMime);chooseDestination();
  }else if(url.startsWith("https://"))external(url);
 }
 private void chooseDestination(){downloadBusy=true;try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(downloadMime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,downloadName),22);}catch(Exception e){downloadBusy=false;status.setText(L10n.t("Չհաջողվեց բացել ֆայլի պահպանումը"));status.setVisibility(View.VISIBLE);}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
  if(destroyed||leaving)return;
  if(request==21&&chooser!=null){Uri[] uris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){uris=new Uri[data.getClipData().getItemCount()];for(int i=0;i<uris.length;i++)uris[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)uris=new Uri[]{data.getData()};}chooser.onReceiveValue(uris);chooser=null;}
  if(request==22){if(result==RESULT_OK&&data!=null&&data.getData()!=null)saveBlob(data.getData());else downloadBusy=false;}
 }
 private void saveBlob(Uri target){
  if(!PartnerPolicyKt.trustedPartnerPage(web.getUrl()))return;
  final String holder="__zzwsPartnerDownload";
  web.evaluateJavascript("(function(){window."+holder+"={state:'loading'};fetch("+JSONObject.quote(downloadUrl)+").then(r=>r.blob()).then(b=>{if(b.size>20000000)throw Error();var f=new FileReader();f.onload=()=>{window."+holder+"={state:'ready',data:f.result.split(',')[1]};};f.readAsDataURL(b);}).catch(()=>{window."+holder+"={state:'error'};});})()",null);
  pollBlob(target,holder,0);
 }
 private void pollBlob(Uri target,String holder,int attempts){
  if(destroyed||leaving||attempts>120){downloadFailed();return;}
  main.postDelayed(()->{if(destroyed||leaving||web==null)return;web.evaluateJavascript("window."+holder+"?.state||'error'",value->{
   if(destroyed||leaving||web==null)return;
   if("\"loading\"".equals(value)){pollBlob(target,holder,attempts+1);return;}
   if(!"\"ready\"".equals(value)){downloadFailed();return;}
   try{OutputStream output=getContentResolver().openOutputStream(target,"wt");if(output==null)throw new IOException();activeOutput=output;copyBlob(output,holder,0);}catch(Exception e){downloadFailed();}
  });},100);
 }
 private void copyBlob(OutputStream output,String holder,int offset){
  if(destroyed||leaving||web==null||!PartnerPolicyKt.trustedPartnerPage(web.getUrl())){try{output.close();}catch(Exception ignored){}return;}
  web.evaluateJavascript("window."+holder+".data.slice("+offset+","+(offset+32768)+")",value->{if(destroyed||leaving||web==null)return;try{
   String part=(String)new JSONTokener(value).nextValue();if(part.isEmpty()){output.close();activeOutput=null;downloadBusy=false;web.evaluateJavascript("delete window."+holder,null);Toast.makeText(this,L10n.t("Ֆայլը պահպանված է"),Toast.LENGTH_SHORT).show();return;}
   submitIo(()->{try{output.write(android.util.Base64.decode(part,android.util.Base64.DEFAULT));main.post(()->copyBlob(output,holder,offset+part.length()));}catch(Exception e){try{output.close();}catch(Exception ignored){}main.post(this::downloadFailed);}});
  }catch(Exception e){try{output.close();}catch(Exception ignored){}downloadFailed();}});
 }
 private void downloadFailed(){downloadBusy=false;activeOutput=null;if(!destroyed)Toast.makeText(this,L10n.t("Չհաջողվեց պահպանել ֆայլը։ Կրկին փորձեք։"),Toast.LENGTH_LONG).show();}
 @Override protected void onDestroy(){
  destroyed=true;leaving=true;token="";main.removeCallbacksAndMessages(null);
  if(activeOutput!=null)try{activeOutput.close();}catch(Exception ignored){}activeOutput=null;
  if(chooser!=null){ValueCallback<Uri[]> pending=chooser;chooser=null;pending.onReceiveValue(null);}
  WebView disposed=web;web=null;releaseBrowser(disposed);
  io.shutdownNow();super.onDestroy();
 }
 private void releaseBrowser(WebView disposed){
  if(disposed!=null){
   // WebView.destroy requires detaching first. Never start another page during teardown.
   if(disposed.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)disposed.getParent()).removeView(disposed);
   disposed.setDownloadListener(null);disposed.setWebChromeClient(null);disposed.setWebViewClient(new WebViewClient());disposed.stopLoading();disposed.removeAllViews();disposed.destroy();
  }
 }
}
