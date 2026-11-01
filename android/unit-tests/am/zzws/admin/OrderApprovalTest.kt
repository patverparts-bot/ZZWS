package am.zzws.admin
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
class OrderApprovalTest {
 private fun order()=JSONObject().put("id","order").put("user_id","buyer").put("revision",4).put("status","confirmed").put("approval",JSONObject().put("id","proposal").put("state","pending").put("lines",JSONArray().put(JSONObject().put("articul","A")).put(JSONObject().put("articul","B"))))
 private fun user(role:String="client",id:String="buyer")=JSONObject().put("id",id).put("role",role)
 @Test fun partialRefusalContainsOnlyDecisionAndFrozenRevision(){val p=approvalResponsePayload(user(),order(),"accept",listOf("B"),"request");assertEquals(4,p.getInt("revision"));assertEquals("proposal",p.getString("proposalId"));assertEquals("B",p.getJSONArray("declinedArticuls").getString(0));assertEquals(setOf("orderId","revision","proposalId","decision","declinedArticuls","requestId"),p.keys().asSequence().toSet());assertFalse(p.has("total"));assertFalse(p.has("lines"))}
 @Test fun onlyOwnerCanAnswerAndPendingBlocksOtherActions(){assertTrue(clientCanReviewApproval(user(),order()));assertFalse(clientCanReviewApproval(user("admin"),order()));assertFalse(clientCanReviewApproval(user(id="other"),order()));assertFalse(clientCanReviewApproval(null,order()));assertFalse(canConfirmReceipt(order()));assertFalse(canEditOrderStatus(order()))}
 @Test fun rejectAllIsExplicitAndInvalidSelectionsFail(){assertTrue(runCatching{approvalResponsePayload(user(),order(),"accept",listOf("A","B"),"r")}.isFailure);assertTrue(runCatching{approvalResponsePayload(user(),order(),"accept",listOf("unknown"),"r")}.isFailure);assertTrue(runCatching{approvalResponsePayload(user(),order(),"accept",listOf("A","A"),"r")}.isFailure);assertEquals(0,approvalResponsePayload(user(),order(),"reject",emptyList(),"r").getJSONArray("declinedArticuls").length())}
 @Test fun processingStatusRemainsVisibleAfterApproval(){val o=order();o.getJSONObject("approval").put("state","approved");assertTrue(approvalStatusLabel(o).isNotBlank());o.put("status","in_progress");assertEquals("",approvalStatusLabel(o));assertFalse(clientCanReviewApproval(user(),o));assertTrue(canEditOrderStatus(o))}
 @Test fun processingDisplayIsRenamedWithoutChangingReceiptOrTransitionRules(){val o=order();o.getJSONObject("approval").put("state","approved");o.put("status","in_progress");assertEquals("Ձևակերպված է",statusLabel(o.getString("status")));assertEquals("in_progress",o.getString("status"));assertTrue(canConfirmReceipt(o));assertTrue(canEditOrderStatus(o))}
}
