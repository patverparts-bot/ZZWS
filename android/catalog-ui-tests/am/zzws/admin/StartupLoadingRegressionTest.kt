package am.zzws.admin

import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class StartupLoadingRegressionTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private lateinit var server:StartupServer
 private var previousStore:Any?=null
 @Before fun setup(){
  val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);AppLanguage.select(context,"hy")
  // AndroidKeyStore is not provided by Robolectric. Network and model paths remain real.
  val store=AppSession::class.java.getDeclaredField("store");store.isAccessible=true;previousStore=store.get(null);store.set(null,null)
  server=StartupServer()
  for(name in listOf("base","key")){val field=ApiClient::class.java.getDeclaredField(name);field.isAccessible=true;field.set(AppSession.api,if(name=="base")"http://127.0.0.1:${server.listener.localPort}/functions/v1/zzws-api/" else "public-key")}
  AppSession.api.restoreToken("a".repeat(64))
 }
 @After fun cleanup(){
  server.close();AppSession.clear()
  val store=AppSession::class.java.getDeclaredField("store");store.isAccessible=true;store.set(null,previousStore)
 }
 private fun start():UnifiedModel {
  lateinit var model:UnifiedModel
  ui.runOnUiThread{model=UnifiedModel(restoreSavedSession={true})}
  ui.setContent{RetailTheme{UnifiedApp(model)}}
  ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();server.started.count==0L}
  return model
 }
 private fun ready(model:UnifiedModel){ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();!model.busy&&!model.restoringSession}}
 @Test fun concurrentReadsKeepLoadingVisibleThenRestoreTheWholeAccountOnce(){
  val model=start()
  assertEquals(listOf("me","me/mobile/session"),server.paths.take(2));assertTrue(model.busy);assertTrue(model.restoringSession);assertTrue(model.authorizationLoading)
  ui.onNodeWithTag("session-restoring-screen").assertExists();assertTrue(model.products.isEmpty());assertTrue(model.cart.isEmpty())
  server.releases.getValue("catalog").countDown();server.releases.getValue("me/state").countDown()
  assertFalse(server.completed.getValue("me/mobile/preferences").await(100,TimeUnit.MILLISECONDS));assertTrue(model.restoringSession)
  server.releases.getValue("me/mobile/preferences").countDown();ready(model)
  assertEquals("startup-owner",model.user!!.text("id"));assertEquals(listOf("0000123"),model.products.map{it.code});assertEquals(3,model.cart["0000123"])
  assertEquals("Saved address",model.address);assertEquals("Saved contact",model.contact);assertEquals("Saved comment",model.comment);assertEquals("2027-02-03",model.date)
  assertTrue("0000123" in PartnerLibrary.favorites);assertEquals(false,model.subscriptions!!.getBoolean("enabled"));assertFalse(model.pendingSubmission)
  ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist()
  assertFalse(model.authorizationLoading)
  ui.waitForIdle();Thread.sleep(100);shadowOf(Looper.getMainLooper()).idle()
  assertEquals("Attaching an already resumed activity must not repeat startup",1,server.paths.count{it=="me"})
  assertEquals(1,server.paths.count{it=="catalog"});assertEquals(1,server.paths.count{it=="me/state"})
  assertTrue(model.errorDialog,model.errorDialog.isBlank())
 }
 @Test fun changedSessionDiscardsTheEntireReadBatch(){
  val model=start();AppSession.api.restoreToken("b".repeat(64));server.releaseAll();ready(model)
  assertTrue(model.products.isEmpty());assertTrue(model.cart.isEmpty());assertNull(model.subscriptions);assertTrue(model.errorDialog.isNotBlank())
 }
 @Test fun expiredSessionClearsTheAccountWithoutPublishingPartialCatalogOrCart(){
  server.expired=true;val model=start();server.releases.getValue("me/mobile/preferences").countDown()
  assertTrue(server.completed.getValue("me/mobile/preferences").await(3,TimeUnit.SECONDS));server.releaseAll();ready(model)
  assertNull(model.user);assertNull(AppSession.user);assertTrue(AppSession.api.sessionToken().isEmpty());assertTrue(model.products.isEmpty());assertTrue(model.cart.isEmpty())
 }
 private fun loaded():UnifiedModel{val model=start();server.releaseAll();ready(model);assertFalse(model.authorizationLoading);return model}
 private fun pendingRefresh(model:UnifiedModel){ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();server.catalogRequests.get()>=2};assertFalse(model.authorizationLoading);ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist()}
 @Test fun manualCatalogueRefreshUsesTheOriginalProgressInsteadOfTheAuthorizationScene(){
  val model=loaded();server.holdCatalogue();ui.runOnIdle{model.showAllProducts();model.refresh()};pendingRefresh(model)
  assertTrue(model.busy);ui.onNodeWithTag("server-operation-progress").assertIsDisplayed();assertEquals(3,model.cart["0000123"])
  server.releaseAll();ready(model);assertEquals("catalog",model.screen);assertFalse(model.authorizationLoading);assertEquals(3,model.cart["0000123"])
 }
 @Test fun returningToAnAuthorizedSessionKeepsTheOriginalProgress(){
  val model=loaded();server.holdCatalogue();ui.runOnIdle{model.resume()};pendingRefresh(model)
  assertTrue(model.busy);ui.onNodeWithTag("server-operation-progress").assertIsDisplayed();server.releaseAll();ready(model);assertFalse(model.authorizationLoading)
 }
 @Test fun automaticVersionRefreshDoesNotShowTheAuthorizationScene(){
  val model=loaded();server.version="changed";server.holdCatalogue();ui.runOnIdle{model.showAllProducts();model.pollCatalog()};pendingRefresh(model)
  assertFalse(model.busy);server.releaseAll();ui.waitUntil(10000){shadowOf(Looper.getMainLooper()).idle();model.products.firstOrNull()?.name=="Test refrigerator changed"};assertFalse(model.authorizationLoading)
 }
 @Test fun failedCatalogueRefreshKeepsExistingErrorHandlingAndHidesOldProgress(){
  val model=loaded();server.failCatalogue=true;server.holdCatalogue();ui.runOnIdle{model.refresh()};pendingRefresh(model)
  ui.onNodeWithTag("server-operation-progress").assertIsDisplayed();server.releaseAll();ready(model);assertTrue(model.errorDialog.isNotBlank());assertFalse(model.authorizationLoading);assertEquals(listOf("0000123"),model.products.map{it.code});ui.onNodeWithTag("session-restoring-screen").assertDoesNotExist()
 }
 private class StartupServer:AutoCloseable {
  val listener=ServerSocket(0);private val workers=Executors.newCachedThreadPool()
  val paths=Collections.synchronizedList(mutableListOf<String>())
  val releases=ConcurrentHashMap(listOf("catalog","me/state","me/mobile/preferences").associateWith{CountDownLatch(1)})
  val completed=ConcurrentHashMap(releases.keys.associateWith{CountDownLatch(1)});val started=CountDownLatch(3)
  val catalogRequests=AtomicInteger()
  @Volatile var version="fresh"
  @Volatile var failCatalogue=false
  @Volatile var expired=false
  init{workers.submit{while(!listener.isClosed){try{val socket=listener.accept();workers.submit{reply(socket)}}catch(_:Exception){break}}}}
  private fun reply(socket:Socket){socket.use{try{
   socket.soTimeout=5000;val reader=socket.getInputStream().bufferedReader();val line=reader.readLine()?:return
   val path=line.split(' ')[1].substringAfter("/functions/v1/zzws-api/");var length=0
   while(true){val header=reader.readLine()?:break;if(header.isEmpty())break;if(header.startsWith("Content-Length:",true))length=header.substringAfter(':').trim().toInt()}
   repeat(length){reader.read()};paths.add(path);if(path=="catalog")catalogRequests.incrementAndGet()
   if(releases.containsKey(path)){started.countDown();if(!releases.getValue(path).await(10,TimeUnit.SECONDS))return}
   val account=JSONObject().put("id","startup-owner").put("role","client").put("client","Startup test").put("rowsList",JSONArray().put(JSONObject().put("id","delivery-a").put("address","Default address").put("contact","Default contact")))
   val body=when(path){
    "me"->account
    "catalog"->JSONObject().put("account",account).put("version",version).put("products",JSONArray().put(JSONObject().put("articul","0000123").put("name","Test refrigerator "+version).put("category","Սառնարաններ").put("wholesale",1000)))
    "catalog/version"->JSONObject().put("version",version)
    "me/state"->JSONObject().put("versions",JSONObject().put("cart",4).put("draft",2)).put("data",JSONObject().put("cart",JSONObject().put("0000123",JSONObject().put("qty",3))).put("favorites",JSONArray().put("0000123")).put("draft",CheckoutDraft("delivery-a","Առաքում","Saved address","Saved contact","2027-02-03","Saved comment").json()))
    "me/mobile/preferences"->JSONObject().put("enabled",false)
    else->JSONObject()
   }
   val status=if(path=="me/mobile/preferences"&&expired)401 else if(path=="catalog"&&failCatalogue)503 else 200
   val bytes=(if(status==401)JSONObject().put("error","Expired")else body).toString().toByteArray(Charsets.UTF_8)
   val out=socket.getOutputStream();out.write("HTTP/1.1 $status OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray());out.write(bytes);out.flush();completed[path]?.countDown()
  }catch(_:Exception){}}}
  fun releaseAll(){releases.values.forEach{it.countDown()}}
  fun holdCatalogue(){releases["catalog"]=CountDownLatch(1);completed["catalog"]=CountDownLatch(1)}
  override fun close(){releaseAll();listener.close();workers.shutdownNow();workers.awaitTermination(3,TimeUnit.SECONDS)}
 }
}
