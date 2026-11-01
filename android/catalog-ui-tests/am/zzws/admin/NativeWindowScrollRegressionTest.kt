package am.zzws.admin

import android.os.Looper
import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h560dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class NativeWindowScrollRegressionTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val vertical=SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange)
 private val owner="00000000-0000-4000-8000-000000000001"
 private val orderId="11111111-1111-4111-8111-111111111111"
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 private fun rows()=(1..12).map{n->JSONObject().put("articul","scroll-$n").put("name","Long fixture product $n · "+"name ".repeat(12)).put("brand","Fixture").put("category","Ներկառուցվող վառարաններ").put("wholesale",10).put("retail",20).put("stockAvailable",true).put("stockStatus","Առկա է")}
 private fun order(n:Int=1)=JSONObject().put("id",if(n==1)orderId else "11111111-1111-4111-8111-"+n.toString().padStart(12,'0')).put("number",1000+n).put("user_id",owner).put("customer_id",owner).put("revision",1).put("status","completed").put("created","2026-11-01T00:00:00Z").put("total",120).put("customer",JSONObject().put("client","Fixture company")).put("comment","Order tail · "+"long context ".repeat(20)).put("lines",JSONArray(rows().map{JSONObject().put("articul",it.text("articul")).put("name",it.text("name")).put("qty",1).put("unitPrice",10)}))
 private fun ready(model:UnifiedModel){ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy}}
 private fun model(admin:Boolean=false):UnifiedModel{
  val customers=(1..30).map{n->JSONObject().put("id","22222222-2222-4222-8222-"+n.toString().padStart(12,'0')).put("customerCode","FIXTURE-$n").put("client","Customer $n · "+"long company ".repeat(12))}
  val backend=TrialDemoBackend(sample=rows(),initialOrders=(1..30).map{order(it)},initialCustomers=customers)
  backend.user.put("clientRole","manager").put("rowsList",JSONArray((1..3).map{n->JSONObject().put("id","delivery-$n").put("organization","Organization $n "+"long ".repeat(20)).put("address","Address "+"long ".repeat(30)).put("contact","Contact "+"long ".repeat(20))}))
  if(admin)backend.user.put("role","admin").put("mobileAdminEnabled",true).put("permissions",JSONArray().put("orders:read").put("orders:write"))
  // Fresh, exact synthetic technical documents keep these layout tests offline.
  val directory=File(RuntimeEnvironment.getApplication().cacheDir,"technical");directory.mkdirs()
  rows().forEach{product->val specs=JSONArray((1..24).map{n->JSONArray().put("Fixture feature $n").put("Long fixture value ".repeat(8))});val data=JSONObject().put("schemaVersion",1).put("products",JSONObject().put(product.text("articul"),JSONArray().put(product.text("name")).put("https://www.zigzag.am/fixture.html").put("2026-11-01").put(specs)));File(directory,technicalFile(product.text("articul"))).writeText(data.toString())}
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(backend,restoreSavedSession={false})};ready(model);ui.runOnUiThread{model.enterDemo()};return model
 }
 private fun text(value:String)=ui.onNodeWithText(L10n.t(value))
 private fun pageScrollTo(value:String){ui.onNode(vertical).performScrollToNode(hasText(L10n.t(value),substring=true))}
 private fun beforeDock(node:SemanticsNodeInteraction){node.assertIsDisplayed();assertTrue("Last action must stay above the fixed navigation",node.getUnclippedBoundsInRoot().bottom<=ui.onNodeWithTag("catalog-bottom-bar").getUnclippedBoundsInRoot().top)}
 private fun fullyVisible(node:SemanticsNodeInteraction):Boolean{val bounds=node.getUnclippedBoundsInRoot();val clipped=node.fetchSemanticsNode().boundsInRoot;val density=ui.activity.resources.displayMetrics.density;return clipped.height+.5f>=(bounds.bottom-bounds.top).value*density&&clipped.width+.5f>=(bounds.right-bounds.left).value*density}
 private fun scrollBy(node:SemanticsNodeInteraction,amount:Float){node.performSemanticsAction(SemanticsActions.ScrollBy){it(0f,amount)};ui.waitForIdle()}
 private fun reach(node:SemanticsNodeInteraction){if(!fullyVisible(node))node.performScrollTo();node.assertIsDisplayed();assertTrue("The complete input/action must be visible",fullyVisible(node))}
 @Test fun longCartAndCheckoutStagesKeepTheirLastActionsReachableInBothLanguages(){
  val model=model();ui.runOnIdle{model.products.forEach{model.cart[it.code]=1};model.updateDelivery(comment="Long checkout comment ".repeat(35));model.screen="cart"};ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  for(language in listOf("hy","ru"))for((stage,label)in listOf(1 to "Բեռնել կայքի զամբյուղը",2 to "Վերադառնալ կազմին",3 to "Փոխել տվյալները")){
   ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language);model.checkoutStep=stage};pageScrollTo(label);beforeDock(text(label))
  }
 }
 @Test fun profileFooterAndMenuLogoutAreReachableAboveTheirOwnViewport(){
  val model=model();ui.runOnIdle{model.screen="profile"};ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  pageScrollTo("Android 8+");beforeDock(ui.onNode(hasText("Android 8+",substring=true)))
  ui.runOnIdle{model.screen="home"};ui.onNodeWithTag("navigation-menu").performClick();ui.onNode(vertical and hasAnyDescendant(hasText(L10n.t("Դուրս գալ")))).performScrollToNode(hasText(L10n.t("Դուրս գալ")));text("Դուրս գալ").assertIsDisplayed().performClick();text("Մնալ").assertIsDisplayed().performClick();assertNotNull(model.user)
 }
 @Test fun longOrderHistoryAndDetailKeepTheirFinalActionsAboveNavigation(){
  val model=model();ui.runOnIdle{model.history()};ready(model);ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  pageScrollTo("Բեռնել ավելի հին պատվերները");beforeDock(text("Բեռնել ավելի հին պատվերները"))
  ui.runOnIdle{model.openOrder(orderId)};ready(model);pageScrollTo("Թարմացնել պատվերը");beforeDock(text("Թարմացնել պատվերը"))
 }
 @Test fun notificationOptionsRemainReachableInBothLocales(){
  val model=model(admin=true);ui.runOnIdle{model.notifications()};ready(model);ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  for(language in listOf("hy","ru")){ui.runOnIdle{AppLanguage.select(RuntimeEnvironment.getApplication(),language)};pageScrollTo("Համակարգային ծանուցումներ");beforeDock(text("Համակարգային ծանուցումներ"))}
 }
 @Test fun productAndComparisonSheetsCanReachTheirTechnicalTailAndCloseActions(){
  val model=model();ui.runOnIdle{model.products.take(3).forEach{PartnerLibrary.compare(it.code)}}
  ui.setContent{RetailTheme{RetailComparison(model,{})}}
  ui.onNode(vertical).performScrollToNode(hasText(L10n.t("Փակել")));text("Փակել").assertIsDisplayed();text("Մաքրել ցանկը").assertIsDisplayed()
 }
 @Test fun productDetailsCanReachTheTechnicalTailAndReturnToTheHeader(){
  val model=model();val product=model.products.first();var dismissed=false;ui.setContent{RetailTheme{RetailProductDetails(product,model,{dismissed=true})}}
  ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();ui.onAllNodes(hasText("2026-11-01",substring=true)).fetchSemanticsNodes().isNotEmpty()}
  ui.onNode(vertical).performScrollToNode(hasText("2026-11-01",substring=true));ui.onNode(hasText("2026-11-01",substring=true)).assertIsDisplayed()
  // Scroll exactly to the header. An artificial -100000px drag also reaches the
  // sheet's nested-drag parent and dismisses the whole sheet below the window.
  ui.onNode(vertical).performScrollToNode(hasTestTag("product-details-close"))
  ui.onNodeWithTag("product-details-close").assertIsDisplayed().performClick();assertTrue(dismissed)
 }
 @Test fun longFilterChoicesScrollWhileApplyAndCloseRemainReachable(){
  val products=(1..50).map{n->Product(JSONObject().put("articul","filter-$n").put("category","Fixture category $n").put("wholesale",10).put("stockAvailable",true))};ui.setContent{RetailTheme{CatalogFiltersDialog(products,"",CatalogFilters(),onApply={},onDismiss={})}}
  text("Կատեգորիա").performClick();val footer=text("Պատրաստ է").getUnclippedBoundsInRoot();ui.onNode(vertical).performScrollToNode(hasText("Fixture category 50"));assertEquals(footer,text("Պատրաստ է").getUnclippedBoundsInRoot());text("Պատրաստ է").assertIsDisplayed().performClick();text("Ցույց տալ՝ 50 ապրանք").assertIsDisplayed()
 }
 @Test fun buyerListCanReachLastCustomerWithoutMovingTheCloseAction(){
  val model=model(admin=true);ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  ui.onNodeWithTag("navigation-menu").performClick();ui.onNode(vertical and hasAnyDescendant(hasText(L10n.t("Ընտրել հաճախորդին")))).performScrollToNode(hasText(L10n.t("Ընտրել հաճախորդին")));text("Ընտրել հաճախորդին").performClick();ready(model)
  ui.onNode(vertical and hasAnyAncestor(isDialog())).performScrollToNode(hasText("FIXTURE-30"));ui.onNodeWithText("FIXTURE-30",useUnmergedTree=true).assertIsDisplayed();text("Փակել").assertIsDisplayed()
 }
 @Test @Config(qualifiers="w320dp-h360dp") fun primaryDeferralInputRemainsReachableInAConstrainedWindow(){
  val model=model();val order=order().put("user_id","employee-fixture").put("approval",JSONObject().put("id","proposal-fixture").put("state","pending").put("lines",JSONArray()))
  ui.setContent{RetailTheme{Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())){OrderApprovalPanel(model,order)}}}
  text("Ժամանակ խնդրել դիտարկման համար").performScrollTo().performClick();val input=ui.onNode(hasSetTextAction());reach(input);input.performTextReplacement("15");reach(text("Հիշեցնել նշված ժամանակից հետո"))
 }
 @Test @Config(qualifiers="w320dp-h240dp") fun searchSubmitRemainsReachableInAKeyboardSizedWindow(){
  ui.setContent{RetailTheme{CatalogSearchSheet("long fixture search",onSearch={},onDismiss={})}}
  reach(ui.onNodeWithTag("catalog-search-submit"));ui.onNodeWithTag("catalog-search-submit").assertHasClickAction()
 }
 @Test fun longErrorTextHasAnActualScrollOwnerAndReachableCloseAction(){
  val model=model();val error=("Long fixture error details. ".repeat(150))+" END-OF-ERROR";ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model);ui.runOnIdle{model.errorDialog=error}
  scrollBy(ui.onNodeWithTag("error-dialog-content"),100000f)
  val node=ui.onNodeWithText(error,useUnmergedTree=true);val layouts=mutableListOf<TextLayoutResult>();node.performSemanticsAction(SemanticsActions.GetTextLayoutResult){it(layouts)};val layout=layouts.single();val glyph=layout.getBoundingBox(error.length-1);val density=ui.activity.resources.displayMetrics.density;val textTop=node.getUnclippedBoundsInRoot().top;val viewport=ui.onNodeWithTag("error-dialog-content").getUnclippedBoundsInRoot();assertTrue(textTop+(glyph.top/density).dp>=viewport.top);assertTrue(textTop+(glyph.bottom/density).dp<=viewport.bottom)
  text("Փակել").assertIsDisplayed().performClick();assertTrue(model.errorDialog.isBlank())
 }
 @Test fun receiptAcknowledgementAndActionsRemainReachableWithLongOrderContent(){
  val model=model();ui.runOnIdle{model.prepareReceipt(orderId,1)};ready(model);ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  ui.onNode(isToggleable() and hasClickAction()).performScrollTo().assertIsDisplayed().performClick();text("Այո, հաստատում եմ").assertIsDisplayed().assertIsEnabled();text("Չեղարկել").assertIsDisplayed().performClick();assertNull(model.receiptConfirmation)
 }
 @Test @Config(qualifiers="w320dp-h360dp") fun accountSetupKeepsItsLastActionReachableInAShortWindow(){val model=model();ui.setContent{RetailTheme{AccountDetails(model)}};ui.onNode(vertical).performScrollToNode(hasText(L10n.t("Ելք")));reach(text("Ելք"))}
 @Test @Config(qualifiers="w320dp-h360dp") fun loginKeepsItsLastEntryActionReachableInAShortWindow(){lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(restoreSavedSession={false})};ready(model);ui.setContent{RetailTheme{UnifiedApp(model)}};ui.onNode(vertical).performScrollToNode(hasText(L10n.t("Դիտել դեմո տարբերակը")));reach(text("Դիտել դեմո տարբերակը"))}
 @Test fun catalogueAndFixedNavigationRespectSimulatedStatusAndNavigationInsets(){
  val model=model();ui.runOnIdle{model.showAllProducts()};ui.setContent{RetailTheme{UnifiedApp(model)}};ready(model)
  fun composeView(view:View):View?{if(view.javaClass.name=="androidx.compose.ui.platform.AndroidComposeView")return view;if(view is ViewGroup)for(i in 0 until view.childCount){val found=composeView(view.getChildAt(i));if(found!=null)return found};return null}
  ui.runOnIdle{val view=composeView(ui.activity.window.decorView)?:error("Compose root missing");ViewCompat.dispatchApplyWindowInsets(view,WindowInsetsCompat.Builder().setInsets(WindowInsetsCompat.Type.systemBars(),Insets.of(0,24,0,48)).build())}
  val content=ui.onNodeWithTag("catalog-products-grid").getUnclippedBoundsInRoot();val dock=ui.onNodeWithTag("catalog-bottom-bar").getUnclippedBoundsInRoot()
  assertTrue("Content must start below the simulated status inset",content.top>=24.dp);assertTrue(content.bottom<=dock.top);assertTrue("Actions must end before the simulated navigation inset",dock.bottom<=512.dp)
 }
}
