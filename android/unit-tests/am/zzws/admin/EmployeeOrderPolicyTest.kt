package am.zzws.admin

import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

/** Fallback authority never changes the author or the signed-in personal account. */
class EmployeeOrderPolicyTest {
 private val company="610000-company"
 private val orderId="11111111-1111-4111-8111-111111111111"
 private fun account(id:String,clientRole:String="employee")=JSONObject().put("id",id).put("role","client").put("clientRole",clientRole).put("customerId",company).put("customerCode","610000")
 private fun order()=JSONObject().put("id",orderId).put("number",123).put("user_id","employee-a").put("customer_id",company).put("revision",4).put("status","confirmed").put("approval",JSONObject().put("id","proposal").put("state","pending").put("lines",JSONArray().put(JSONObject().put("articul","A")).put(JSONObject().put("articul","B"))))

 @Test fun authorAndCompanyPrimaryCanAnswerWithoutImpersonation(){
  val author=account("employee-a");val proposal=order()
  assertTrue(clientCanReviewApproval(author,proposal))
  val primary=account(company,"manager");assertTrue(clientCanReviewApproval(primary,proposal));assertTrue(clientActsForOrderAuthor(primary,proposal))
  val primaryPayload=approvalResponsePayload(primary,proposal,"accept",listOf("B"),"primary-request")
  assertFalse(primaryPayload.has("userId"));assertFalse(primaryPayload.has("author"));assertEquals("employee-a",proposal.text("user_id"))
  for(viewer in listOf(account("employee-b"),account("employee-b","manager"),account("other-company","manager"),account(company,"employee"))){
   assertEquals(author.text("customerId"),viewer.text("customerId"))
   assertFalse(clientCanReviewApproval(viewer,proposal))
   for(decision in listOf("accept","reject"))assertTrue(runCatching{approvalResponsePayload(viewer,proposal,decision,emptyList(),"request")}.isFailure)
  }
  val payload=approvalResponsePayload(author,proposal,"accept",listOf("B"),"request")
  assertEquals(4,payload.getInt("revision"));assertEquals("proposal",payload.getString("proposalId"));assertEquals("B",payload.getJSONArray("declinedArticuls").getString(0))
  assertEquals(setOf("orderId","revision","proposalId","decision","declinedArticuls","requestId"),payload.keys().asSequence().toSet())
 }

 @Test fun receiptCannotReuseAnotherActorsConfirmationDespiteCompanyFallbackAuthority()=runBlocking{
  val author=account("employee-a");val eligible=order().also{it.remove("approval")}
  val frozen=ReceiptConfirmation(author.text("id"),orderId,123,4,RECEIPT_STATEMENT)
  assertTrue(clientCanConfirmReceipt(author,eligible))
  for(viewer in listOf(account("employee-b"),account("other-company","manager"))){
   assertFalse(clientCanConfirmReceipt(viewer,eligible))
   val calls=mutableListOf<String>()
   val preparation=runCatching{prepareClientReceipt(viewer,orderId,{path,_->calls.add(path);JSONObject().put("order",eligible)},4)}
   assertTrue(preparation.isFailure);assertEquals(listOf("orders/detail"),calls)
   calls.clear()
   assertTrue(runCatching{submitClientReceipt(viewer,frozen,true,{path,_->calls.add(path);throw AssertionError("Foreign receipt reached transport")})}.isFailure)
   assertTrue("Account change must be rejected before any API call",calls.isEmpty())
  }
  val primary=account(company,"manager")
  val prepared=prepareClientReceipt(primary,orderId,{path,_->if(path=="orders/detail")JSONObject().put("order",eligible)else JSONObject().put("statement",RECEIPT_STATEMENT)},4)
  val primaryConfirmation=prepared.confirmation!!
  assertEquals(company,primaryConfirmation.userId);assertTrue(primaryConfirmation.actingForAuthor);assertEquals("employee-a",prepared.order.text("user_id"))
  var reached=false;assertTrue(runCatching{submitClientReceipt(primary,frozen,true,{_,_->reached=true;eligible})}.isFailure);assertFalse(reached)
  val received=JSONObject(eligible.toString()).put("received_at","2026-11-01T12:00:00Z").put("status","received")
  val result=submitClientReceipt(primary,primaryConfirmation,true,{path,body->assertEquals("orders/receipt",path);assertEquals(setOf("id","revision","intact"),body!!.keys().asSequence().toSet());JSONObject().put("order",received)})
  assertEquals("employee-a",result.text("user_id"));assertEquals(company,primary.text("id"))
 }

 @Test fun provenanceShowsActualActorsAlongsideImmutableOriginalSender(){
  val value=order().put("customer",JSONObject().put("author",JSONObject().put("id","employee-a").put("firstName","Original").put("lastName","Employee")))
  val actor=JSONObject().put("id",company).put("firstName","Company").put("lastName","Primary").put("clientRole","manager").put("actingForAuthor",true)
  value.getJSONObject("approval").put("response",JSONObject().put("actor",actor)).put("deferredBy",actor);value.put("receipt",JSONObject().put("actor",actor));val before=value.toString();val fields=orderOriginFields(value)
  assertTrue(fields.any{it.label=="Ուղարկել է՝"&&it.value=="Original Employee"})
  for(label in listOf("Հաճախորդի պատասխանը գրանցել է՝","Դիտարկման ժամանակ է խնդրել՝","Ստացումը հաստատել է՝"))assertTrue(fields.any{it.label==label&&it.value=="Company Primary"})
  assertEquals(before,value.toString())
 }
}
