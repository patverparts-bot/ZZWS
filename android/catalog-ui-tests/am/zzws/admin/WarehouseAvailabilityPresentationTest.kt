package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
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

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h740dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WarehouseAvailabilityPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val stock="025:1,026:47,035:1,003:0,050:27,023:18,031:3,099:0007"
 private fun product(value:String)=Product(JSONObject().put("articul","stock-fixture").put("stockStatus",value).put("stockAvailable",true).put("stocks",JSONObject().put("hidden",999)))
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 @Test fun allWarehouseCountsWrapInsideANarrowProductColumnWithoutEllipsisOrOverflow(){
  ui.setContent{RetailTheme{Surface(Modifier.width(136.dp)){WarehouseAvailability(product(stock),Modifier.testTag("warehouse-list"))}}}
  val parent=ui.onNodeWithTag("warehouse-list").getUnclippedBoundsInRoot();val tops=mutableSetOf<Float>()
  for(row in warehouseCounts(stock)!!){
   val node=ui.onNodeWithText(row.code+": "+row.quantity,useUnmergedTree=true).assertIsDisplayed();val bounds=node.getUnclippedBoundsInRoot();tops.add(bounds.top.value)
   assertTrue(bounds.left>=parent.left&&bounds.right<=parent.right&&bounds.top>=parent.top&&bounds.bottom<=parent.bottom)
   val layouts=mutableListOf<TextLayoutResult>();node.performSemanticsAction(SemanticsActions.GetTextLayoutResult){it(layouts)};val layout=layouts.single()
   // FlowRow can reuse a wider paragraph allocation (126px) for a35px Text.
   // Check every actual line/character, rather than that blank cached width.
   assertFalse("No warehouse line may be cut vertically",layout.didOverflowHeight)
   assertEquals(layout.layoutInput.text.length,layout.getLineEnd(layout.lineCount-1,visibleEnd=true))
   for(line in 0 until layout.lineCount){assertFalse(layout.isLineEllipsized(line));assertTrue(layout.getLineLeft(line)>=0f);assertTrue("${row.code} drawn line exceeds Text bounds",layout.getLineRight(line)<=layout.size.width.toFloat());assertTrue(layout.getLineBottom(line)<=layout.size.height.toFloat())}
   for(index in layout.layoutInput.text.indices)if(!layout.layoutInput.text[index].isWhitespace()){val glyph=layout.getBoundingBox(index);assertTrue("${row.code} character $index is clipped",glyph.left>=0f&&glyph.right<=layout.size.width.toFloat()&&glyph.top>=0f&&glyph.bottom<=layout.size.height.toFloat())}
  }
  assertTrue("Warehouse pills must wrap into multiple visible rows",tops.size>1);ui.onNodeWithText("hidden: 999").assertDoesNotExist();ui.onNodeWithText("…").assertDoesNotExist()
 }
 @Test fun genericStatusStaysFullWrappingLocalizedTextInBothLanguages(){
  val text="Պատվերով՝ առաքման ժամկետը ճշտեք պատասխանատուի հետ"
  ui.setContent{RetailTheme{Column(Modifier.width(136.dp)){WarehouseAvailability(product(text),Modifier.testTag("generic-stock"));WarehouseAvailability(product("Ճշտել"),Modifier.testTag("known-stock"))}}}
  for(language in listOf("hy","ru")){
   ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language)}
   val node=ui.onNodeWithTag("generic-stock").assertTextEquals(L10n.t(text,language)).assertIsDisplayed();val layouts=mutableListOf<TextLayoutResult>();node.performSemanticsAction(SemanticsActions.GetTextLayoutResult){it(layouts)};assertFalse("Generic status must not overflow: ${layouts.single().size}",layouts.single().hasVisualOverflow);assertTrue("Real font layout must wrap the full status",layouts.single().lineCount>1)
   ui.onNodeWithTag("known-stock").assertTextEquals(L10n.t("Ճշտել",language))
  }
 }
 private fun model():UnifiedModel{
  val row=JSONObject().put("articul","stock-fixture").put("name","Warehouse fixture").put("brand","").put("category","Ներկառուցվող վառարաններ").put("wholesale",10).put("retail",20).put("isWholesalePromo",true).put("stockAvailable",true).put("stockStatus",stock)
  val backend=TrialDemoBackend(sample=listOf(row),published=listOf("stock-fixture"));lateinit var model:UnifiedModel
  ui.runOnUiThread{model=UnifiedModel(backend,restoreSavedSession={false})};ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo()};return model
 }
 private fun assertEveryWarehouse(){for(row in warehouseCounts(stock)!!)ui.onNodeWithText(row.code+": "+row.quantity,useUnmergedTree=true).assertIsDisplayed()}
 @Test fun homeOfferAndCatalogAndFavoritesCardsExposeEveryProvidedWarehouse(){
  val model=model();ui.setContent{RetailTheme{when(model.screen){"home"->RetailHome(model,{},{},{},{});else->RetailCatalog(model,{},{},favorites=model.screen=="favorites")}}}
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("retail-product:stock-fixture"));ui.onNodeWithTag("retail-stock:stock-fixture",useUnmergedTree=true).assertExists();assertEveryWarehouse()
  ui.runOnIdle{model.showAllProducts()};ui.onNodeWithTag("catalog-products-grid").performScrollToNode(hasTestTag("retail-product:stock-fixture"));assertEveryWarehouse()
  ui.runOnIdle{PartnerLibrary.accept(setOf("stock-fixture"));model.screen="favorites"};ui.onNodeWithTag("catalog-products-grid").performScrollToNode(hasTestTag("retail-product:stock-fixture"));assertEveryWarehouse()
 }
 @Test fun alternateCatalogAlsoDisplaysEveryWarehouse(){val model=model();ui.runOnIdle{model.showAllProducts()};ui.setContent{RetailTheme{CatalogScreen(model,{},{},{},{})}};for(row in warehouseCounts(stock)!!)ui.onNodeWithText(row.code+": "+row.quantity,useUnmergedTree=true).assertIsDisplayed()}
}
