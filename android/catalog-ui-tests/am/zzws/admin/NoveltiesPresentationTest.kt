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
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class NoveltiesPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private lateinit var model:UnifiedModel
 private lateinit var sample:MutableList<JSONObject>
 private fun row(code:String,fresh:Boolean=false,stock:Boolean=true,until:String="2035-01-01T00:00:00Z",promo:Boolean=false)=JSONObject().put("articul",code).put("name",code).put("brand","Fixture").put("category","Սառնարաններ").put("wholesale",100).put("stockAvailable",stock).put("stockStatus",if(stock)"Առկա է"else"Ճշտել").put("isNew",fresh).put("newUntil",until).put("isWholesalePromo",promo)
 @Before fun setup(){
  val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.clear();AppLanguage.initialize(c);AppLanguage.select(c,"hy")
  sample=mutableListOf(row("00001",fresh=true),row("ordinary"),row("offer",promo=true),row("unavailable",fresh=true,stock=false),row("expired",fresh=true,until="2020-01-01T00:00:00Z"))
  ui.runOnUiThread{model=UnifiedModel(TrialDemoBackend(sample),restoreSavedSession={false})};ready();ui.runOnUiThread{model.enterDemo()}
  ui.setContent{RetailTheme{if(model.screen=="home")RetailHome(model,{},{},{},{})else RetailCatalog(model,{},{})}}
 }
 private fun ready(){ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy}}
 private fun open(){ui.onNodeWithTag("home-novelties-shortcut").performClick();ui.runOnIdle{assertEquals("catalog",model.screen);assertTrue(model.noveltyCollection);assertFalse(model.offerCollection);assertFalse(model.catalogSections)}}
 @Test fun theMarkedShortcutOpensWebNoveltiesAndLeavesTheOfferBannerAvailable(){
  ui.onNodeWithTag("home-offers-shortcut").assertDoesNotExist();ui.onNodeWithTag("home-collection-banner").assertExists();ui.onNodeWithText("Նորույթներ").assertIsDisplayed()
  ui.runOnIdle{model.query="irrelevant";model.brands.add("missing");model.onlyPromo=true};open()
  ui.runOnIdle{assertTrue(model.query.isBlank());assertTrue(model.brands.isEmpty());assertFalse(model.onlyPromo);assertEquals(listOf("00001"),model.filtered.map{it.code})}
  ui.onNodeWithText("Նորույթներ").assertIsDisplayed();ui.onNodeWithTag("retail-product:00001").assertExists();ui.onNodeWithTag("retail-product:ordinary").assertDoesNotExist()
 }
 @Test fun russianLabelAndAllProductsNavigationUseTheirOwnCollectionState(){
  ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),"ru")};ui.onNodeWithText("Новинки").assertIsDisplayed();open();ui.onNodeWithText("Новинки").assertIsDisplayed()
  ui.onNodeWithText(L10n.t("Բոլոր ապրանքները")).performClick();ui.runOnIdle{assertFalse(model.noveltyCollection);assertEquals(sample.size,model.filtered.size)}
 }
 @Test fun expiredNoveltiesLeaveAnEmptyNewSectionWithoutFallingBackToOrdinaryGoods(){
  open();ui.runOnIdle{model.refreshNoveltyClock(Instant.parse("2036-01-01T00:00:00Z").toEpochMilli())}
  ui.runOnIdle{assertTrue(model.novelties.isEmpty());assertTrue(model.filtered.isEmpty());assertTrue(model.noveltyCollection)}
  ui.onNodeWithText("Նորույթները կհայտնվեն այստեղ").assertIsDisplayed();ui.onNodeWithTag("retail-product:ordinary").assertDoesNotExist()
 }
 @Test fun catalogRefreshReplacesNoveltiesUsingTheLatestServerFlags(){
  open();sample[0].put("isNew",false);sample.add(row("new-next",fresh=true));ui.runOnUiThread{model.refresh()};ready()
  ui.runOnIdle{assertEquals(listOf("new-next"),model.filtered.map{it.code});assertTrue(model.noveltyCollection)}
  ui.onNodeWithTag("retail-product:new-next").assertExists();ui.onNodeWithTag("retail-product:00001").assertDoesNotExist()
 }
}
