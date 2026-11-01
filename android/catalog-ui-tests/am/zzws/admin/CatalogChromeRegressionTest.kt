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
class CatalogChromeRegressionTest {
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
 @Test fun productListHasNoPinnedBrandHeaderOrSearchField(){
  show()
  ui.onNodeWithTag("retail-main-header").assertDoesNotExist()
  ui.onNodeWithTag("catalog-search-input").assertDoesNotExist()
  ui.onNodeWithTag("catalog-search-button").assertIsDisplayed().assertHasClickAction()
  val grid=ui.onNodeWithTag("catalog-products-grid").getUnclippedBoundsInRoot()
  val bar=ui.onNodeWithTag("catalog-bottom-bar").getUnclippedBoundsInRoot()
  assertTrue("Product grid starts directly below the system status area",grid.top<=32.dp)
  assertTrue("Bottom controls do not overlay product cards",grid.bottom<=bar.top)
  assertTrue("Most of the viewport belongs to the products",grid.bottom-grid.top>=600.dp)
 }
 @Test fun scrollingRemovesTheEntireContextHeaderAndKeepsSearchAtBottom(){
  show();ui.onNodeWithTag("catalog-scroll-header").assertIsDisplayed()
  ui.onNodeWithTag("catalog-products-grid").performScrollToIndex(8)
  ui.onNodeWithTag("catalog-scroll-header").assertIsNotDisplayed()
  ui.onNodeWithTag("catalog-search-button").assertIsDisplayed()
  ui.onNodeWithTag("catalog-search-input").assertDoesNotExist()
 }
 @Test fun searchOpensOnlyOnTapAndAppliesTheCompleteQuery(){
  show();ui.onNodeWithTag("catalog-search-button").performClick()
  ui.onNodeWithTag("catalog-search-input").assertIsDisplayed().performTextReplacement("510078")
  ui.onNodeWithTag("catalog-search-submit").performClick()
  ui.onNodeWithTag("catalog-search-sheet").assertDoesNotExist()
  ui.runOnIdle{assertEquals("510078",model.query);assertEquals("catalog",model.screen);assertFalse(model.catalogSections)}
 }
 @Test fun closingSearchDoesNotChangeTheCatalogue(){
  show();ui.onNodeWithTag("catalog-search-button").performClick()
  ui.onNodeWithTag("catalog-search-input").performTextReplacement("discard this")
  ui.onNodeWithTag("catalog-search-close").performClick()
  ui.onNodeWithTag("catalog-search-sheet").assertDoesNotExist()
  ui.runOnIdle{assertEquals("",model.query)}
 }
 @Test fun homeRetainsBrandingBrandsAndOffers(){
  show(catalog=false)
  ui.onNodeWithTag("retail-main-header").assertIsDisplayed()
  ui.onNodeWithTag("catalog-bottom-bar").assertDoesNotExist()
  ui.onNodeWithText("APPLE").assertExists()
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasText("Հատուկ առաջարկներ"))
  ui.onNodeWithText("Հատուկ առաջարկներ").assertIsDisplayed()
 }
 private fun assertOffersOnly(){
  ui.runOnIdle{
   assertEquals("catalog",model.screen);assertTrue(model.onlyPromo);assertFalse(model.catalogSections)
   assertTrue(model.query.isEmpty());assertTrue(model.brands.isEmpty());assertTrue(model.categories.isEmpty());assertFalse(model.onlyAvailable)
   assertTrue(model.specialOffers.isNotEmpty());assertTrue(model.products.size>model.specialOffers.size)
   assertEquals(model.specialOffers.map{it.code}.toSet(),model.filtered.map{it.code}.toSet())
  }
  ui.onNodeWithText(L10n.t("Հատուկ առաջարկներ")).assertIsDisplayed()
 }
 @Test fun bannerAndItsPhotoOpenTheSameNamedOffersCollection(){
  show(catalog=false)
  for(target in listOf("home-collection-banner","home-collection-photo")){
   ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("home-collection-banner"))
   ui.onNodeWithTag(target,useUnmergedTree=true).performTouchInput{click()}
   assertOffersOnly()
   ui.runOnIdle{model.screen="home"}
  }
 }
 @Test fun offersShortcutClearsUnrelatedFiltersAndAllProductsExplicitlyLeavesOffers(){
  show(catalog=false)
  ui.runOnIdle{model.query="unrelated search";model.brands.add("missing brand");model.categories.add("missing category");model.onlyAvailable=true}
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("home-offers-shortcut"))
  ui.onNodeWithTag("home-offers-shortcut").performClick();assertOffersOnly()
  ui.onNodeWithText("Բոլոր ապրանքները").performClick()
  ui.runOnIdle{assertFalse(model.onlyPromo);assertEquals(model.products.size,model.filtered.size)}
 }
 @Test fun offersSectionAllOpensTheCompleteOfferSet(){
  show(catalog=false)
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("home-offers-heading"))
  ui.onNode(hasText("Բոլորը") and hasAnyAncestor(hasTestTag("home-offers-heading")),useUnmergedTree=true).performClick()
  assertOffersOnly()
 }
 @Test fun anOfferCardOpensItsOwnProduct(){
  show(catalog=false)
  val code=model.specialOffers.first().code
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("retail-product:$code"))
  ui.onNodeWithTag("retail-product:$code").performClick()
  ui.onNodeWithTag("retail-product-details:$code").assertExists()
 }
 @Test @Config(qualifiers="w320dp-h740dp") fun narrowBannerKeepsItsCallToActionVisibleInBothLanguages(){
  show(catalog=false)
  for(language in listOf("hy","ru")){
   ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language)}
   ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("home-collection-banner"))
   val banner=ui.onNodeWithTag("home-collection-banner").getUnclippedBoundsInRoot()
   val action=ui.onNodeWithTag("home-collection-action",useUnmergedTree=true).assertIsDisplayed().getUnclippedBoundsInRoot()
   assertTrue("The action has enough height for readable text",action.bottom-action.top>=28.dp)
   assertTrue("The action stays inside the banner",action.top>=banner.top&&action.bottom<=banner.bottom)
   ui.onNodeWithTag("home-collection-action",useUnmergedTree=true).performTouchInput{click()};assertOffersOnly()
   ui.runOnIdle{model.screen="home"}
  }
 }
 @Test fun offersAppearAndDisappearWithTheCatalogWithoutOrdinaryProductFallback(){
  val sample=mutableListOf(JSONObject().put("articul","ordinary").put("name","Ordinary product").put("wholesale",100).put("retail",150))
  ui.runOnUiThread{model=UnifiedModel(TrialDemoBackend(sample))}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.runOnUiThread{model.enterDemo()};show(catalog=false)
  fun assertAbsent(){
   ui.runOnIdle{assertTrue(model.specialOffers.isEmpty())}
   ui.onNodeWithTag("home-collection-banner").assertDoesNotExist()
   ui.onNodeWithTag("home-offers-shortcut").assertDoesNotExist()
   ui.onNodeWithTag("home-offers-heading").assertDoesNotExist()
  }
  assertAbsent()
  sample.add(JSONObject().put("articul","offer").put("name","Actual offer").put("wholesale",90).put("retail",150).put("isWholesalePromo",true))
  ui.runOnUiThread{model.refresh()}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  ui.onNodeWithTag("home-collection-banner").assertExists()
  ui.onNodeWithTag("home-offers-shortcut").assertExists()
  ui.onNodeWithTag("home-offers-shortcut").performClick()
  ui.runOnIdle{assertEquals(listOf("offer"),model.filtered.map{it.code});model.screen="home"}
  sample.removeAt(1)
  ui.runOnUiThread{model.refresh()}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}
  assertAbsent()
  ui.runOnIdle{assertEquals(listOf("ordinary"),model.products.map{it.code})}
 }
 @Test @Config(qualifiers="w320dp-h740dp") fun bottomSearchAndCartRemainUsableOnANarrowPhone(){
  show();ui.onNodeWithTag("catalog-search-button").assertIsDisplayed().assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
  ui.onNodeWithText("Զամբյուղ").assertIsDisplayed()
  ui.onNodeWithTag("catalog-search-button").performClick();ui.onNodeWithTag("catalog-search-input").assertIsDisplayed()
 }
}
