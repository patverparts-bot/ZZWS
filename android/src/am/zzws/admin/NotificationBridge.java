package am.zzws.admin;

import android.app.*;import android.content.*;import android.os.Build;
/** Adapter boundary for future authenticated FCM delivery. No fake push-registration token. */
final class NotificationBridge {
 static final String CHANNEL="zzws_orders";
 static void show(Context context,String title,String message,int id){
  show(context,title,message,id,"","");
 }
 static void show(Context context,String title,String message,int id,String kind,String orderId){
  L10n.initialize(context);showLocalized(context,L10n.t(title),L10n.t(message),id,kind,orderId);
 }
 /** Text is already localized; business names must never be translated as UI labels. */
 static void showLocalized(Context context,String title,String message,int id,String kind,String orderId){
  L10n.initialize(context);NotificationManager manager=context.getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel(CHANNEL,L10n.t("ZZWS պատվերների իրադարձություններ"),NotificationManager.IMPORTANCE_DEFAULT));
  Intent intent=new Intent(context,UnifiedActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("zzws_kind",kind);
  if(orderId!=null&&orderId.matches("[a-fA-F0-9-]{36}"))intent.putExtra("zzws_order",orderId);
  PendingIntent target=PendingIntent.getActivity(context,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder builder=new Notification.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_notification_partner).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(target).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE);
  try{manager.notify(id,builder.build());}catch(SecurityException ignored){}
 }
 static void clear(Context context){context.getSystemService(NotificationManager.class).cancelAll();}
}
