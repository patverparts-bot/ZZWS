package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class HomeCategoriesTest {
 private fun product(code:String,category:String)=Product(JSONObject().put("articul",code).put("category",category))
 @Test fun englishDishwashersStaySeparateFromWashersAndRetainTheirExactCategoryChoices(){
  val products=listOf(product("washer","Washers"),product("washing","Washing machines"),product("dishwasher","Dishwashers"),product("builtin-dishwasher","Built-in dishwasher"))
  val groups=majorHomeGroups(products)
  assertEquals(listOf("washer","washer","dishwasher","dishwasher"),products.map{it.department})
  assertEquals(listOf("Dishwashers","Built-in dishwasher"),groups.first{it.category.id=="dishwasher"}.categories)
  assertEquals(2,groups.first{it.category.id=="washer"}.count)
  assertEquals(2,groups.first{it.category.id=="dishwasher"}.count)
 }
 @Test fun homeAlwaysPresentsTheSixMajorFamiliesInsteadOfTelevisionSizes(){
  val products=listOf(product("tv1","Հեռուստացույց >85"),product("tv2","Հեռուստացույց 65"),product("w","Լվացքի մեքենաներ"),product("d","Սպասք լվացող մեքենաներ"),product("h","Ներկառուցվող (Գազօջախներ)"),product("o","Ներկառուցվող վառարաններ"),product("f","Սառնարաններ"),product("a","Ճարպաջեռոց օդային"),product("m","Միկրոալիքային վառարաններ"))
  val groups=majorHomeGroups(products)
  assertEquals(listOf("tv","washer","dishwasher","hob","oven","fridge"),groups.map{it.category.id})
  assertEquals(listOf(2,1,1,1,1,1),groups.map{it.count})
  assertEquals(listOf("Ներկառուցվող վառարաններ"),groups.first{it.category.id=="oven"}.categories)
  assertNull(majorHomeCategoryId("Ճարպաջեռոց օդային"));assertNull(majorHomeCategoryId("Միկրոալիքային վառարաններ"));assertNull(majorHomeCategoryId("Գազօջախներ"))
 }
 @Test fun emptyGroupsNeverExpandIntoAllProductsAndUnknownAvailabilityIsHonest(){
  assertEquals(6,majorHomeGroups(emptyList()).size);assertTrue(majorHomeGroups(emptyList()).all{it.count==0&&it.categories.isEmpty()})
  assertEquals("Ճշտել",productAvailabilityLabel(Product(JSONObject().put("stockAvailable",false))))
  assertEquals("Առկա է",productAvailabilityLabel(Product(JSONObject().put("stockAvailable",true))))
  assertEquals("Պատվերով",productAvailabilityLabel(Product(JSONObject().put("stockStatus","Պատվերով").put("stockAvailable",false))))
  assertEquals("Ջեռոցներ",majorHomeSelectionTitle(listOf("Ներկառուցվող վառարաններ")))
  assertNull(majorHomeSelectionTitle(listOf("Ներկառուցվող վառարաններ","Լվացքի մեքենաներ")))
 }
}
