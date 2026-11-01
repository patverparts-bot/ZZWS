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
 @Test public void otherKindsKeepTheirExistingNotificationRules(){Map<String,String> d=data();d.put("kind","order.status");assertNull(OrderPush.notice(d,"ru"));}
}
