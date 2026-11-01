package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CatalogPricePresentationTest {
 private fun product(ws:Any=1234567,kp:Any=7654321,promo:Boolean=false)=Product(JSONObject().put("wholesale",ws).put("kpPrice",kp).put("kpIsPromo",promo).put("retail",9999999))
 @Test fun bothAuthorizedPricesRemainSeparateWithoutChangingSelectedModeOrPromoValues(){
  val product=product(promo=true);val rows=adminCatalogPrices(product,"admin",false)
  assertEquals(listOf("Մեծածախ","Խոշոր գործընկերոջ գին"),rows.map{it.label})
  assertEquals(listOf(1234567.0,7654321.0),rows.map{it.amount});assertFalse(rows[0].promotion);assertTrue(rows[1].promotion)
  assertEquals(1234567.0,nativePrice(product,true,"WS",false),0.0);assertEquals(7654321.0,nativePrice(product,true,"KP",false),0.0)
 }
 @Test fun clientAndCustomerPreviewNeverReceiveThePurchasePricePairEvenWithExtraDtoFields(){
  for(role in listOf(null,"client","viewer","Admin"))assertTrue(adminCatalogPrices(product(),role,false).isEmpty())
  assertTrue(adminCatalogPrices(product(),"admin",true).isEmpty());assertTrue(showAdminCatalogPrices("admin",false))
 }
 @Test fun absentInvalidOrNonPositivePriceStaysMissingWithoutFallingBackToTheOtherPrice(){
  for(value in listOf(0,-5,"NaN","Infinity")){
   val rows=adminCatalogPrices(product(value,7654321,true),"admin",false);assertNull(rows[0].amount);assertEquals(7654321.0,rows[1].amount!!,0.0)
   val reverse=adminCatalogPrices(product(1234567,value,true),"admin",false);assertEquals(1234567.0,reverse[0].amount!!,0.0);assertNull(reverse[1].amount);assertFalse(reverse[1].promotion)
  }
  assertTrue(adminCatalogPrices(Product(JSONObject()),"admin",false).all{it.amount==null})
 }
}
