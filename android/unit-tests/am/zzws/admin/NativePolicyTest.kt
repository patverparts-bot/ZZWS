package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
class NativePolicyTest{
 private fun product(code:String,brand:String,category:String,price:Int,available:Boolean=false,promo:Boolean=false)=Product(JSONObject().put("articul",code).put("name","Model $code").put("brand",brand).put("category",category).put("wholesale",price).put("kpPrice",price-10).put("stockAvailable",available).put("hasMainStock",true).put("kpIsPromo",promo))
 private val rows=listOf(product("001","LG","TV",100,true),product("002","Samsung","TV",80,false,true),product("003","LG","Washer",120))
 @Test fun customerCannotSwitchToAdminKpPrice(){assertEquals(100.0,nativePrice(rows[0],false,"KP",false),0.0);assertEquals(100.0,nativePrice(rows[0],true,"KP",true),0.0);assertEquals(90.0,nativePrice(rows[0],true,"KP",false),0.0)}
 @Test fun brandAndCategoryOptionsAreMutuallyConstrained(){assertEquals(listOf("LG"),brandChoices(rows,setOf("Washer")));assertEquals(listOf("TV"),categoryChoices(rows,setOf("Samsung")))}
 @Test fun selectedFiltersRemainVisibleSoTheyCanAlwaysBeUnchecked(){assertEquals(listOf("LG","Samsung"),brandChoices(rows,setOf("Washer"),setOf("LG","Samsung")));assertEquals(listOf("TV","Washer"),categoryChoices(rows,setOf("Samsung"),setOf("Washer")))}
 @Test fun filtersIntersectAndMainStockIsStrict(){val price={p:Product->p.price};assertEquals(listOf("001"),visibleProducts(rows,"",emptySet(),emptySet(),true,false,0,price).map{it.code});assertTrue(visibleProducts(rows,"",setOf("Samsung"),setOf("Washer"),false,false,0,price).isEmpty())}
 @Test fun adminPromoIncludesKpAndSortUsesSelectedPrice(){val price={p:Product->nativePrice(p,true,"KP",false)};assertEquals(listOf("002"),visibleProducts(rows,"",emptySet(),emptySet(),false,true,0,price).map{it.code});assertEquals(listOf("002","001","003"),visibleProducts(rows,"",emptySet(),emptySet(),false,false,1,price).map{it.code})}
 @Test fun codeKeepsLeadingZerosAndSearchIsCaseInsensitive(){assertEquals("001",rows[0].code);assertEquals(listOf("003"),visibleProducts(rows,"model 003",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})}
 @Test fun articleSearchRequiresFullMatch(){
  val products=rows+product("0019","LG","TV",130)
  assertEquals(listOf("001"),visibleProducts(products," 001 ",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})
  assertTrue(visibleProducts(products,"01",emptySet(),emptySet(),false,false,0){it.price}.isEmpty())
 }
 @Test fun availabilityUsesServerThresholdInsteadOfAnyPositiveStock(){
  assertFalse(Product(JSONObject().put("hasMainStock",true).put("stockAvailable",false).put("stockStatus","Ճշտել")).available)
  assertTrue(Product(JSONObject().put("stockAvailable",true).put("stockStatus","003: 3")).available)
  assertTrue(Product(JSONObject().put("stockStatus","Առկա է")).available)
  assertFalse(Product(JSONObject().put("hasMainStock",true).put("stockStatus","050: 100")).available)
 }
 @Test fun allFiltersIntersectWithMultiSelectAndSortInBothDirections(){
  val products=rows+product("004","Samsung","TV",70,true,true)+product("005","Sony","TV",60,true,true)
  assertEquals(listOf("004"),visibleProducts(products,"",setOf("LG","Samsung"),setOf("TV"),true,true,1){it.price}.map{it.code})
  assertEquals(listOf("003","001","002"),visibleProducts(rows,"",emptySet(),emptySet(),false,false,2){it.price}.map{it.code})
  assertEquals(listOf("001","002","003"),visibleProducts(rows,"",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})
 }
 @Test fun administrativePushOptionsAppearOnlyForOrderReaders(){
  val buyer=JSONObject().put("role","client").put("mobileAdminEnabled",true).put("permissions",org.json.JSONArray().put("orders:read"));assertFalse(notificationOptions(buyer).any{it.first.startsWith("admin_")})
  val owner=JSONObject().put("role","admin").put("mobileAdminEnabled",true).put("permissions",org.json.JSONArray().put("orders:read"));assertEquals(2,notificationOptions(owner).count{it.first.startsWith("admin_")});owner.put("mobileAdminEnabled",false);assertFalse(notificationOptions(owner).any{it.first.startsWith("admin_")})
 }
}
