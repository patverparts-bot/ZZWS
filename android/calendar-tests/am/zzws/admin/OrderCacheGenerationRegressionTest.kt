package am.zzws.admin

import android.os.Looper
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.cancel
import java.io.ByteArrayOutputStream
import java.time.Duration
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class)
class OrderCacheGenerationRegressionTest {
 private val orderId="11111111-1111-4111-8111-111111111111"
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.clear();AppLanguage.initialize(context);PartnerLibrary.clear();context.getSharedPreferences("zzws_checkout_drafts",0).edit().clear().commit();context.getSharedPreferences("zzws_pending_orders",0).edit().clear().commit()}
 private fun waitFor(message:String,condition:()->Boolean){val deadline=System.nanoTime()+10_000_000_000;while(!condition()&&System.nanoTime()<deadline){shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(10));Thread.sleep(5)};assertTrue(message,condition())}
 private fun ready(model:UnifiedModel)=waitFor("Model did not finish the actual API operation"){!model.busy&&!model.restoringSession}
 private fun model():UnifiedModel{val order=JSONObject().put("id",orderId).put("number",81).put("status","completed").put("revision",1).put("user_id","00000000-0000-4000-8000-000000000001");val backend=TrialDemoBackend(sample=emptyList(),initialOrders=listOf(order));val model=UnifiedModel(backend,restoreSavedSession={false});ready(model);model.enterDemo();model.cart["private-cart"]=2;model.updateDelivery(address="Private address",contact="Private contact",comment="Private draft",date="2027-02-03");PartnerLibrary.accept(setOf("private-favorite"));model.history();ready(model);model.openOrder(orderId);ready(model);return model}
 @Test fun orderOnlyResetClearsHistoryAndDetailButPreservesProfileCartDraftAndFavorites(){val model=model();try{val profile=model.user!!.toString();val cart=model.cart.toMap();val draft=listOf(model.address,model.contact,model.comment,model.date,model.method,model.priceMode);assertNotNull(model.order);assertTrue(model.orders.isNotEmpty());model.reconcileServerGenerations(1,0);assertNull(model.order);assertTrue(model.orders.isEmpty());assertNull(model.receiptConfirmation);assertNull(model.approvalReminder);assertEquals("orders",model.screen);assertEquals(profile,model.user!!.toString());assertEquals(cart,model.cart.toMap());assertEquals(draft,listOf(model.address,model.contact,model.comment,model.date,model.method,model.priceMode));assertEquals(listOf("private-favorite"),PartnerLibrary.favorites.toList());model.openOrder(orderId);ready(model);model.reconcileServerGenerations(1,0);assertEquals(orderId,model.order!!.text("id"))}finally{model.viewModelScope.cancel()}}
 @Test fun explicitWorkspaceResetClearsOnlyWorkspaceAndLeavesActualOrderAndAccountIntact(){val model=model();try{val profile=model.user!!.toString();model.reconcileServerGenerations(0,1);assertEquals(profile,model.user!!.toString());assertEquals(orderId,model.order!!.text("id"));assertTrue(model.cart.isEmpty());assertTrue(PartnerLibrary.favorites.isEmpty());assertNotEquals("Private address",model.address);assertNotEquals("Private contact",model.contact);assertNotEquals("Private draft",model.comment);assertFalse(model.pendingSubmission);assertFalse(model.busy)}finally{model.viewModelScope.cancel()}}
 private fun withServer(block:(CustomerServer,UnifiedModel)->Unit){
  val store=AppSession::class.java.getDeclaredField("store").apply{isAccessible=true};val previousStore=store.get(null)
  val fields=listOf("base","key").map{ApiClient::class.java.getDeclaredField(it).apply{isAccessible=true}};val previous=fields.map{it.get(AppSession.api)}
  CustomerServer().use{server->var model:UnifiedModel?=null;try{
   // Only unavailable AndroidKeyStore session persistence is disabled. Actual
   // HTTP transport, model selection, memory and generation handling stay real.
   store.set(null,null);fields[0].set(AppSession.api,"http://127.0.0.1:${server.listener.localPort}/functions/v1/zzws-api/");fields[1].set(AppSession.api,"public-key");AppSession.api.restoreToken("a".repeat(64))
   val active=UnifiedModel(restoreSavedSession={true});model=active;ready(active);assertTrue(active.errorDialog,active.errorDialog.isBlank());block(server,active)
  }finally{model?.viewModelScope?.cancel();AppSession.clear();fields.forEachIndexed{n,field->field.set(AppSession.api,previous[n])};store.set(null,previousStore);AppContext.value.getSharedPreferences("zzws_checkout_drafts",0).edit().clear().commit();AppContext.value.getSharedPreferences("zzws_pending_orders",0).edit().clear().commit()}}
 }
 private fun selectCustomer(server:CustomerServer,model:UnifiedModel){model.searchCustomers("synthetic");ready(model);assertEquals(1,model.customers.size);model.chooseBuyer(server.customer);ready(model);assertTrue(model.errorDialog,model.errorDialog.isBlank());assertTrue(model.buyerView);assertEquals("fixture-client",model.products.single().code)}
 @Test fun actualHeadersPreserveAssistedSelectionForOrderOnlyButWorkspaceResetReloadsTheOwnCatalog()=withServer{server,model->
  selectCustomer(server,model);model.setQty("fixture-client",2);model.updateDelivery(comment="Assisted unsaved draft");val draft=model.comment
  model.screen="cart";server.orders=2;model.pollCatalog();waitFor("Existing customer was not freshly validated while checkout stayed open"){server.customerReads()>=2};assertTrue(model.buyerView);assertNotNull(model.buyer);assertEquals(2,model.cart["fixture-client"]);assertEquals(draft,model.comment)
  server.workspace=2;model.resume();ready(model);waitFor("Own catalog/memory was not loaded after explicit workspace reset"){model.products.singleOrNull()?.code=="fixture-own"&&server.count("me/state")>=2}
  assertNull(model.buyer);assertNull(model.catalogBuyer);assertTrue(model.customers.isEmpty());assertFalse(model.buyerView);assertEquals("fixture-own",model.products.single().code);assertTrue(model.cart.isEmpty());assertNotEquals(draft,model.comment);assertEquals(server.account.text("id"),model.user!!.text("id"));assertTrue(server.count("catalog")>=2)
 }
 @Test fun customerOnlyDeletionOrForbiddenAccessClearsAssistedPendingButPreservesPersonalEncryptedDraft(){
  for(status in listOf(403,404))withServer{server,model->
   selectCustomer(server,model);model.setQty("fixture-client",2);model.updateDelivery(comment="Assisted pending draft");model.prepareCheckout{};ready(model);assertTrue(model.errorDialog,model.checkoutReady)
   server.createStatus=503;model.submit();ready(model);assertTrue("Unknown send or unavailable local keystore must keep the explicit-retry request",model.pendingSubmission)
   val who=model.user!!.text("id");val context=AppContext.value;val drafts=context.getSharedPreferences("zzws_checkout_drafts",0);val pending=context.getSharedPreferences("zzws_pending_orders",0)
   // Opaque ciphertext boundary markers prove the deletion path clears only
   // the assisted order key, never the personal encrypted checkout journal.
   val personalCipher="opaque-test-personal-draft-ciphertext";drafts.edit().putString(who,personalCipher).commit();pending.edit().putString(who,"opaque-test-assisted-order-ciphertext").commit();model.errorDialog=""
   server.customerStatus=status;server.orders=2;model.pollCatalog()
   waitFor("Pending checkout did not observe the order reset and return to own memory"){!model.pendingSubmission&&!model.buyerView&&model.buyer==null&&model.products.singleOrNull()?.code=="fixture-own"&&model.cart["fixture-own"]==3&&model.comment=="Saved personal draft"&&server.count("me/state")>=2}
   assertTrue(model.customers.isEmpty());assertEquals(server.account.text("id"),model.user!!.text("id"));assertEquals(3,model.cart["fixture-own"]);assertEquals("Saved personal address",model.address);assertEquals("Saved personal contact",model.contact);assertEquals("Saved personal draft",model.comment);assertEquals(personalCipher,drafts.getString(who,null));assertFalse(pending.contains(who));assertEquals("1",AppSession.api.workspaceGeneration());assertTrue("A pending cart still needs silent generation probes",server.count("catalog/version")>=1)
  }
 }
 private class CustomerServer:AutoCloseable {
  val listener=ServerSocket(0);private val workers=Executors.newCachedThreadPool();private val paths=Collections.synchronizedList(mutableListOf<String>())
  @Volatile var orders=1
  @Volatile var workspace=1
  @Volatile var customerStatus=200
  @Volatile var createStatus=200
  val account=JSONObject().put("id","00000000-0000-4000-8000-000000000001").put("role","admin").put("client","Synthetic owner").put("profileRevision",1).put("mobileAdminEnabled",true).put("permissions",JSONArray(listOf("orders:read","orders:write","users"))).put("rowsList",JSONArray().put(JSONObject().put("id","own-delivery").put("address","Own address").put("contact","Own contact")))
  val customer=JSONObject().put("id","00000000-0000-4000-8000-000000000002").put("role","client").put("client","Synthetic customer").put("profileRevision",1).put("rowsList",JSONArray().put(JSONObject().put("id","customer-delivery").put("address","Customer address").put("contact","Customer contact")))
  fun count(path:String)=synchronized(paths){paths.count{it==path}}
  fun customerReads()=synchronized(paths){paths.count{it.startsWith("admin/orders/customer-catalog?")}}
  init{workers.submit{while(!listener.isClosed){try{val socket=listener.accept();workers.submit{reply(socket)}}catch(_:Exception){break}}}}
  private fun product(code:String)=JSONObject().put("articul",code).put("name",code).put("category","Սառնարաններ").put("wholesale",1000).put("stockAvailable",true).put("stockStatus","Առկա է")
  private fun reply(socket:Socket){socket.use{
   socket.soTimeout=5000;val input=socket.getInputStream();val headerBytes=ByteArrayOutputStream();var separators=0
   while(true){val next=input.read();if(next<0)return;headerBytes.write(next);separators=if(next==13||next==10)separators+1 else 0;if(separators==4)break}
   val headers=headerBytes.toString("UTF-8").split("\r\n");val path=headers[0].split(' ')[1].substringAfter("/functions/v1/zzws-api/");val length=headers.firstOrNull{it.startsWith("Content-Length:",true)}?.substringAfter(':')?.trim()?.toInt()?:0
   repeat(length){if(input.read()<0)return};paths.add(path)
   val status=when{path.startsWith("admin/orders/customer-catalog?")->customerStatus;path=="admin/orders/create"->createStatus;else->200}
   val body=if(status!=200)JSONObject().put("error","Synthetic unavailable customer or unknown send")else when{
    path=="me"->account
    path=="catalog/version"->JSONObject().put("version","fixture-version")
    path=="catalog"->JSONObject().put("account",account).put("version","fixture-version").put("products",JSONArray().put(product("fixture-own")))
    path.startsWith("admin/orders/customer-catalog?")->JSONObject().put("customer",customer).put("version","fixture-version").put("products",JSONArray().put(product("fixture-client")))
    path=="admin/orders/customer-quote"->JSONObject().put("customer",customer).put("products",JSONArray().put(product("fixture-client")))
    path.startsWith("admin/orders/customers?")->JSONObject().put("customers",JSONArray().put(customer))
    path=="me/state"->JSONObject().put("versions",JSONObject().put("cart",workspace).put("draft",workspace)).put("cleared",JSONObject().put("cart",if(workspace>1)workspace else 0).put("draft",if(workspace>1)workspace else 0)).put("data",if(workspace>1)JSONObject()else JSONObject().put("cart",JSONObject().put("fixture-own",JSONObject().put("qty",3))).put("draft",CheckoutDraft("own-delivery","Առաքում","Saved personal address","Saved personal contact","2027-02-03","Saved personal draft").json()))
    else->JSONObject()
   }
   val bytes=body.toString().toByteArray(Charsets.UTF_8);val out=socket.getOutputStream();out.write("HTTP/1.1 $status Fixture\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nX-ZZWS-Orders-Generation: $orders\r\nX-ZZWS-Workspace-Generation: $workspace\r\nConnection: close\r\n\r\n".toByteArray());out.write(bytes);out.flush()
  }}
  override fun close(){listener.close();workers.shutdownNow();workers.awaitTermination(3,TimeUnit.SECONDS)}
 }
}
