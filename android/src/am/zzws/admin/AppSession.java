package am.zzws.admin;
import org.json.JSONObject;
/** One session shared by native modes; only the opaque token is encrypted on disk. */
final class AppSession {
 static final ApiClient api=new ApiClient();
 static volatile JSONObject user;
 private static SecureSessionStore store;
 static void initialize(android.content.Context context){if(store==null)store=new SecureSessionStore(context);BrowserUpdates.initialize(context);}
 static boolean restore() throws Exception {api.configure(EndpointConfiguration.API,EndpointConfiguration.PUBLIC_KEY);String token=store==null?"":store.read(EndpointConfiguration.API);if(token.isEmpty())return false;api.restoreToken(token);return true;}
 static void remember() throws Exception {if(store!=null)store.save(EndpointConfiguration.API,api.sessionToken());}
 static boolean authenticated(){return user!=null;}
 static boolean canAdmin(){JSONObject u=user;return u!=null&&"admin".equals(u.optString("role"))&&u.optBoolean("mobileAdminEnabled")&&u.optJSONArray("permissions")!=null;}
 static void clear(){user=null;api.clear();if(store!=null)store.clear();VersionReminder.reset();}
}
