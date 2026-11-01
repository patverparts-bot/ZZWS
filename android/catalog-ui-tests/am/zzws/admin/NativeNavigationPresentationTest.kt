package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h740dp")
class NativeNavigationPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 @After fun cleanup(){AppSession.clear()}
 private fun show(mobileAdmin:Boolean?=null):UnifiedModel{
  val backend=TrialDemoBackend()
  if(mobileAdmin!=null)backend.user.put("role","admin").put("mobileAdminEnabled",mobileAdmin).put("permissions",JSONArray().put("orders:read"))
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(backend,restoreSavedSession={false})};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo();model.showAllProducts()}
  ui.setContent{RetailTheme{UnifiedApp(model)}};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};return model
 }
 @Test fun allSixActionsStayVisibleOnEveryPageAt320InBothLanguages(){
  val model=show()
  for(language in listOf("hy","ru"))for(screen in listOf("home","catalog","favorites","profile","cart")){
   ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language);model.screen=screen}
   for(tag in listOf("navigation-home","navigation-catalog","navigation-orders","catalog-search-button","navigation-cart","navigation-menu"))ui.onNodeWithTag(tag).assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
  }
 }
 @Test fun homeIsOneTapFromCatalogAndFavoritesAndPreservesCartAndAllCheckoutFields(){
  val model=show();ui.runOnIdle{model.cart[model.products.first().code]=2;model.updateDelivery(method="Ինքնաառաքում",address="Private address",contact="Private contact",date="2027-02-03",comment="Private comment")}
  val before=listOf(model.deliveryIndex.toString(),model.method,model.address,model.contact,model.date,model.comment);val cart=model.cart.toMap()
  for(screen in listOf("catalog","favorites")){ui.runOnIdle{model.screen=screen};ui.onNodeWithTag("navigation-home").performClick();ui.runOnIdle{assertEquals("home",model.screen);assertEquals(cart,model.cart.toMap());assertEquals(before,listOf(model.deliveryIndex.toString(),model.method,model.address,model.contact,model.date,model.comment))}}
 }
 @Test fun clientOrdersTapOpensOnlyPersonalHistory(){val model=show();ui.onNodeWithTag("navigation-orders").performClick();ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnIdle{assertEquals("orders",model.screen)};assertNull(shadowOf(ui.activity).nextStartedActivity)}
 private fun checkAdminTarget(mobile:Boolean,profile:Boolean=false){
  val model=show(mobile)
  if(profile)ui.runOnIdle{model.screen="profile"}
  ui.runOnIdle{AppSession.user=model.user;AppSession.api.restoreToken("f".repeat(64));val setter=UnifiedModel::class.java.getDeclaredMethod("setDemo",java.lang.Boolean.TYPE);setter.isAccessible=true;setter.invoke(model,false);assertFalse(model.demo)}
  if(profile)ui.onNodeWithText("Պատվերների կառավարում").performScrollTo().performClick()else ui.onNodeWithTag("navigation-orders").performClick();ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  val intent=shadowOf(ui.activity).nextStartedActivity;assertNotNull("One Orders tap must open the management destination",intent)
  assertEquals(if(mobile)MainActivity::class.java.name else PartnerWebActivity::class.java.name,intent!!.component!!.className)
  if(!mobile)assertEquals(PartnerFeature.ORDERS.name,intent.getStringExtra("feature"))
  assertEquals(if(profile)"profile"else"catalog",model.screen)
 }
 @Test fun mobileReadOnlyAdminOpensNativeManagementInOneTap(){checkAdminTarget(true)}
 @Test fun webOnlyOrdersAdminOpensTheManagerTabInOneTap(){checkAdminTarget(false)}
 @Test fun profileDoesNotSendMobileAdminsToThePersonalEndpoint(){checkAdminTarget(true,profile=true)}
 @Test fun profileDoesNotSendWebOnlyAdminsToThePersonalEndpoint(){checkAdminTarget(false,profile=true)}
 @Test fun menuKeepsFiltersComparisonAndAccountActionsAvailable(){show();ui.onNodeWithTag("navigation-menu").performClick();ui.onNodeWithTag("menu-filters").assertIsDisplayed().assertHasClickAction();ui.onNodeWithTag("menu-compare").assertIsDisplayed().assertHasClickAction();ui.onNodeWithText("Կատալոգ և գնումներ").assertExists();ui.onNodeWithTag("menu-admin-orders").assertDoesNotExist()}
}
