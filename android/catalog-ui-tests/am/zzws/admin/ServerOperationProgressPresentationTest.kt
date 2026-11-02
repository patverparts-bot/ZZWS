package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.runtime.*
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h740dp")
class ServerOperationProgressPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy");assertEquals(0,ServerMutationProgress.activeRequests)}
 private fun ready(model:UnifiedModel){ui.waitUntil(5000){shadowOf(Looper.getMainLooper()).idle();!model.busy&&!model.restoringSession}}
 private fun model(profileSetup:Boolean=false):UnifiedModel{val backend=TrialDemoBackend(sample=emptyList());backend.user.put("needsProfileSetup",profileSetup);lateinit var model:UnifiedModel;ui.runOnUiThread{model=UnifiedModel(backend,restoreSavedSession={false})};ready(model);ui.runOnIdle{model.enterDemo()};return model}
 private fun progress(){ui.onNodeWithTag("server-operation-progress").assertIsDisplayed().assert(SemanticsMatcher.expectValue(SemanticsProperties.ProgressBarRangeInfo,ProgressBarRangeInfo.Indeterminate))}
 @Test fun backgroundSaveRemainsVisibleAcrossPagesAndAnOpenMenuWithoutBlockingTheCart(){
  val model=model();ui.setContent{RetailTheme{UnifiedApp(model)}};var ticket=0L
  try{ui.runOnIdle{ticket=ServerMutationProgress.begin();model.cart["fixture-cart"]=2};for(page in listOf("home","catalog","favorites","cart","profile","orders")){ui.runOnIdle{model.screen=page};progress();assertFalse("A background save must not change existing busy semantics",model.busy);assertEquals(2,model.cart["fixture-cart"])}
   ui.onNodeWithTag("navigation-menu").performClick();progress();ui.runOnIdle{ServerMutationProgress.finish(ticket)};ui.onNodeWithTag("server-operation-progress").assertDoesNotExist()
  }finally{ServerMutationProgress.finish(ticket)}
 }
 @Test fun loginAndRequiredProfileSetupDoNotHideTheSharedServerProgress(){
  lateinit var login:UnifiedModel;ui.runOnUiThread{login=UnifiedModel(restoreSavedSession={false})};ready(login);val shown=mutableStateOf(login);ui.setContent{RetailTheme{UnifiedApp(shown.value)}};var ticket=0L
  try{ui.runOnIdle{ticket=ServerMutationProgress.begin()};progress();val profile=model(profileSetup=true);ui.runOnIdle{shown.value=profile};progress();ui.runOnIdle{ServerMutationProgress.finish(ticket)};ui.onNodeWithTag("server-operation-progress").assertDoesNotExist()}finally{ServerMutationProgress.finish(ticket)}
 }
}
