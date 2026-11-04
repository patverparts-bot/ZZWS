package am.zzws.admin

import java.io.File
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*

class CatalogDepartmentsTest {
 private fun product(code:String,category:String)=Product(JSONObject().put("articul",code).put("name","Test $code").put("brand","Test").put("category",category))
 private fun catalogue():List<Product>{
  val source=JSONObject(File("unit-test-data/catalogue-categories.json").readText()).getJSONObject("categories")
  var serial=0
  return source.keys().asSequence().toList().flatMap{category->(0 until source.getInt(category)).map{product("SKU"+(++serial).toString().padStart(5,'0'),category)}}
 }
 @Test fun allSourceRowsRemainReachableAndNoCategoryIsDiscarded(){
  val products=catalogue();assertEquals(7237,products.size)
  val rows=visibleProducts(products,"",emptySet(),emptySet(),false,false,0){it.price}
  assertEquals(products.size,rows.size);assertEquals(products.map{it.code}.toSet(),rows.map{it.code}.toSet())
  assertEquals(402,categoryChoices(products,emptySet()).size)
  assertEquals(listOf("SKU07237"),visibleProducts(products,"SKU07237",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})
 }
 @Test fun departmentCountsReconcileExactlyToTheWholeCatalogue(){
  val products=catalogue();val departments=catalogDepartmentCounts(products)
  assertEquals(products.size,departments.sumOf{it.count})
  assertEquals(products.map{it.code}.toSet(),departments.flatMap{row->products.filter{it.department==row.department.id}.map{it.code}}.toSet())
  assertEquals("tv",departments.first().department.id);assertTrue(departments.size<25)
 }
 @Test fun realArmenianCategoriesGroupAppliancesSeparatelyFromTheirAccessories(){
  for(category in listOf("Հեռուստացույց 65","Հեռուստացույց >85"))assertEquals("tv",catalogDepartmentId(category))
  assertEquals("fridge",catalogDepartmentId("Ներկառուցվող սառնարաններ"));assertEquals("fridge",catalogDepartmentId("Սառցարաններ"))
  assertEquals("washer",catalogDepartmentId("Լվացքի մեքենաներ չորանոցներով"));assertEquals("dryer",catalogDepartmentId("Չորացնող մեքենաներ"))
  assertEquals("hood",catalogDepartmentId("Ներկառուցվող օդաքարշ պահարաններ"));assertEquals("hob",catalogDepartmentId("Ներկառուցվող (Գազօջախներ)"))
  for(category in listOf("Հեռուստացույցի կախիչ","Օդաքարշ պահարանների պարագաներ","Լվացքի մեքենաների պարագաներ"))assertEquals("accessories",catalogDepartmentId(category))
 }
 @Test fun unnamedAndNewCategoriesStayVisibleInOtherProducts(){
  val products=listOf(product("1",""),product("2","A new category"),product("3","TV"))
  assertEquals(2,catalogDepartmentCounts(products).first{it.department.id=="other"}.count)
  assertEquals(3,catalogDepartmentCounts(products).sumOf{it.count})
 }
 @Test fun reportedArticle510078IsFoundInTheFullCatalogueAndCookingDepartment(){
  val p=Product(JSONObject().put("articul","510078").put("name","Bosch BFL524MB2").put("brand","Bosch").put("category","Ներկառուցվող միկրոալիքային վառարաններ").put("wholesale",185000).put("stockAvailable",true))
  val products=catalogue()+p
  assertEquals("oven",p.department)
  for(query in listOf("510078","BFL524MB2","Bosch BFL524MB2"))assertEquals(listOf("510078"),visibleProducts(products,query,emptySet(),emptySet(),false,false,0){it.price}.map{it.code})
  assertEquals(listOf("510078"),visibleProducts(products.filter{it.department=="oven"},"510078",emptySet(),emptySet(),false,false,0){it.price}.map{it.code})
 }
 @Test fun foregroundRefreshDoesNotReplaceCheckoutOrUncertainSubmissionData(){
  for(screen in listOf("home","catalog","management","profile","orders"))assertTrue(canReloadCatalog(screen,false))
  assertFalse(canReloadCatalog("cart",false));assertFalse(canReloadCatalog("catalog",true));assertFalse(canReloadCatalog("cart",true))
 }
}
