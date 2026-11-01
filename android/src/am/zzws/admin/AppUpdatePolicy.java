package am.zzws.admin;
import org.json.JSONObject;

/** Pure policy: compare Android versionCode, never version-name text. */
final class AppUpdatePolicy {
 static final long CHECK_INTERVAL=5*60*1000L;
 static final class Release {
  final long code,bytes;final String version,description,sha256;
  Release(long code,String version,String description,String sha256,long bytes){this.code=code;this.version=version;this.description=description;this.sha256=sha256;this.bytes=bytes;}
  JSONObject json() throws Exception{return new JSONObject().put("schemaVersion",1).put("package","am.zzws.admin").put("versionCode",code).put("version",version).put("description",description).put("sha256",sha256).put("bytes",bytes).put("filename","ZZWS-"+version+"-production.apk");}
 }
 static Release newer(JSONObject r,long installed){
  if(r==null||r.optInt("schemaVersion")!=1||!"am.zzws.admin".equals(r.optString("package"))||!(r.opt("versionCode") instanceof Number))return null;
  long code=r.optLong("versionCode");String version=r.optString("version"),description=r.optString("description",""),sha=r.optString("sha256");
  if(code<=installed||code>2147483647L||r.optDouble("versionCode")!=code||!version.matches("[0-9][A-Za-z0-9.+_-]{0,79}")||!sha.matches("[a-f0-9]{64}")||description.length()>4000||!(r.opt("bytes") instanceof Number)||r.optDouble("bytes")!=r.optLong("bytes")||r.optLong("bytes")<22||r.optLong("bytes")>50_000_000||!("ZZWS-"+version+"-production.apk").equals(r.optString("filename")))return null;
  return new Release(code,version,description,sha,r.optLong("bytes"));
 }
 static boolean due(long elapsed,long last){return last<0||elapsed<last||elapsed-last>=CHECK_INTERVAL;}
 static boolean shouldRemind(long code,long lastCode,long now,long lastShown){return code!=lastCode||lastShown<0||now<lastShown||now-lastShown>=24*60*60*1000L;}
}
