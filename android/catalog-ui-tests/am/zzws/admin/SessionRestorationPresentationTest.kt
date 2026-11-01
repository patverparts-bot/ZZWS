package am.zzws.admin

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import kotlinx.coroutines.CompletableDeferred
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class SessionRestorationPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 @Test fun signInFormDoesNotFlashWhileStoredSessionIsBeingRead(){
  val answer=CompletableDeferred<Boolean>();var calls=0
  val model=UnifiedModel(restoreSavedSession={calls++;answer.await()})
  ui.setContent{RetailTheme{UnifiedApp(model)}}
  ui.onNodeWithTag("session-restoring-screen").assertExists();ui.onNodeWithTag("session-restoring-progress").assertExists();ui.onNodeWithText("Մուտքանուն").assertDoesNotExist()
  ui.runOnIdle{assertTrue(model.restoringSession);answer.complete(false)}
  ui.waitUntil(5000){!model.restoringSession&&!model.busy}
  ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist();ui.onNodeWithText("Մուտքանուն").assertExists();assertEquals(1,calls)
 }
 @Test fun failedRestoreLeavesTheLoadingScreenAndDoesNotRestartAuthentication(){
  val answer=CompletableDeferred<Boolean>();var calls=0
  val model=UnifiedModel(restoreSavedSession={calls++;answer.await();throw java.io.IOException("Connection unavailable")})
  ui.setContent{RetailTheme{UnifiedApp(model)}}
  ui.onNodeWithTag("session-restoring-screen").assertExists();ui.onNodeWithText("Մուտքանուն").assertDoesNotExist()
  ui.runOnIdle{answer.complete(false)};ui.waitUntil(5000){!model.restoringSession&&!model.busy}
  ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist();assertEquals("Connection unavailable",model.notice);assertEquals(1,calls)
 }
}
