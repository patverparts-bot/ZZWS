package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import org.json.JSONArray
class ProductionPolicyTest {
 private fun line(code:String,qty:Int,price:Int)=JSONObject().put("articul",code).put("name",code).put("qty",qty).put("unitPrice",price)
 @Test fun receiptRequiresEligibleStatusAndNoPreviousConfirmation(){for(status in listOf("new","rejected","received"))assertFalse(canConfirmReceipt(JSONObject().put("status",status)));for(status in listOf("confirmed","in_progress","completed")){val o=JSONObject().put("status",status);assertTrue(canConfirmReceipt(o));o.put("received_at","2026-10-30T01:00:00Z");assertFalse(canConfirmReceipt(o))}}
 @Test fun removedAndReducedLinesKeepTheOriginalEvidence(){val o=JSONObject().put("original_lines",JSONArray().put(line("001",5,100)).put(line("002",2,50))).put("lines",JSONArray().put(line("001",4,90)).put(line("003",1,30)));val rows=orderLineViews(o);assertEquals(listOf("001","002","003"),rows.map{it.code});assertEquals(5,rows[0].originalQty);assertEquals(4,rows[0].qty);assertEquals(100.0,rows[0].originalPrice!!,0.0);assertTrue(rows[1].removed);assertNull(rows[2].originalQty)}
 @Test fun legacyOrdersDoNotInventOriginalQuantities(){val rows=orderLineViews(JSONObject().put("lines",JSONArray().put(line("001",2,100))));assertNull(rows[0].originalQty);assertEquals(2,rows[0].qty)}
 @Test fun closedOrdersUseTheWebReopenWorkflow(){for(status in listOf("completed","rejected","received"))assertFalse(canEditOrderStatus(JSONObject().put("status",status)));assertTrue(canEditOrderStatus(JSONObject().put("status","confirmed")))}
 @Test fun serverCartRoundTripRetainsMissingProductsAndOverstockQuantity(){val saved=cartMemory(mapOf("001" to 9999,"missing" to 123),emptyList(),"WS");assertEquals(mapOf("001" to 9999,"missing" to 123),memoryQuantities(saved));assertEquals(123,saved.getJSONObject("missing").getInt("qty"))}
 @Test fun multipleArticleSearchUsesUnionAndDoesNotMatchPartialArticle(){val rows=listOf("001","002","003").map{Product(JSONObject().put("articul",it).put("name","Model $it").put("wholesale",100))};assertEquals(listOf("001","003"),visibleProducts(rows,"001 003",emptySet(),emptySet(),false,false,0){it.price}.map{it.code});assertEquals(listOf("001","002"),visibleProducts(rows,"001,002,999",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})}
}
