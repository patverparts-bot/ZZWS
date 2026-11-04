package am.zzws.admin;
import android.content.Context;
/** Offline builds contain no Firebase dependency. Configured builds provide FirebaseAdapter. */
final class PushHooks {
 static void attach(Context context,ApiClient api){invoke("attach",context,api);}
 static void detach(Context context,ApiClient api){invoke("detach",context,api);}
 static void revoke(Context context,ApiClient api){invoke("revoke",context,api);}
 private static void invoke(String method,Context context,ApiClient api){try{Class.forName("am.zzws.admin.FirebaseAdapter").getDeclaredMethod(method,Context.class,ApiClient.class).invoke(null,context,api);}catch(ReflectiveOperationException ignored){}}
}
