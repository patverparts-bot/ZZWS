package am.zzws.admin

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import java.io.IOException

class ReceiptWorkflowTest {
 private val id="11111111-1111-4111-8111-111111111111"
 private fun user(role:String="client",who:String="buyer")=JSONObject().put("id",who).put("role",role)
 private fun order(status:String="confirmed",revision:Int=4)=JSONObject().put("id",id).put("number",123).put("user_id","buyer").put("status",status).put("revision",revision)
 private fun received()=order("received",5).put("received_at","2026-10-30T10:00:00Z").put("receipt",JSONObject().put("intact",true).put("statement",RECEIPT_STATEMENT))
 private val target get()=ReceiptConfirmation("buyer",id,123,4,RECEIPT_STATEMENT)

 @Test fun customerCanConfirmOnlyOwnEligibleOrdersAndProofRequiresServerTimestamp(){
  for(status in listOf("confirmed","in_progress","completed"))assertTrue(clientCanConfirmReceipt(user(),order(status)))
  for(status in listOf("new","rejected","received"))assertFalse(clientCanConfirmReceipt(user(),order(status)))
  assertFalse(clientCanConfirmReceipt(user("admin"),order()));assertFalse(clientCanConfirmReceipt(user(who="other"),order()));assertFalse(clientCanConfirmReceipt(null,order()))
  assertTrue(receiptRecorded(received()));assertFalse(receiptRecorded(order("received")));assertFalse(clientCanConfirmReceipt(user(),received()))
 }
 @Test fun preparationRefreshesOrderAndLoadsStatementWithoutPostingReceipt()=runBlocking{
  val calls=mutableListOf<String>();val prepared=prepareClientReceipt(user(),id,{path,body->calls.add(path);if(path=="orders/detail"){assertEquals(id,body!!.getString("id"));JSONObject().put("order",order())}else JSONObject().put("statement","Server receipt statement")},expectedRevision=4)
  assertEquals(listOf("orders/detail","orders/receipt-state"),calls);assertEquals(4,prepared.confirmation!!.revision);assertEquals("Server receipt statement",prepared.confirmation.statement)
 }
 @Test fun changedOrderRequiresReviewBeforeOpeningConfirmation()=runBlocking{
  val calls=mutableListOf<String>();val prepared=prepareClientReceipt(user(),id,{path,_->calls.add(path);order(revision=5)},expectedRevision=4)
  assertTrue(prepared.needsReview);assertNull(prepared.confirmation);assertEquals(listOf("orders/detail"),calls)
 }
 @Test fun alreadyConfirmedOnAnotherDeviceUpdatesProofWithoutAnotherPost()=runBlocking{
  val calls=mutableListOf<String>();val prepared=prepareClientReceipt(user(),id,{path,_->calls.add(path);received()},expectedRevision=4)
  assertNull(prepared.confirmation);assertFalse(prepared.needsReview);assertTrue(receiptRecorded(prepared.order));assertEquals(listOf("orders/detail"),calls)
 }
 @Test fun falseAcknowledgementAndChangedAccountCannotSendReceipt()=runBlocking{
  var calls=0;val call:ReceiptCall={_,_->calls++;received()}
  assertTrue(runCatching{submitClientReceipt(user(),target,false,call)}.isFailure)
  assertTrue(runCatching{submitClientReceipt(user(who="other"),target,true,call)}.isFailure)
  assertTrue(runCatching{submitClientReceipt(user("admin"),target,true,call)}.isFailure)
  assertTrue(runCatching{prepareClientReceipt(user("admin"),id,call)}.isFailure);assertEquals(0,calls)
 }
 @Test fun acknowledgementUsesFrozenOrderAndRevisionInsteadOfCurrentScreen()=runBlocking{
  val result=submitClientReceipt(user(),target,true,{path,body->assertEquals("orders/receipt",path);assertEquals(id,body!!.getString("id"));assertEquals(4,body.getInt("revision"));assertTrue(body.getBoolean("intact"));assertFalse(body.has("userId"));JSONObject().put("order",received())})
  assertTrue(receiptRecorded(result));assertEquals("received",result.getString("status"))
 }
 @Test fun lostResponseIsReconciledWithoutPostingTwice()=runBlocking{
  val calls=mutableListOf<String>();val result=submitClientReceipt(user(),target,true,{path,_->calls.add(path);if(path=="orders/receipt")throw IOException("Lost response");JSONObject().put("order",received())})
  assertTrue(receiptRecorded(result));assertEquals(listOf("orders/receipt","orders/detail"),calls)
 }
 @Test fun revisionConflictRefreshesOrderAndNeverAcknowledgesNewRevisionAutomatically()=runBlocking{
  val calls=mutableListOf<String>();val error=runCatching{submitClientReceipt(user(),target,true,{path,_->calls.add(path);if(path=="orders/receipt")throw ApiClient.ApiError(409,"Changed");order(revision=5)})}.exceptionOrNull()
  assertTrue(error is ReceiptChanged);assertEquals(5,(error as ReceiptChanged).current.getInt("revision"));assertEquals(listOf("orders/receipt","orders/detail"),calls)
 }
 @Test fun revokedAccessAndUnconfirmedServerResponseNeverShowSuccess()=runBlocking{
  val calls=mutableListOf<String>();val error=runCatching{submitClientReceipt(user(),target,true,{path,_->calls.add(path);throw ApiClient.ApiError(403,"Revoked")})}.exceptionOrNull()
  assertTrue(error is ApiClient.ApiError);assertEquals(listOf("orders/receipt"),calls)
  assertTrue(runCatching{submitClientReceipt(user(),target,true,{_,_->order()})}.isFailure)
 }
}
