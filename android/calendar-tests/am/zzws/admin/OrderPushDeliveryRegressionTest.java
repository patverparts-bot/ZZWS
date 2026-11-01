package am.zzws.admin;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import com.google.firebase.messaging.RemoteMessage;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class OrderPushDeliveryRegressionTest {
 private final String owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",event="33333333-3333-4333-8333-333333333333",order="44444444-4444-4444-8444-444444444444";
 private RemoteMessage message(String recipient){RemoteMessage.Builder b=new RemoteMessage.Builder("test-sender").addData("eventId",event).addData("kind","order.created").addData("orderId",order).addData("customerName","Նոր աշխարհ").addData("orderNumber","18").addData("orderTotal","1015000");if(recipient!=null)b.addData("userId",recipient);return b.build();}
 @Test public void receivedPushShowsTheClientAmountAndOpensTheSameOrder(){
  Context c=RuntimeEnvironment.getApplication();L10n.setLanguage(c,"ru");c.getSharedPreferences("zzws_push",0).edit().clear().putBoolean("enabled",true).putString("userId",owner).commit();
  ZZWSMessagingService service=Robolectric.buildService(ZZWSMessagingService.class).create().get();service.onMessageReceived(message(owner));Notification n=Shadows.shadowOf(c.getSystemService(NotificationManager.class)).getNotification(event.hashCode());
  assertNotNull(n);assertEquals("Новый заказ №18",n.extras.getCharSequence(Notification.EXTRA_TITLE).toString());assertEquals("Նոր աշխարհ оформил заказ на 1 015 000 ֏",n.extras.getCharSequence(Notification.EXTRA_TEXT).toString());assertEquals(Notification.VISIBILITY_PRIVATE,n.visibility);
  android.content.Intent target=Shadows.shadowOf(n.contentIntent).getSavedIntent();assertEquals(order,target.getStringExtra("zzws_order"));assertEquals("order.created",target.getStringExtra("zzws_kind"));
  service.onMessageReceived(message(owner));assertSame(n,Shadows.shadowOf(c.getSystemService(NotificationManager.class)).getNotification(event.hashCode()));
 }
 @Test public void richPushForAnotherAccountOrMissingRecipientIsSuppressed(){
  Context c=RuntimeEnvironment.getApplication();c.getSharedPreferences("zzws_push",0).edit().clear().putBoolean("enabled",true).putString("userId",owner).commit();ZZWSMessagingService service=Robolectric.buildService(ZZWSMessagingService.class).create().get();
  service.onMessageReceived(message(other));service.onMessageReceived(message(null));assertNull(Shadows.shadowOf(c.getSystemService(NotificationManager.class)).getNotification(event.hashCode()));assertTrue(FirebaseAdapter.accept(c,event,owner));
 }
 @Test public void logoutPermissionAndAccountSwitchAreCheckedBeforeMarkingTheEventSeen(){
  Context c=RuntimeEnvironment.getApplication();android.content.SharedPreferences p=c.getSharedPreferences("zzws_push",0);p.edit().clear().putBoolean("enabled",false).putString("userId",owner).commit();assertFalse(FirebaseAdapter.accept(c,event,owner));p.edit().putBoolean("enabled",true).putString("userId",other).commit();assertFalse(FirebaseAdapter.accept(c,event,owner));assertTrue(FirebaseAdapter.accept(c,event,other));assertFalse(FirebaseAdapter.accept(c,event,other));
 }
}
