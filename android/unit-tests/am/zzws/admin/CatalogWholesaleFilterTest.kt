package am.zzws.admin
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CatalogWholesaleFilterTest {
 private fun product(code:String,ws:Any=JSONObject.NULL,kp:Any=100.0,brand:String="LG",stock:Boolean=true,promo:Boolean=true,kpPromo:Boolean=false)=Product(JSONObject().put("articul",code).put("name","TV "+code).put("brand",brand).put("category","TV").put("wholesale",ws).put("kpPrice",kp).put("stockAvailable",stock).put("isWholesalePromo",promo).put("kpIsPromo",kpPromo))
 @Test fun adminFilterRequiresAnyFinitePositiveWsOrKp(){
  val products=listOf(product("ws",12.0,0.0),product("kp-only",0.0),product("kp-promo-only",0.0,56.0,kpPromo=true),product("null",JSONObject.NULL,0.0),product("negative",-1.0,-1.0),product("nan","NaN",0.0),product("infinite","Infinity",0.0),product("missing",JSONObject.NULL,0.0).also{it.data.remove("wholesale")},product("kp-with-invalid-ws","NaN",18.0),product("both-invalid","NaN","NaN"),product("kp-infinite",0.0,"Infinity"),product("ws-with-invalid-kp",19.0,"NaN"))
  assertEquals(listOf("ws","kp-only","kp-promo-only","kp-with-invalid-ws","ws-with-invalid-kp"),wholesalePricedProducts(products,true,true).map{it.code})
  assertEquals(products,wholesalePricedProducts(products,false,true));assertEquals(products,wholesalePricedProducts(products,true,false))
 }
 @Test fun eitherWholesaleConditionComposesWithSearchBrandStockAndPromotionAndAddsOneActiveFilter(){
  val products=listOf(product("001",12.0),product("002",0.0),product("003",20.0,brand="Sony"),product("004",30.0,stock=false),product("005",40.0,promo=false),product("006",0.0,0.0))
  val selected=CatalogFilters(brands=setOf("LG"),onlyAvailable=true,onlyPromo=true,onlyWholesale=true)
  assertEquals(4,selected.activeCount);assertEquals(2,catalogFilterCount(products,"",selected,allowWholesale=true))
  assertEquals(3,catalogFilterCount(products,"",selected,allowWholesale=false));assertEquals(1,catalogFilterCount(products,"002",selected,allowWholesale=true));assertEquals(1,catalogFilterCount(products,"001",selected,allowWholesale=true))
 }
}
