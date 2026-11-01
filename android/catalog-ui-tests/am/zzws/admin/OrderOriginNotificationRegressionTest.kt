package am.zzws.admin
import android.app.NotificationManager
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w360dp-h800dp")
@GraphicsMode(GraphicsMode.Mode.LEGACY)
class OrderOriginNotificationRegressionTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val orderId="12345678-1234-4123-8123-123456789abc"
 private fun order()=JSONObject().put("id",orderId).put("number",18).put("status","new").put("revision",1).put("created","2026-11-01T08:00:00Z").put("total",179600)
  .put("customer",JSONObject().put("client","Order company").put("customerCode","001234").put("author",JSONObject().put("firstName","Karen").put("lastName","Grigoryan").put("phone","+37499123456").put("email","karen@example.am")))
  .put("delivery",JSONObject().put("organization","Branch 2").put("contact","Recipient is another person"))
  .put("lines",JSONArray().put(JSONObject().put("articul","510078").put("name","Bosch BFL524MB2").put("qty",1).put("unitPrice",179600)))
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(c);AppLanguage.select(c,"hy")}
 private fun openFromNotification(admin:Boolean=false):UnifiedModel{
  val backend=TrialDemoBackend(sample=emptyList(),initialOrders=listOf(order()))
  if(admin)backend.user.put("role","admin").put("mobileAdminEnabled",true).put("permissions",JSONArray().put("orders:read"))
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(backend)};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.runOnUiThread{model.enterDemo()};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.setContent{RetailTheme{UnifiedApp(model)}}
  val c=RuntimeEnvironment.getApplication();NotificationBridge.show(c,"ZZWS","New order",1800,"order.created",orderId)
  val notification=shadowOf(c.getSystemService(NotificationManager::class.java)).getNotification(1800)
  val intent=shadowOf(notification.contentIntent).savedIntent;assertEquals(UnifiedActivity::class.java.name,intent.component!!.className)
  ui.runOnUiThread{model.notification(intent.getStringExtra("zzws_kind")!!,intent.getStringExtra("zzws_order")!!)}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy&&model.screen=="order"};ui.waitForIdle();return model
 }
 @Test fun orderOpenedFromPushShowsItsCustomerAndActualAuthorAboveProducts(){
  openFromNotification();ui.onNodeWithTag("order-origin-card").assertIsDisplayed();ui.onNodeWithText("Order company").assertIsDisplayed();ui.onNodeWithText("Ուղարկել է՝ Karen Grigoryan").assertIsDisplayed()
  ui.onNodeWithText("Հաճախորդի կոդ՝ 001234").assertExists();ui.onNodeWithText("Կազմակերպություն՝ Branch 2").assertExists();ui.onNodeWithText("Հեռախոս՝ +37499123456").assertExists()
  val origin=ui.onNodeWithTag("order-origin-card").getUnclippedBoundsInRoot();val product=ui.onNodeWithText("Bosch BFL524MB2").getUnclippedBoundsInRoot();assertTrue(origin.bottom<=product.top)
  ui.runOnUiThread{AppLanguage.select(RuntimeEnvironment.getApplication(),"ru")};ui.onNodeWithText("Отправил: Karen Grigoryan").assertExists();ui.onNodeWithText("Код клиента: 001234").assertExists()
 }
 @Test fun administratorAlsoGetsSenderDetailsWithoutTheCustomerWaitingInstruction(){
  openFromNotification(admin=true);ui.onNodeWithText("Order company").assertIsDisplayed();ui.onNodeWithText("Ուղարկել է՝ Karen Grigoryan").assertIsDisplayed();ui.onNodeWithText("Պատվերը փոխանցված է սերվեր։ Սպասեք պատասխանատուի հաստատմանը։").assertDoesNotExist()
 }
}
