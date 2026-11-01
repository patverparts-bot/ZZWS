package am.zzws.admin
import org.junit.Assert.*
import org.junit.Test
class OrderDataExportTest {
 @Test fun singleExportCarriesOnlyTheOrderAndCurrentUiLanguage(){val p=orderExportRequest("order-id",Triple("hidden","2026-01-01","2026-12-31"),"ru");assertEquals("order-id",p.getString("id"));assertEquals("ru",p.getString("locale"));assertFalse(p.has("filters"));assertEquals(2,p.length())}
 @Test fun allOrdersDoesNotInheritPaginationOrDraftSearch(){val p=orderExportRequest(null,null,"hy");assertEquals(1,p.length());assertEquals("hy",p.getString("locale"))}
 @Test fun filteredExportKeepsOnlyAppliedSearchAndDates(){val p=orderExportRequest(null,Triple(" 001234 ","2026-11-01",""),"ru");val f=p.getJSONObject("filters");assertEquals("001234",f.getString("search"));assertEquals("2026-11-01",f.getString("from"));assertFalse(f.has("to"));assertFalse(p.has("before"))}
}
