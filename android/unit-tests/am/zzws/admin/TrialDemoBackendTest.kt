package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import org.json.JSONArray
internal class TrialDemoBackendTest {
 private fun backend()=TrialDemoBackend(listOf(JSONObject().put("articul","0001").put("name","Demo product").put("wholesale",100)))
 @Test fun unknownArticlesAreReportedInsteadOfInventingPrices(){val result=backend().call("orders/quote",JSONObject().put("articuls",JSONArray(listOf("0001","missing"))));assertEquals(1,result.getJSONArray("products").length());assertEquals("missing",result.getJSONArray("unavailable").getString(0))}
 @Test fun demoSubmissionUsesAuthoritativeSamplePricesAndIsIdempotent(){val b=backend();val body=JSONObject().put("requestId","same-request").put("lines",JSONArray().put(JSONObject().put("articul","0001").put("qty",2).put("unitPrice",1))).put("delivery",JSONObject());val first=b.call("orders",body);val second=b.call("orders",body);assertEquals(200.0,first.getDouble("total"),0.0);assertEquals(first.getString("id"),second.getString("id"));assertEquals(1,b.call("orders",null).getJSONArray("orders").length())}
 @Test fun separateDemoSessionsDoNotShareOrders(){val b=backend();val body=JSONObject().put("requestId","x").put("lines",JSONArray().put(JSONObject().put("articul","0001").put("qty",1))).put("delivery",JSONObject());b.call("orders",body);assertEquals(0,backend().call("orders",null).getJSONArray("orders").length())}
 @Test(expected=IllegalArgumentException::class) fun demoNeverFallsThroughToAdminOrNetworkRoutes(){backend().call("admin/users",null)}
}
