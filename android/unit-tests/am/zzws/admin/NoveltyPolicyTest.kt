package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class NoveltyPolicyTest {
 private val now=Instant.parse("2026-11-02T08:00:00Z").toEpochMilli()
 private fun row(code:String="00001",fresh:Boolean=true,available:Boolean=true,until:String="2026-11-03T08:00:00Z")=Product(JSONObject().put("articul",code).put("isNew",fresh).put("stockAvailable",available).put("newUntil",until))
 @Test fun serverFlagsDefineNoveltiesWithoutInferringThemFromPublicationOrLocalHistory(){
  val ordinary=row(fresh=false);ordinary.data.put("introducedAt","2026-11-02T07:59:00Z");assertFalse(isNovelty(ordinary,now));assertTrue(isNovelty(row(),now))
 }
 @Test fun expiredAndMalformedDeadlinesAreExcludedAtTheSameBoundaryAsTheWebsite(){
  assertFalse(isNovelty(row(until="2026-11-02T08:00:00Z"),now));assertFalse(isNovelty(row(until="bad"),now));assertTrue(isNovelty(row(until=""),now))
 }
 @Test fun explicitUnavailableWinsOverQuantityAndLegacyStockFallbackMatchesTheWebsite(){
  val hidden=row(available=false);hidden.data.put("targetWarehousesStock",10).put("stockStatus","Առկա է");assertFalse(isNovelty(hidden,now))
  val legacy=row();legacy.data.remove("stockAvailable");legacy.data.put("targetWarehousesStock",3);assertTrue(isNovelty(legacy,now));legacy.data.put("targetWarehousesStock",2);assertFalse(isNovelty(legacy,now));legacy.data.put("stockStatus","Առկա է");assertTrue(isNovelty(Product(legacy.data),now))
 }
 @Test fun onlyTheSuppliedAccountCatalogIsFilteredAndLeadingZeroArticlesStayIntact(){
  val goods=listOf(row(),row("old",fresh=false),row("hidden",available=false),row("expired",until="2026-11-01T00:00:00Z"));assertEquals(listOf("00001"),noveltyProducts(goods,now).map{it.code})
  assertEquals(Instant.parse("2026-11-03T08:00:00Z").toEpochMilli(),nextNoveltyExpiry(goods,now));assertTrue(noveltyProducts(emptyList(),now).isEmpty())
 }
}
