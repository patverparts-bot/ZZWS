package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class OfferProductCarouselTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private fun product(code:String)=Product(JSONObject().put("articul",code).put("name","Published product $code").put("wholesale",10))
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.clear();AppLanguage.initialize(c);AppLanguage.select(c,"hy")}
 @Test fun everyPublishedItemIncludingThoseBeyondSixCanBeSwiped(){
  ui.mainClock.autoAdvance=false
  ui.setContent{RetailTheme{OfferProductCarousel((1..8).map{product("$it")})}}
  for(index in 1..8){
   ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("$index / 8")
   ui.onNodeWithTag("home-collection-item:$index",useUnmergedTree=true).assertIsDisplayed()
   if(index<8){ui.onNodeWithTag("home-collection-pager",useUnmergedTree=true).performTouchInput{swipeLeft()};ui.mainClock.advanceTimeBy(500)}
  }
 }
 @Test fun photosAdvanceAutomaticallyAndWrapBackToThePublishedListStart(){
  ui.mainClock.autoAdvance=false;ui.setContent{RetailTheme{OfferProductCarousel(listOf(product("one"),product("two")))}}
  ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("1 / 2")
  ui.mainClock.advanceTimeBy(4600);ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("2 / 2")
  ui.mainClock.advanceTimeBy(4600);ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("1 / 2")
 }
 @Test fun replacingThePublishedListRemovesOldSlidesAndResetsItsPosition(){
  ui.mainClock.autoAdvance=false;var products by mutableStateOf(listOf(product("old-a"),product("old-b")))
  ui.setContent{RetailTheme{OfferProductCarousel(products)}}
  ui.onNodeWithTag("home-collection-pager",useUnmergedTree=true).performTouchInput{swipeLeft()};ui.mainClock.advanceTimeBy(500)
  ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("2 / 2")
  ui.runOnUiThread{products=listOf(product("new"))};ui.mainClock.advanceTimeBy(32)
  ui.onNodeWithTag("home-collection-item:new",useUnmergedTree=true).assertIsDisplayed()
  ui.onNodeWithTag("home-collection-item:old-b",useUnmergedTree=true).assertDoesNotExist();ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertDoesNotExist()
  ui.runOnUiThread{products=emptyList()};ui.mainClock.advanceTimeBy(32);ui.onNodeWithTag("home-collection-pager",useUnmergedTree=true).assertDoesNotExist()
 }
 @Test fun bannerFollowsTheLiveCollectionAndUsesTheSelectedLanguage(){
  val sample=(1..8).map{product("$it").data}+product("ordinary").data
  val published=mutableListOf("1","2","3","4","5","6","7","8","not-in-this-account")
  lateinit var model:UnifiedModel
  ui.runOnUiThread{model=UnifiedModel(TrialDemoBackend(sample,published),restoreSavedSession={false})};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo()}
  ui.setContent{RetailTheme{RetailHome(model,{},{},{},{})}}
  ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("1 / 8")
  ui.onNodeWithTag("home-collection-label",useUnmergedTree=true).assertTextEquals("Հատուկ առաջարկներ")
  ui.runOnUiThread{AppLanguage.select(RuntimeEnvironment.getApplication(),"ru")}
  ui.onNodeWithTag("home-collection-label",useUnmergedTree=true).assertTextEquals("Специальные предложения")
  ui.onNodeWithText("ZZWS COLLECTION").assertDoesNotExist()
  published.clear();published.addAll(listOf("8","7"));ui.runOnUiThread{model.refresh()};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.onNodeWithTag("home-collection-position",useUnmergedTree=true).assertTextEquals("1 / 2")
  ui.onNodeWithTag("home-collection-item:8",useUnmergedTree=true).assertIsDisplayed()
  ui.onNodeWithTag("home-collection-item:ordinary",useUnmergedTree=true).assertDoesNotExist()
  ui.onNodeWithTag("home-collection-photo",useUnmergedTree=true).performTouchInput{click()}
  ui.runOnIdle{assertEquals("catalog",model.screen);assertTrue(model.offerCollection);assertEquals(setOf("8","7"),model.filtered.map{it.code}.toSet())}
 }
}
