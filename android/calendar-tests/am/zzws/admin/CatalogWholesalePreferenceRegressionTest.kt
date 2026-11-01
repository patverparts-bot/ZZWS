package am.zzws.admin
import android.os.Looper
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class)
class CatalogWholesalePreferenceRegressionTest {
 private val context get()=RuntimeEnvironment.getApplication()
 private fun account(id:String,role:String="admin")=JSONObject().put("id",id).put("role",role)
 @Before fun setup(){AppContext.value=context;AppSession.initialize(context);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(context);context.getSharedPreferences("zzws_catalog_preferences",0).edit().clear().commit()}
 private fun ready(model:UnifiedModel){val deadline=System.nanoTime()+10_000_000_000L;while(model.busy&&System.nanoTime()<deadline){shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20));Thread.sleep(5)};shadowOf(Looper.getMainLooper()).idle();assertFalse(model.busy)}
 @Test fun preferenceIsOptInPersonalEndpointBoundAndUnavailableToClients(){
  val a=account("admin-a");val b=account("admin-b");val client=account("client-a","client");val api="api-a"
  assertFalse(CatalogWholesalePreference.read(context,api,a));assertTrue(CatalogWholesalePreference.save(context,api,a,true));assertTrue(CatalogWholesalePreference.read(context,api,a))
  assertFalse(CatalogWholesalePreference.read(context,api,b));assertFalse(CatalogWholesalePreference.read(context,"api-b",a));assertFalse(CatalogWholesalePreference.save(context,api,client,true));assertFalse(CatalogWholesalePreference.read(context,api,client))
  assertFalse(CatalogWholesalePreference.save(context,api,account("admin-a","client"),false));assertTrue(CatalogWholesalePreference.read(context,api,a));assertFalse(CatalogWholesalePreference.save(context,api,a,false));assertFalse(CatalogWholesalePreference.read(context,api,a))
 }
 @Test fun modelRecreationRestoresAdminPreferenceAndEitherPriceQualifiesInAnyDisplayMode(){
  val products=listOf(JSONObject().put("articul","ws").put("wholesale",12).put("kpPrice",0).put("stockAvailable",true),JSONObject().put("articul","kp-only").put("wholesale",0).put("kpPrice",99).put("stockAvailable",true),JSONObject().put("articul","unpriced").put("wholesale",0).put("kpPrice",0).put("stockAvailable",true),JSONObject().put("articul","kp-promo-only").put("wholesale",0).put("kpPrice",56).put("kpIsPromo",true).put("stockAvailable",true))
  fun model(id:String,role:String="admin"):UnifiedModel{val backend=TrialDemoBackend(sample=products);backend.user.put("id",id).put("role",role);val m=UnifiedModel(backend);ready(m);m.enterDemo();m.showAllProducts();return m}
  val first=model("native-admin-a");assertFalse(first.onlyWholesale);first.changeOnlyWholesale(true);first.changePriceMode("KP");assertEquals(setOf("ws","kp-only","kp-promo-only"),first.filtered.map{it.code}.toSet());first.changePriceMode("WS");assertEquals(setOf("ws","kp-only","kp-promo-only"),first.filtered.map{it.code}.toSet());first.logout();ready(first)
  val recreated=model("native-admin-a");assertTrue(recreated.onlyWholesale);assertEquals(setOf("ws","kp-only","kp-promo-only"),recreated.filtered.map{it.code}.toSet());recreated.logout();ready(recreated)
  val other=model("native-admin-b");assertFalse(other.onlyWholesale);assertEquals(4,other.filtered.size);other.logout();ready(other)
  val client=model("native-client","client");client.changeOnlyWholesale(true);assertFalse(client.onlyWholesale);assertEquals(4,client.filtered.size);client.logout();ready(client)
 }
}
