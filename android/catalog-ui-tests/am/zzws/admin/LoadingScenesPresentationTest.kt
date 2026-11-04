package am.zzws.admin

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w320dp-h740dp")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LoadingScenesPresentationTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")}
 private fun screenshot(name:String,tag:String?=null){
  ui.runOnIdle{
   val view=if(tag==null)ui.activity.window.decorView else {
    val type=Class.forName("android.view.WindowManagerGlobal");val instance=type.getMethod("getInstance").invoke(null);val field=type.getDeclaredField("mViews").apply{isAccessible=true}
    (field.get(instance) as List<*>).filterIsInstance<android.view.View>().last()
   }
   val bitmap=android.graphics.Bitmap.createBitmap(view.width,view.height,android.graphics.Bitmap.Config.ARGB_8888);view.draw(android.graphics.Canvas(bitmap));val folder=File("../output/apk-loading-scenes");folder.mkdirs();File(folder,name+".png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)};bitmap.recycle()
  }
 }
 @Test fun catalogueKeepsItsExistingScreenAfterSixSecondsAndStopsWhenRemoved(){
  val show=mutableStateOf(true);ui.mainClock.autoAdvance=false
  ui.setContent{RetailTheme{if(show.value)SessionRestoringScreen()else Text("ready")}}
  ui.mainClock.advanceTimeBy(6600);ui.onNodeWithTag("session-restoring-screen").assertExists();ui.onNodeWithText(CATALOG_LOADING_TITLE).assertExists();ui.onNodeWithTag("order-loading-canvas").assertDoesNotExist();screenshot("catalogue-hy-320")
  ui.runOnIdle{show.value=false};ui.mainClock.advanceTimeByFrame();ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist();ui.onNodeWithText("ready").assertExists()
 }
 @Test fun orderSceneEndsWithAnimationBeforeTheExistingConfirmation(){
  var calls=0;val completed=mutableStateOf(false);ui.mainClock.autoAdvance=false
  ui.setContent{RetailTheme{if(!completed.value)OrderPreparationScene(onComplete={calls++;completed.value=true},reducedMotion=false)else Text("existing-confirmation")}}
  ui.mainClock.advanceTimeBy(1200);ui.onNodeWithTag("order-preparation-scene").assertIsDisplayed();assertEquals(0,calls);ui.onNodeWithText("existing-confirmation").assertDoesNotExist();screenshot("order-loading-hy-320","order-preparation-scene")
  ui.mainClock.advanceTimeBy(3400);ui.onNodeWithText("existing-confirmation").assertExists();assertEquals(1,calls)
 }
 @Test fun reducedMotionImmediatelyContinuesAndStaticCatalogueStaysVisible(){
  var calls=0
  ui.setContent{RetailTheme{Column(Modifier.fillMaxSize()){CatalogueLoadingScene(reducedMotion=true);OrderPreparationScene(onComplete={calls++},reducedMotion=true)}}}
  ui.waitForIdle();assertEquals(1,calls);ui.onNodeWithTag("order-preparation-scene").assertDoesNotExist();ui.onNodeWithTag("catalogue-loading-canvas").assertIsDisplayed()
 }
 @Test fun cancellingTheOwningStateDoesNotShowALateConfirmation(){
  var calls=0;val shown=mutableStateOf(true);ui.mainClock.autoAdvance=false
  ui.setContent{RetailTheme{if(shown.value)OrderPreparationScene(onComplete={calls++},reducedMotion=false)}}
  ui.mainClock.advanceTimeBy(1000);ui.runOnIdle{shown.value=false};ui.mainClock.advanceTimeBy(6000);assertEquals(0,calls);ui.onNodeWithTag("order-preparation-scene").assertDoesNotExist()
 }
 @Test fun localLogoVariantsAndCurrentLanguageFitTheNarrowScreen(){
  val dark=mutableStateOf(false)
  ui.setContent{LoadingSceneTheme(dark.value){Surface{Column(Modifier.width(320.dp).padding(12.dp)){LoadingSceneLogo(Modifier.width(198.dp).height(46.dp));LocalizedText(CATALOG_LOADING_TITLE);LoadingSceneCanvas(true,.88f,Modifier.fillMaxWidth().aspectRatio(900f/310f));LocalizedText(ORDER_PREPARATION_TITLE)}}}}
  ui.onNodeWithTag("loading-logo-light").assertIsDisplayed();screenshot("scene-light-hy-320")
  ui.runOnIdle{dark.value=true;AppLanguage.select(AppContext.value,"ru")};ui.onNodeWithTag("loading-logo-dark").assertIsDisplayed();ui.onNodeWithTag("loading-logo-light").assertDoesNotExist();ui.onNodeWithText("Подготавливаем каталог").assertIsDisplayed();ui.onNodeWithText("Готовим ваш заказ к отгрузке").assertIsDisplayed();screenshot("scene-dark-ru-320")
 }
}
