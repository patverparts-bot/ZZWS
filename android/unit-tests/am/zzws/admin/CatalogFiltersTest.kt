package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject

class CatalogFiltersTest {
 @Test fun searchHandlesLargeListsCaseAndWhitespaceWithoutHidingSelectedValues(){
  val options=(1..1000).map{"Brand $it"}
  assertEquals(listOf("Brand 821"),searchableFilterChoices(options,emptySet()," bRaNd 821 ",false))
  assertEquals(listOf("Legacy"),searchableFilterChoices(options,setOf("Legacy"),"",true))
  assertEquals(listOf("Brand 12"),searchableFilterChoices(options,setOf("Brand 12","Brand 821"),"12",true))
 }
 @Test fun selectingAnItemKeepsItsPositionAndPreservesBlankOption(){
  val options=listOf("Samsung","","LG","LG")
  assertEquals(searchableFilterChoices(options,emptySet(),"",false),searchableFilterChoices(options,setOf("Samsung"),"",false))
  assertEquals(listOf(""),searchableFilterChoices(options,setOf(""),"Նշված",false))
 }
 @Test fun draftChangesDoNotMutateAppliedSelectionsAndResetIncludesSorting(){
  val applied=CatalogFilters(setOf("LG"),setOf("TV"),true,false,2)
  val draft=applied.copy(brands=applied.brands+"Samsung",onlyPromo=true)
  assertEquals(setOf("LG"),applied.brands);assertEquals(4,applied.activeCount);assertEquals(6,draft.activeCount)
  assertEquals(0,CatalogFilters().activeCount)
 }
 @Test fun previewCountIncludesSearchMultiSelectAndAvailability(){
  val products=listOf("LG" to true,"Samsung" to false,"Sony" to true).mapIndexed{i,(brand,stock)->Product(JSONObject().put("articul","00$i").put("name","TV $i").put("brand",brand).put("category","TV").put("stockAvailable",stock))}
  assertEquals(1,catalogFilterCount(products,"",CatalogFilters(brands=setOf("LG","Samsung"),onlyAvailable=true)))
  assertEquals(1,catalogFilterCount(products,"002",CatalogFilters()))
  assertEquals(0,catalogFilterCount(products,"002",CatalogFilters(brands=setOf("LG"))))
 }
}
