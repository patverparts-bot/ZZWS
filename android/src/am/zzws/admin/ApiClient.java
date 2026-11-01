package am.zzws.admin;

import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** The only transport: shared ZZWS API. Persistence is handled by SecureSessionStore. */
final class ApiClient {
 private String base="",key="";private volatile String token="";
 static final String PROD="xufxevjdfukglplsknrp.supabase.co";
 static void validate(String value,String key) throws Exception {validate(value,key,EndpointConfiguration.RELEASE?EndpointConfiguration.API:"");}
 static void validate(String value,String key,String pinnedApi) throws Exception {
  URI u=new URI(value);String h=u.getHost();if(h!=null)h=h.toLowerCase(java.util.Locale.ROOT).replaceAll("\\.$","");boolean local="127.0.0.1".equals(h)||"localhost".equals(h)||"10.0.2.2".equals(h),release=pinnedApi!=null&&!pinnedApi.isEmpty();
  if(h==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!("https".equals(u.getScheme())||!release&&local&&"http".equals(u.getScheme()))||!value.endsWith("/functions/v1/zzws-api/")||release&&!value.equals(pinnedApi)||!release&&PROD.equalsIgnoreCase(h))throw new Exception("Նշեք թույլատրված միասնական API-ի հասցեն։ Փորձնական հավելվածում աշխատանքային նախագիծն արգելափակված է։");
  boolean publicKey=key!=null&&key.matches("sb_publishable_[A-Za-z0-9_-]{20,}");
  if(release&&!publicKey&&key!=null){try{String[] parts=key.split("\\.");publicKey=parts.length==3&&"anon".equals(new JSONObject(new String(java.util.Base64.getUrlDecoder().decode(parts[1]),StandardCharsets.UTF_8)).optString("role"));}catch(Exception ignored){}}
  if(key==null||key.length()<6||key.length()>4096||key.matches("(?s).*[\\x00-\\x20\\x7f].*")||key.startsWith("sb_secret_")||release&&!publicKey||!release&&key.startsWith("eyJ"))throw new Exception("Օգտագործեք միայն հրապարակային բանալին։ Ծառայողական գաղտնի բանալին չի թույլատրվում։");
 }
 void configure(String value,String publicKey) throws Exception {validate(value,publicKey);clear();base=value;key=publicKey;}
 synchronized void clear(){token="";}
 String sessionToken(){return token;}
 synchronized void restoreToken(String value) throws Exception {if(value==null||!value.matches("[a-f0-9]{64}"))throw new Exception("Սխալ աշխատաշրջան");token=value;}
 JSONObject call(String method,String path,JSONObject body) throws Exception {
  return request(method,new URL(base+path),body,true);
 }
 JSONObject apkRelease() throws Exception {return request("GET",new URL(new URL(base),"../zzws-apk/current"),null,false);}
 JSONObject apkDownloadLink(long versionCode) throws Exception {
  if(versionCode<1||versionCode>2147483647L)throw new Exception("Սխալ APK տարբերակ");
  return request("GET",new URL(new URL(base),"../zzws-apk/download-link?versionCode="+versionCode),null,false);
 }
 JSONObject apkDownloadComplete(String downloadId,String sha256,long bytes) throws Exception {return request("POST",new URL(new URL(base),"../zzws-apk/download-complete"),new JSONObject().put("downloadId",downloadId).put("sha256",sha256).put("bytes",bytes),false);}
 private JSONObject request(String method,URL url,JSONObject body,boolean sessionResponse) throws Exception {
  final String sentToken=token;
  HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setInstanceFollowRedirects(false);c.setRequestMethod(method);c.setConnectTimeout(10000);c.setReadTimeout(15000);c.setUseCaches(false);c.setRequestProperty("apikey",key);c.setRequestProperty("Accept","application/json");c.setRequestProperty("X-ZZWS-Client","android");if(EndpointConfiguration.RELEASE){c.setRequestProperty("X-ZZWS-App-Version",BuildConfig.VERSION_NAME);c.setRequestProperty("X-ZZWS-App-Code",String.valueOf(BuildConfig.VERSION_CODE));}
  if(!sentToken.isEmpty())c.setRequestProperty("Authorization","Bearer "+sentToken);
  try {
   if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
   int status=c.getResponseCode();InputStream stream=status>=200&&status<300?c.getInputStream():c.getErrorStream();
   String text="";if(stream!=null){try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>16_000_000)throw new IOException("Response too large");out.write(b,0,n);}text=out.toString("UTF-8");}}
   JSONObject data;try{data=new JSONObject(text);}catch(JSONException e){throw new Exception("Սերվերը վերադարձրել է սխալ պատասխան։ Տվյալներն ինքնաշխատ չեն փոփոխվել։");}
   synchronized(this){
    if(!token.equals(sentToken))throw new ApiError(409,"Աշխատաշրջանը փոխվել է։ Կրկին փորձեք։");
    if(status==401)clear();if(status<200||status>=300)throw new ApiError(status,data.optString("error",data.optBoolean("conflict")?"Զամբյուղը փոխվել է այլ սարքում։ Տեղական տարբերակը պահպանված է։":"Հարցումը մերժվել է սերվերի կողմից"));
    if(data.has("sessionToken")){if(!sessionResponse)throw new Exception("Սխալ APK պատասխան");restoreToken(data.getString("sessionToken"));data.remove("sessionToken");}
   }return data;
  }catch(SocketTimeoutException e){throw new Exception("Սպասման ժամանակն ավարտվել է։ Կրկնելուց առաջ թարմացրեք պատվերը․ սերվերը կարող էր ընդունել հարցումը։");}
  catch(IOException e){throw new Exception("ZZWS սերվերի հետ կապ չկա կամ պատասխանը չափազանց մեծ է։ Ստուգեք կապը և կրկին փորձեք։");}finally{c.disconnect();}
 }
 static class ApiError extends Exception {final int status;ApiError(int status,String msg){super(msg);this.status=status;}}
}
