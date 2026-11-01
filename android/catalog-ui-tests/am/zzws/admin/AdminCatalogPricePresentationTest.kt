package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import java.io.File
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

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h740dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AdminCatalogPricePresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val code="price-fixture"
 private val vertical=SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)
 private fun row(code:String=this.code)=JSONObject().put("articul",code).put("name","Price presentation fixture").put("brand","").put("category","Ներկառուցվող վառարաններ").put("wholesale",1234567.25).put("kpPrice",7654321.50).put("kpIsPromo",true).put("retail",9999999).put("stockAvailable",true).put("stockStatus","025:1,026:47,035:1")
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 private fun ready(model:UnifiedModel){ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy}}
 private fun model(role:String="admin"):UnifiedModel{
  val rows=listOf(row(),row("price-two"),row("price-three"));val backend=TrialDemoBackend(sample=rows,published=listOf(code));backend.user.put("role",role).put("mobileAdminEnabled",false)
  val directory=File(RuntimeEnvironment.getApplication().cacheDir,"technical");directory.mkdirs()
  for(product in rows){val specs=JSONArray().put(JSONArray().put("Fixture").put("Offline value"));File(directory,technicalFile(product.text("articul"))).writeText(JSONObject().put("schemaVersion",1).put("products",JSONObject().put(product.text("articul"),JSONArray().put(product.text("name")).put("https://www.zigzag.am/fixture.html").put("2026-11-01").put(specs))).toString())}
  lateinit var result:UnifiedModel;ui.runOnUiThread{result=UnifiedModel(backend,restoreSavedSession={false})};ready(result);ui.runOnIdle{result.enterDemo()};return result
 }
 private fun readable(tag:String):TextLayoutResult{
  val node=ui.onNodeWithTag(tag,useUnmergedTree=true)
  if(runCatching{node.assertIsDisplayed()}.isFailure)ui.onNode(vertical,useUnmergedTree=true).performScrollToNode(hasTestTag(tag))
  try{node.assertIsDisplayed()}catch(error:AssertionError){throw AssertionError("Price visibility: $tag node=${node.getUnclippedBoundsInRoot()}, viewport=${ui.onNode(vertical,useUnmergedTree=true).getUnclippedBoundsInRoot()}, decor=${ui.activity.window.decorView.width}x${ui.activity.window.decorView.height}",error)}
  val layouts=mutableListOf<TextLayoutResult>();node.performSemanticsAction(SemanticsActions.GetTextLayoutResult){it(layouts)};val layout=layouts.single()
  assertEquals("Every character must be present",layout.layoutInput.text.length,layout.getLineEnd(layout.lineCount-1,visibleEnd=true))
  assertFalse("No vertical clipping in $tag",layout.didOverflowHeight)
  for(line in 0 until layout.lineCount){assertFalse("No ellipsis in $tag",layout.isLineEllipsized(line));assertTrue("Left glyph clipping in $tag",layout.getLineLeft(line)>=-.5f);assertTrue("Right glyph clipping in $tag",layout.getLineRight(line)<=layout.size.width+.5f);assertTrue("Bottom glyph clipping in $tag",layout.getLineBottom(line)<=layout.size.height+.5f)}
  return layout
 }
 private fun pair(scope:String,product:Product){
  ui.onNodeWithTag("admin-retail-$scope:${product.code}:label",useUnmergedTree=true).assertTextEquals(L10n.t("Մանրածախ"))
  ui.onNodeWithTag("admin-retail-$scope:${product.code}:amount",useUnmergedTree=true).assertTextEquals(money(product.retail))
  val base="admin-price-$scope:${product.code}:"
  for((key,label,amount)in listOf(Triple("ws","Մեծածախ",product.price),Triple("kp","Խոշոր գործընկերոջ գին",product.kp))){
   ui.onNodeWithTag(base+key+":label",useUnmergedTree=true).assertTextEquals(L10n.t(label));ui.onNodeWithTag(base+key+":amount",useUnmergedTree=true).assertTextEquals(money(amount))
  }
  ui.onNodeWithTag(base+"kp:promotion",useUnmergedTree=true).assertTextEquals(L10n.t("KP ակցիա"))
  assertTrue("The two labelled prices must occupy different vertical blocks",ui.onNodeWithTag(base+"ws",useUnmergedTree=true).getUnclippedBoundsInRoot().bottom<=ui.onNodeWithTag(base+"kp",useUnmergedTree=true).getUnclippedBoundsInRoot().top)
 }
 @Test fun narrowBlocksRetainFullEqualLabelsAndSevenDigitAmountsAtLargeFontScaleInBothLanguages(){
  val width=mutableStateOf(136.dp);val scale=mutableFloatStateOf(1f);val product=Product(row())
  ui.setContent{RetailTheme{val density=LocalDensity.current;CompositionLocalProvider(LocalDensity provides Density(density.density,scale.floatValue)){Column(Modifier.width(width.value).fillMaxHeight().verticalScroll(rememberScrollState())){AdminCatalogPriceBlocks(product,"admin",false,"fixture")}}}}
  for(language in listOf("hy","ru"))for(fontScale in listOf(1.3f,1.5f))for(size in listOf(136.dp,78.dp)){
   ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language);scale.floatValue=fontScale;width.value=size};pair("fixture",product)
   val base="admin-price-fixture:$code:";val wsLabel=readable(base+"ws:label");val kpLabel=readable(base+"kp:label");val ws=readable(base+"ws:amount");val kp=readable(base+"kp:amount")
   assertEquals(wsLabel.layoutInput.style.fontSize,kpLabel.layoutInput.style.fontSize);assertEquals(ws.layoutInput.style.fontSize,kp.layoutInput.style.fontSize);assertNotEquals(ws.layoutInput.style.color,kp.layoutInput.style.color)
  }
 }
 @Test fun actualHomeCatalogueAndFavoritesShowBothPricesEvenWithoutMobileAdminAndPreserveCartMode(){
  val model=model();assertFalse(model.admin);ui.setContent{RetailTheme{if(model.screen=="home")RetailHome(model,{},{},{},{})else RetailCatalog(model,{},{},favorites=model.screen=="favorites")}}
  ui.onNodeWithTag("retail-home-feed").performScrollToNode(hasTestTag("retail-product:$code"));pair("card",model.products.first());readable("admin-price-card:$code:kp:amount")
  ui.runOnIdle{model.showAllProducts();model.changePriceMode("KP")};ui.onNodeWithTag("catalog-products-grid").performScrollToNode(hasTestTag("retail-product:$code"));pair("card",model.products.first());readable("admin-price-card:$code:ws:amount")
  ui.onNodeWithTag("catalog-products-grid").performScrollToNode(hasTestTag("retail-cart:$code"));ui.onNodeWithTag("retail-cart:$code").performClick();assertEquals(1,model.cart[code]);assertEquals("KP",model.priceMode);assertEquals(7654321.50,model.unit(model.products.first()),0.0)
  ui.runOnIdle{PartnerLibrary.accept(setOf(code));model.screen="favorites"};ui.onNodeWithTag("catalog-products-grid").performScrollToNode(hasTestTag("retail-product:$code"));pair("card",model.products.first());readable("admin-price-card:$code:kp:amount")
 }
 @Test fun detailsAndThreeProductComparisonUseTheSameTwoUnambiguousPriceBlocks(){
  val model=model();val comparison=mutableStateOf(false);ui.runOnIdle{model.products.forEach{PartnerLibrary.compare(it.code)}}
  ui.setContent{RetailTheme{if(comparison.value)RetailComparison(model,{})else RetailProductDetails(model.products.first(),model,{})}}
  // Administrator pairs open expanded, so both prices are understandable before a scroll.
  readable("admin-retail-details:$code:amount")
  ui.onNode(vertical).performScrollToNode(hasTestTag("admin-price-details:$code:kp"));pair("details",model.products.first());readable("admin-price-details:$code:kp:label")
  ui.runOnIdle{comparison.value=true};ui.onNode(vertical).performScrollToNode(hasTestTag("admin-price-comparison:$code:kp"))
  for(product in model.products){pair("comparison",product);readable("admin-price-comparison:${product.code}:ws:amount");readable("admin-price-comparison:${product.code}:kp:amount")}
 }
 @Test fun alternateCatalogueShowsBothAdminPricesButClientStillReceivesOnlyItsSelectedPrice(){
  val shown=mutableStateOf(model());ui.runOnIdle{shown.value.showAllProducts()};ui.setContent{RetailTheme{CatalogScreen(shown.value,{},{},{},{})}}
  ui.onNode(vertical).performScrollToKey("product:$code");pair("alternate",shown.value.products.first());readable("admin-price-alternate:$code:kp:amount")
  val client=model("client");ui.runOnIdle{client.showAllProducts();shown.value=client};ui.onAllNodes(hasTestTag("admin-price-alternate:$code:kp")).assertCountEquals(0);ui.onAllNodesWithText(L10n.t("Ձեր գինը"))[0].assertExists();ui.onAllNodesWithText(money(7654321.50)).assertCountEquals(0)
 }
 @Test fun enteringCustomerPreviewRemovesTheAdminPairEvenIfTheDtoContainsExtraPurchaseFields(){
  val preview=mutableStateOf(false);ui.setContent{RetailTheme{Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())){AdminCatalogPriceBlocks(Product(row()),"admin",preview.value,"privacy")}}};ui.onNodeWithTag("admin-price-privacy:$code:kp").assertExists()
  ui.runOnIdle{preview.value=true};ui.onNodeWithTag("admin-price-privacy:$code:ws").assertDoesNotExist();ui.onNodeWithTag("admin-price-privacy:$code:kp").assertDoesNotExist();ui.onAllNodesWithText(L10n.t("KP ակցիա")).assertCountEquals(0)
 }
}
