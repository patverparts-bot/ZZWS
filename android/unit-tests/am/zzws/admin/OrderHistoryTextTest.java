package am.zzws.admin;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;

public class OrderHistoryTextTest {
 private JSONObject actor()throws Exception{return new JSONObject().put("id","primary").put("role","client").put("login","primary-login").put("firstName","Actual Primary").put("clientRole","manager").put("actingForAuthor",true).put("email","private@example.am");}
 @Test public void normalizedHistoryWinsAndCollapsedHeadlineContainsNoDetailedFields()throws Exception{
  JSONObject event=new JSONObject().put("id","one").put("action","approved").put("actor",actor()).put("at","2026-11-01T15:29:00Z").put("lines",new JSONArray().put(new JSONObject().put("articul","SKU-A").put("name","Recognizable model ABC-123").put("kind","changed").put("before",new JSONObject().put("qty",1).put("unitPrice",100)).put("after",new JSONObject().put("qty",2).put("unitPrice",90))));
  JSONArray rows=OrderHistoryText.entries(new JSONObject().put("history",new JSONArray().put(event)).put("events",new JSONArray().put(new JSONObject().put("event_type","bad"))));assertEquals(1,rows.length());assertEquals("approved",rows.getJSONObject(0).getString("action"));String headline=OrderHistoryText.headline(event);assertFalse(headline.contains("SKU-A"));assertFalse(headline.contains("Actual Primary"));assertFalse(headline.contains("100"));assertTrue(OrderHistoryText.time(event).contains("19:29"));String expanded=String.join("\n",OrderHistoryText.details(event));assertTrue(expanded.contains("Actual Primary"));assertTrue(expanded.contains("SKU-A"));assertTrue(expanded.contains("Recognizable model ABC-123"));assertTrue(expanded.contains("100"));assertTrue(expanded.contains("90"));assertFalse(expanded.contains("private@example.am"));
 }
 @Test public void missingLegacyActorAndPriceNeverBecomeInventedAdminOrZero()throws Exception{
  JSONObject raw=new JSONObject().put("revision",3).put("event_type","unrecognized").put("changes",new JSONObject().put("integration",new JSONObject().put("before","private-proof").put("after","secret")));
  JSONObject e=OrderHistoryText.entries(new JSONObject().put("events",new JSONArray().put(raw))).getJSONObject(0);assertEquals("unknown",e.getString("action"));assertTrue(e.isNull("actor"));assertFalse(String.join("\n",OrderHistoryText.details(e)).contains("private-proof"));
  e.put("lines",new JSONArray().put(new JSONObject().put("articul","unknown-price").put("kind","added").put("before",JSONObject.NULL).put("after",new JSONObject().put("qty",1).put("unitPrice",JSONObject.NULL))));String body=String.join("\n",OrderHistoryText.details(e));assertTrue(body.contains("—"));assertFalse(body.contains("0 ֏"));
 }
 @Test public void rawProposalKeepsProposedBeforeAfterAndDoesNotExposeInternalJson()throws Exception{
  JSONObject before=new JSONObject().put("articul","A").put("qty",1).put("unitPrice",100),after=new JSONObject().put("articul","A").put("qty",2).put("unitPrice",90);
  JSONObject raw=new JSONObject().put("revision",2).put("event_type","order.updated").put("source","approval_requested").put("actor",new JSONObject().put("id","admin").put("role","admin").put("login","fixture-admin")).put("snapshot",new JSONObject().put("approval",new JSONObject().put("beforeLines",new JSONArray().put(before)).put("lines",new JSONArray().put(after))).put("integration","private-proof"));
  JSONObject e=OrderHistoryText.entries(new JSONObject().put("events",new JSONArray().put(raw))).getJSONObject(0);assertEquals("proposal",e.getString("action"));assertTrue(e.getBoolean("proposed"));String body=String.join("\n",OrderHistoryText.details(e));assertTrue(body.contains("fixture-admin"));assertTrue(body.contains("100"));assertTrue(body.contains("90"));assertFalse(body.contains("private-proof"));assertFalse(body.contains("approval_requested"));
 }
 @Test public void receiptDeferRejectAndDemoFallbackAreHonestAndExplicitEmptyHistoryStaysEmpty()throws Exception{
  for(String action:new String[]{"created","proposal","approved","declined","deferred","received","reopened","status_changed","updated","unknown"})assertFalse(OrderHistoryText.headline(new JSONObject().put("action",action)).isEmpty());
  JSONObject deferred=new JSONObject().put("action","deferred").put("actor",actor()).put("minutes",5).put("declinedArticuls",new JSONArray().put("SKU-B"));String body=String.join("\n",OrderHistoryText.details(deferred));assertTrue(body.contains("5"));assertTrue(body.contains("SKU-B"));assertTrue(body.contains("Actual Primary"));
  DemoStore demo=new DemoStore();JSONObject e=OrderHistoryText.entries(new JSONObject().put("events",demo.history(demo.orders.getJSONObject(0).getString("id")))).getJSONObject(0);assertEquals("created",e.getString("action"));assertTrue(e.isNull("actor"));assertEquals(0,OrderHistoryText.entries(new JSONObject().put("history",new JSONArray()).put("events",new JSONArray().put(e))).length());
 }
}
