package am.zzws.admin;
import org.junit.Test;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;
public class OrderPushTest {
 private Map<String,String> data(){Map<String,String> d=new HashMap<>();d.put("kind","order.created");d.put("customerName","Test LTD");d.put("orderNumber","18");d.put("orderTotal","1015000");return d;}
 @Test public void showsTheClientNumberAndActualAmountInBothLanguages(){
  String[] ru=OrderPush.notice(data(),"ru");assertEquals("Новый заказ №18",ru[0]);assertEquals("Test LTD оформил заказ на 1 015 000 ֏",ru[1]);assertTrue(OrderPush.notice(data(),"hy")[1].contains("Test LTD"));assertFalse(ru[1].contains("открой"));
 }
 @Test public void businessNamesAndDecimalAmountsArePreserved(){Map<String,String> d=data();d.put("customerName","Նոր աշխարհ");d.put("orderTotal","1250.50");String body=OrderPush.notice(d,"ru")[1];assertTrue(body.startsWith("Նոր աշխարհ "));assertTrue(body.contains("1 250,5 ֏"));}
 @Test public void malformedOrMissingSummaryNeverInventsAnAmount(){for(String bad:new String[]{"NaN","Infinity","-1","1e9","12.345","99999999999999999999"}){Map<String,String> d=data();d.put("orderTotal",bad);assertNull(OrderPush.notice(d,"ru"));}Map<String,String> d=data();d.remove("customerName");assertNull(OrderPush.notice(d,"hy"));d=data();d.put("customerName","Injected\nNew notification");assertNull(OrderPush.notice(d,"ru"));}
 @Test public void allOrderEventsShowIdentityNumberAndTheSpecificActionInBothLanguages(){
  for(String kind:new String[]{"order.created","order.status","order.changed","order.comment"})for(String language:new String[]{"ru","hy"}){Map<String,String>d=data();d.put("kind",kind);d.put("customerCode","00610000");String[] notice=OrderPush.notice(d,language);assertNotNull(notice);assertTrue(notice[0].contains("№18"));assertTrue(notice[1].contains("Test LTD · 00610000"));}
  for(String action:new String[]{"requested","approved","declined","deferred"})for(String language:new String[]{"ru","hy"}){Map<String,String>d=data();d.put("kind","order.status");d.put("customerCode","610000");d.put("approvalAction",action);d.put("reviewMinutes","12");String[] notice=OrderPush.notice(d,language);assertNotNull(notice);assertTrue(notice[0].contains("№18"));assertTrue(notice[1].contains("Test LTD · 610000"));if("deferred".equals(action))assertTrue(notice[1].contains("12"));if("ru".equals(language)&&"declined".equals(action))assertTrue(notice[0].contains("отказался"));}
 }
 @Test public void receiptAndStatusChangesRemainSpecificAndIdentityDoesNotDependOnTheAmount(){Map<String,String>d=data();d.put("kind","order.status");d.put("orderStatus","received");d.remove("orderTotal");String[] notice=OrderPush.notice(d,"ru");assertEquals("Получение подтверждено №18",notice[0]);assertTrue(notice[1].contains("Test LTD"));d.put("orderStatus","in_progress");assertTrue(OrderPush.notice(d,"ru")[1].contains("Оформлен"));assertTrue(OrderPush.notice(d,"hy")[1].contains("Ձևակերպված է"));assertEquals("in_progress",d.get("orderStatus"));}
 @Test public void invalidIdentityAndNonOrderEventsAreNeverRendered(){Map<String,String>d=data();d.put("customerCode","evil\ncode");assertNull(OrderPush.notice(d,"ru"));d=data();d.put("kind","catalog.offers");assertNull(OrderPush.notice(d,"ru"));d=data();d.put("kind","order.status");d.put("approvalAction","deferred");d.put("reviewMinutes","61");assertNull(OrderPush.notice(d,"ru"));}
}
