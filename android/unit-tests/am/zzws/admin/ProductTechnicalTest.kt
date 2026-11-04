package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import org.json.JSONArray
class ProductTechnicalTest{
 @Test fun cachePathsUseExactSkuAndCannotEscapeTheFolder(){assertEquals(69,technicalFile("001").length);assertNotEquals(technicalFile("001"),technicalFile("1"));assertFalse(technicalFile("../../other").contains("/"))}
 @Test fun remoteDocumentsCannotReplaceAnotherModelOrExceedLimit(){val bytes=data().toString().toByteArray();assertNotNull(checkedTechnicalDocument(bytes,"001","Samsung WW80T"));assertNull(checkedTechnicalDocument(bytes,"001","Samsung WW80T Plus"));assertNull(checkedTechnicalDocument(ByteArray(131073),"001","Samsung WW80T"));assertNull(checkedTechnicalDocument("bad json".toByteArray(),"001","Samsung WW80T"))}
 @Test fun primaryFieldsRemainBoundedAndNeverInventFacts(){val original=data();original.getJSONObject("products").getJSONArray("001").put(JSONArray().put(99).put(0).put(0));assertEquals(listOf(0),technicalProduct(original,"001","Samsung WW80T")!!.main)}
 private fun data(name:String="Samsung WW80T",source:String="https://www.zigzag.am/en/model.html",specs:JSONArray=JSONArray().put(JSONArray().put("Capacity").put("8 kg")))=JSONObject().put("schemaVersion",1).put("products",JSONObject().put("001",JSONArray().put(name).put(source).put("2026-10-30").put(specs)))
 @Test fun exactArticleAndVerifiedNameAreRequired(){assertNotNull(technicalProduct(data(),"001","Samsung WW80T"));assertNull(technicalProduct(data(),"1","Samsung WW80T"));assertNull(technicalProduct(data(),"001","Samsung WW80U"));assertNull(technicalProduct(data(),"001","Samsung WW80T Plus"))}
 @Test fun typographicNormalizationDoesNotLoseModelSuffixes(){assertNotNull(technicalProduct(data(),"001","ＳＡＭＳＵＮＧ WW80T"));assertNull(technicalProduct(data(),"001","Samsung WW80"))}
 @Test fun onlyTrustedHttpsSourcesAreUsed(){for(url in listOf("http://www.zigzag.am/a","https://other.example/a","https://www.zigzag.am.evil.example/a","https://user@www.zigzag.am/a","https://www.zigzag.am:444/a"))assertNull(technicalProduct(data(source=url),"001","Samsung WW80T"))}
 @Test fun unavailableOrEmptyFactsNeverBecomeInventedSpecifications(){assertNull(technicalProduct(data(specs=JSONArray()),"001","Samsung WW80T"));assertNull(technicalProduct(data().put("schemaVersion",2),"001","Samsung WW80T"));assertNull(technicalProduct(data(),"missing","Samsung WW80T"))}
 @Test fun originalTechnicalValuesAndDatesArePreserved(){val record=technicalProduct(data(),"001","Samsung WW80T")!!;assertEquals("2026-10-30",record.checkedAt);assertEquals(listOf("Capacity" to "8 kg"),record.specifications)}
}
