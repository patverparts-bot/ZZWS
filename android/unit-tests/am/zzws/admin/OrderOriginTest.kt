package am.zzws.admin
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class OrderOriginTest {
 private fun sample()=JSONObject().put("customer",JSONObject().put("client","Company at submission").put("customerCode","001234").put("author",JSONObject().put("firstName","Karen").put("lastName","Grigoryan").put("phone","+37499123456").put("email","old@example.am"))).put("delivery",JSONObject().put("organization","Branch 2").put("contact","Different delivery recipient"))
 @Test fun identifiesTheCompanyEmployeeAndTheirOwnContacts(){
  val fields=orderOriginFields(sample());assertEquals("Company at submission",fields.first().value);assertTrue(fields.first().primary)
  assertTrue(fields.any{it.label=="Ուղարկել է՝"&&it.value=="Karen Grigoryan"});assertTrue(fields.any{it.value=="001234"});assertTrue(fields.any{it.value=="Branch 2"});assertTrue(fields.any{it.value=="+37499123456"});assertTrue(fields.any{it.value=="old@example.am"})
  assertFalse(fields.any{it.value=="Different delivery recipient"})
 }
 @Test fun assistedOrdersIdentifyTheActualAdministratorSeparatelyFromTheCustomerContact(){
  val o=sample().put("created_by",JSONObject().put("name","Order operator").put("login","operator.login"));val fields=orderOriginFields(o)
  assertTrue(fields.any{it.label=="Հաճախորդի անունից լրացրել է՝"&&it.value=="Order operator"});assertTrue(fields.any{it.label=="Հաճախորդի կոնտակտ՝"&&it.value=="Karen Grigoryan"});assertTrue(fields.any{it.value=="operator.login"});assertFalse(fields.any{it.label=="Ուղարկել է՝"})
 }
 @Test fun legacyOrdersUseTheirStoredLoginWithoutGuessingAPerson(){
  val o=JSONObject().put("customer",JSONObject().put("client","Legacy customer").put("login","001000"));val fields=orderOriginFields(o)
  assertTrue(fields.any{it.label=="Ուղարկողի մուտքանունը՝"&&it.value=="001000"});assertFalse(fields.any{it.label=="Ուղարկել է՝"})
 }
 @Test fun missingHistoricalNamesAreStatedExplicitly(){
  val o=sample();o.getJSONObject("customer").remove("author");val fields=orderOriginFields(o)
  assertTrue(fields.any{it.value=="Ուղարկողի անունը չի պահպանվել։"});assertTrue(fields.any{it.value=="Company at submission"});assertFalse(fields.any{it.label=="Հեռախոս՝"||it.label=="Էլ․ փոստ՝"})
 }
 @Test fun nullAndEmptySnapshotsDoNotProduceBlankRowsOrNullText(){
  val fields=orderOriginFields(JSONObject().put("customer",JSONObject.NULL).put("created_by",JSONObject.NULL));assertTrue(fields.all{it.value.isNotBlank()&&it.value!="null"});assertTrue(fields.any{it.value=="Հաճախորդի տվյալները չեն պահպանվել։"})
 }
 @Test fun fieldExtractionPreservesTheSnapshotAndLeadingZeroCodes(){
  val o=sample();val before=o.toString();orderOriginFields(o);assertEquals(before,o.toString());assertTrue(orderOriginFields(o).any{it.value=="001234"})
 }
}
