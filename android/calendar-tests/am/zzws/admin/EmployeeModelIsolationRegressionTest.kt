package am.zzws.admin

import android.os.Looper
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
import java.time.Duration
import javax.crypto.spec.SecretKeySpec

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class)
class EmployeeModelIsolationRegressionTest {
 private val company="610000-company"
 private fun account(id:String,role:String="employee")=JSONObject().put("id",id).put("role","client").put("clientRole",role).put("customerId",company).put("customerCode","610000").put("rowsList",JSONArray().put(JSONObject().put("id","shared-delivery").put("address","Company address").put("contact","Company recipient")))
 @Before fun setup(){val context=RuntimeEnvironment.getApplication();AppContext.value=context;AppSession.initialize(context);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(context)}
 private fun ready(model:UnifiedModel){val deadline=System.nanoTime()+10_000_000_000L;while(model.busy&&System.nanoTime()<deadline){shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20));Thread.sleep(5)};shadowOf(Looper.getMainLooper()).idle();assertFalse("Model request did not complete",model.busy)}

 @Test fun unifiedModelDoesNotOfferReceiptForReadableCoworkerOrder(){
  val id="11111111-1111-4111-8111-111111111111"
  val foreign=JSONObject().put("id",id).put("number",123).put("user_id","employee-a").put("customer_id",company).put("status","completed").put("revision",4)
  for(viewer in listOf(account("employee-b"),account("other-company","manager"))){
   val backend=TrialDemoBackend(sample=emptyList(),initialOrders=listOf(foreign))
   viewer.keys().asSequence().toList().forEach{backend.user.put(it,viewer.get(it))}
   val model=UnifiedModel(backend);ready(model);model.enterDemo()
   assertEquals(company,model.user!!.text("customerId"));assertEquals(viewer.text("id"),model.user!!.text("id"))
   model.openOrder(id);ready(model);assertEquals(id,model.order!!.text("id"))
   model.prepareReceipt(id,4);ready(model)
   assertNull(model.receiptConfirmation);assertEquals("Սա ձեր պատվերը չէ։",model.errorDialog)
   assertEquals("completed",model.order!!.text("status"));assertFalse(receiptRecorded(model.order!!))
   model.logout();ready(model)
  }
 }

 @Test fun companyPrimaryPreparesReceiptWithoutChangingAuthorOrPersonalCartDraft(){
  val id="11111111-1111-4111-8111-111111111111"
  val employeeOrder=JSONObject().put("id",id).put("number",123).put("user_id","employee-a").put("customer_id",company).put("status","completed").put("revision",4).put("customer",JSONObject().put("author",JSONObject().put("id","employee-a").put("firstName","Original").put("lastName","Employee")))
  val before=employeeOrder.toString();val viewer=account(company,"manager");val backend=TrialDemoBackend(sample=emptyList(),initialOrders=listOf(employeeOrder))
  viewer.keys().asSequence().toList().forEach{backend.user.put(it,viewer.get(it))}
  val model=UnifiedModel(backend);ready(model);model.enterDemo();model.updateDelivery(address="Primary private address",contact="Primary private contact",comment="Primary private draft");model.cart["primary-only"]=2
  model.openOrder(id);ready(model);model.prepareReceipt(id,4);ready(model)
  assertTrue(model.errorDialog.isBlank());assertEquals(company,model.user!!.text("id"));assertEquals(company,model.receiptConfirmation!!.userId);assertTrue(model.receiptConfirmation!!.actingForAuthor)
  assertEquals("employee-a",model.order!!.text("user_id"));assertEquals("Original",model.order!!.getJSONObject("customer").getJSONObject("author").text("firstName"))
  assertEquals(2,model.cart["primary-only"]);assertEquals("Primary private address",model.address);assertEquals("Primary private contact",model.contact);assertEquals("Primary private draft",model.comment)
  assertEquals(before,employeeOrder.toString());model.cancelReceipt();model.logout();ready(model)
 }

 @Test fun encryptedCheckoutJournalUsesPersonalIdentityEvenWithIdenticalCompanyAndDelivery(){
  val endpoint="https://example.invalid/functions/v1/zzws-api/";val key=SecretKeySpec(ByteArray(32),"AES")
  val author=account("employee-a");val others=listOf(account("employee-b"),account(company,"manager"))
  val value=CheckoutDraft("shared-delivery","Առաքում","Private address","Private contact","2027-02-03","Employee A · հայերեն").json()
  val pending=JSONObject().put("version",7).put("value",value)
  val encrypted=SecureCheckoutDraft.encrypt(endpoint,author.text("id"),pending,key)
  assertFalse(encrypted.contains("Employee A"))
  assertEquals(pending.toString(),SecureCheckoutDraft.decrypt(endpoint,author.text("id"),encrypted,key).toString())
  for(other in others){
   assertEquals(author.text("customerId"),other.text("customerId"));assertEquals(author.getJSONArray("rowsList").toString(),other.getJSONArray("rowsList").toString())
   assertTrue("Shared company must not decrypt another person's pending draft",runCatching{SecureCheckoutDraft.decrypt(endpoint,other.text("id"),encrypted,key)}.isFailure)
  }
  val ownOther=JSONObject().put("version",2).put("value",CheckoutDraft("shared-delivery","Առաքում","B address","B contact","","Employee B").json())
  val otherEncrypted=SecureCheckoutDraft.encrypt(endpoint,others[0].text("id"),ownOther,key)
  assertEquals(ownOther.toString(),SecureCheckoutDraft.decrypt(endpoint,others[0].text("id"),otherEncrypted,key).toString())
  assertTrue(runCatching{SecureCheckoutDraft.decrypt(endpoint,author.text("id"),otherEncrypted,key)}.isFailure)
 }
}
