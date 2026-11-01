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
import org.robolectric.annotation.GraphicsMode
@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w360dp-h800dp")
@GraphicsMode(GraphicsMode.Mode.LEGACY)
class OrderDataExportUiTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(c);AppLanguage.select(c,"hy")}
 @Test fun clientHistoryAndDetailsHaveExportButtonsAndDemoNeverStartsARealDownload(){
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel()};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo();model.history()};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy&&model.screen=="orders"}
  ui.setContent{RetailTheme{UnifiedApp(model)}};ui.onNodeWithTag("download-all-order-data").assertExists().assertIsNotEnabled();ui.onNodeWithText("Բոլոր պատվերները՝ բոլոր կարգավիճակներով").assertExists()
 }
 @Test fun filteredExportControlUsesTheSameExplicitDownloadLabelAndDemoGuard(){
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel()};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo()}
  ui.setContent{RetailTheme{OrderDataExportButton(model,filtered=true)}};ui.onNodeWithTag("download-filtered-order-data").assertExists().assertIsNotEnabled();ui.onNodeWithText("Ներբեռնել ըստ որոնման").assertExists()
 }
 @Test fun administratorDoesNotGetClientExportControls(){
  lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel()};ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy};ui.runOnUiThread{model.enterDemo();model.user?.put("role","admin")}
  ui.setContent{RetailTheme{OrderDataExportButton(model)}};ui.onNodeWithTag("download-all-order-data").assertDoesNotExist()
 }
}
