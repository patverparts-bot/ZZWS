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
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h560dp")
class ServerModalProgressPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.clear();AppLanguage.initialize(c);PartnerLibrary.clear();assertEquals(0,ServerMutationProgress.activeRequests)}
 private fun ready(model:UnifiedModel){ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy&&!model.restoringSession}}
 private fun frontmostProgress(){ui.onNode(isDialog()).assert(hasAnyDescendant(hasTestTag("server-operation-progress")));ui.onAllNodes(hasTestTag("server-operation-progress") and hasAnyAncestor(isDialog())).assertCountEquals(1)[0].assertIsDisplayed()}
 @Test fun detailsComparisonAndReceiptKeepARealRequestIndicatorInsideTheirOwnDialogWindow(){
  val product=JSONObject().put("articul","fixture-progress").put("name","Synthetic refrigerator").put("category","Սառնարաններ").put("wholesale",1000).put("stockAvailable",true).put("stockStatus","Առկա է")
  val id="11111111-1111-4111-8111-111111111111"
  val order=JSONObject().put("id",id).put("number",81).put("status","completed").put("revision",1).put("user_id","00000000-0000-4000-8000-000000000001")
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(TrialDemoBackend(sample=listOf(product),initialOrders=listOf(order)),restoreSavedSession={false})};ready(model);ui.runOnIdle{model.enterDemo();PartnerLibrary.comparison.add("fixture-progress")}
  val modal=mutableStateOf("details");ui.setContent{RetailTheme{when(modal.value){"details"->RetailProductDetails(model.products.single(),model){};"comparison"->RetailComparison(model){};else->UnifiedApp(model)}}};var ticket=0L
  try{
   ui.runOnIdle{ticket=ServerMutationProgress.begin()};frontmostProgress();ui.runOnIdle{modal.value="comparison"};frontmostProgress()
   ui.runOnIdle{modal.value="receipt";model.prepareReceipt(id,1)};ready(model);assertNotNull(model.receiptConfirmation);frontmostProgress()
   ui.runOnIdle{ServerMutationProgress.finish(ticket)};ui.onAllNodes(hasTestTag("server-operation-progress") and hasAnyAncestor(isDialog())).assertCountEquals(0)
  }finally{ServerMutationProgress.finish(ticket)}
 }
}
