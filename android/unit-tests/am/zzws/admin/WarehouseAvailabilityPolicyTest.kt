package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class WarehouseAvailabilityPolicyTest {
 @Test fun everyProvidedWarehouseAndExactQuantityIsRetainedInOrder(){
  assertEquals(listOf(WarehouseCount("025","1"),WarehouseCount("026","47"),WarehouseCount("035","1"),WarehouseCount("003","0"),WarehouseCount("050","-2.50"),WarehouseCount("099","0007")),warehouseCounts("025:1, 026:47,035:1,003:0,050:-2.50,099:0007"))
  assertEquals(listOf(WarehouseCount("003",".5")),warehouseCounts(" 003 : .5 "))
  assertEquals(2,warehouseCounts("025:1,025:2")!!.size)
 }
 @Test fun localizedWordsMalformedAndPartialListsRemainFullTextInsteadOfInventedWarehouses(){
  for(value in listOf("", "Առկա է", "Ճշտել", "Нет в наличии", "Պատվերով՝ առաքում 7 օրից", "025:1,026:47,…", "025:1,", "025:1, not stock", "025:NaN", "025:Infinity", "Main: 47", "025:1;026:2", "025:1,5"))assertNull(value,warehouseCounts(value))
 }
 @Test fun stockPresentationReadsOnlyTheAuthorizedProjectionAndNeverHiddenRawWarehouseFields(){
  val product=Product(JSONObject().put("stockStatus","025:1,026:47").put("stockAvailable",true).put("stocks",JSONObject().put("hidden",999)))
  assertEquals(listOf(WarehouseCount("025","1"),WarehouseCount("026","47")),warehouseCounts(productAvailabilityLabel(product)))
  assertFalse(productAvailabilityLabel(product).contains("hidden"));assertFalse(productAvailabilityLabel(product).contains("999"))
  assertEquals("Ճշտել",productAvailabilityLabel(Product(JSONObject().put("stockAvailable",false).put("stocks",JSONObject().put("025",999)))))
 }
}
