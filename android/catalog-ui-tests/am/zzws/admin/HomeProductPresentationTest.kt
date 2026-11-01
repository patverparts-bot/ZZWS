package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
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

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class HomeProductPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private lateinit var model:UnifiedModel
 private fun row(code:String,category:String,available:Boolean)=JSONObject().put("articul",code).put("name","Fixture "+code).put("brand","").put("category",category).put("wholesale",10).put("retail",20).put("isWholesalePromo",true).put("stockAvailable",available).put("stockStatus",if(available)"Առկա է"else"Ճշտել")
 @Before fun setup(){
  val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")
  val backend=TrialDemoBackend(sample=listOf(row("available","Ներկառուցվող վառարաններ",true),row("check","Միկրոալիքային վառարաններ",false)),published=listOf("available","check"))
  ui.runOnUiThread{model=UnifiedModel(backend,restoreSavedSession={false})};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo()}
  ui.setContent{RetailTheme{RetailHome(model,{},{},{},{})}}
 }
 @Test fun specialOfferCardsShowTheirOwnStockStatus(){
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("retail-product:available"))
  ui.onNodeWithTag("retail-stock:available",useUnmergedTree=true).assertTextEquals("Առկա է")
  ui.onNodeWithTag("retail-stock:check",useUnmergedTree=true).assertTextEquals("Ճշտել")
 }
 @Test fun theHomeOvenCategoryOpensOnlyItsAccessibleBuiltInOvens(){
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasText("Ջեռոցներ"))
  ui.onNodeWithText("Ջեռոցներ").performClick()
  ui.runOnIdle{assertEquals("catalog",model.screen);assertEquals(listOf("Ներկառուցվող վառարաններ"),model.categories.toList());assertEquals(listOf("available"),model.filtered.map{it.code})}
 }
}
