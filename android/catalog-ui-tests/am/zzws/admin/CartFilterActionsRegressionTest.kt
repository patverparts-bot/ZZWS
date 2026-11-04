package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w360dp-h800dp")
@GraphicsMode(GraphicsMode.Mode.LEGACY)
class CartFilterActionsRegressionTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private lateinit var model:UnifiedModel
 @Before fun model(){
  val context=RuntimeEnvironment.getApplication()
  AppContext.value=context;AppSession.initialize(context);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")
  ui.runOnUiThread{model=UnifiedModel()}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.runOnUiThread{model.enterDemo()}
 }
 private fun show(catalog:Boolean=true){
  ui.runOnUiThread{if(catalog)model.showAllProducts()}
  ui.setContent{RetailTheme{UnifiedApp(model)}}
  ui.waitForIdle()
 }

 @Test fun catalogCornerOpensFiltersAndAdminCanApplyWholesale(){
  ui.runOnIdle{model.user!!.put("role","admin");model.changeOnlyWholesale(false)}
  show();ui.onNodeWithTag("catalog-filters-button").assertIsDisplayed().performClick()
  ui.onNodeWithText("Միայն մեծածախ գին ունեցող ապրանքները").performScrollTo().performClick()
  ui.onNode(hasText("Ցույց տալ՝",substring=true)).performClick()
  ui.runOnIdle{assertTrue(model.onlyWholesale);assertTrue(model.filtered.all{it.price>0||it.kp>0})}
 }
 @Test fun clientFiltersDoNotOfferAdminWholesaleSwitch(){
  show();ui.onNodeWithTag("catalog-filters-button").performClick()
  ui.onNodeWithText("Միայն մեծածախ գին ունեցող ապրանքները").assertDoesNotExist()
 }
 @Test fun cartClearRequiresConfirmationAndPreservesBuyerDraft(){
  ui.runOnIdle{model.setQty(model.products.first().code,2);model.updateDelivery(comment="Keep buyer draft");model.screen="cart"}
  show(catalog=false);ui.onNodeWithTag("cart-clear-button").assertIsDisplayed().performClick()
  ui.onNodeWithTag("cart-clear-cancel").performClick();ui.runOnIdle{assertTrue(model.cart.isNotEmpty())}
  ui.onNodeWithTag("cart-clear-button").performClick();ui.onNodeWithTag("cart-clear-confirm").performClick()
  ui.runOnIdle{assertTrue(model.cart.isEmpty());assertEquals(1,model.checkoutStep);assertEquals("Keep buyer draft",model.comment)}
  ui.onNodeWithTag("cart-clear-button").assertDoesNotExist()
 }
 @Test @Config(qualifiers="w320dp-h740dp") fun russianCornerFilterFitsNarrowPhone(){
  ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),"ru")}
  show();ui.onNodeWithTag("catalog-filters-button").assertIsDisplayed();ui.onNodeWithTag("catalog-filters-button").performClick()
  ui.onAllNodesWithText("Фильтры").assertCountEquals(2)
 }
}
