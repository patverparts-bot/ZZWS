package am.zzws.admin;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

/** Render only the bounded, recipient-scoped order summary sent by the worker. */
final class OrderPush {
 static String[] notice(Map<String,String> data,String language){
  String kind=data.get("kind");if(!("order.created".equals(kind)||"order.status".equals(kind)||"order.changed".equals(kind)||"order.comment".equals(kind)))return null;
  String customer=data.get("customerName"),number=data.get("orderNumber"),amount=data.get("orderTotal");
  String code=data.get("customerCode");
  if(customer==null||customer.trim().isEmpty()||customer.length()>200||customer.matches("(?s).*[\\x00-\\x1f\\x7f].*")||number==null||!number.matches("[1-9][0-9]{0,15}")||code!=null&&(code.trim().isEmpty()||code.length()>100||code.matches("(?s).*[\\x00-\\x1f\\x7f].*")))return null;
  boolean ru="ru".equals(language);String identity=customer.trim()+(code==null?"":" · "+code.trim());
  if(!"order.created".equals(kind)){
   String action=data.get("approvalAction"),title,body;
   if("requested".equals(action)){title=ru?"Нужно согласование":"Անհրաժեշտ է համաձայնություն";body=ru?"Администратор изменил заказ. Проверьте изменения и подтвердите или отклоните их.":"Ադմինիստրատորը փոխել է պատվերը։ Ստուգեք փոփոխությունները և հաստատեք կամ մերժեք դրանք։";}
   else if("approved".equals(action)){title=ru?"Клиент согласовал изменения":"Հաճախորդը համաձայնեցրել է";body=ru?"Клиент согласовал изменения. Можно оформлять заказ.":"Հաճախորդը համաձայնեցրել է փոփոխությունները։ Կարելի է ձևակերպել պատվերը։";}
   else if("declined".equals(action)){title=ru?"Клиент отказался от заказа":"Հաճախորդը հրաժարվել է պատվերից";body=ru?"Клиент отказался от заказа.":"Հաճախորդը հրաժարվել է պատվերից։";}
   else if("deferred".equals(action)){String minutes=data.get("reviewMinutes");if(minutes==null||!minutes.matches("(?:[1-9]|[1-5][0-9]|60)"))return null;title=ru?"Клиент попросил время":"Հաճախորդը ժամանակ է խնդրել";body=ru?"Клиент попросил время на обдумывание: "+minutes+" мин.":"Հաճախորդը ժամանակ է խնդրել դիտարկման համար՝ "+minutes+" րոպե։";}
   else if("received".equals(data.get("orderStatus"))){title=ru?"Получение подтверждено":"Ստացումը հաստատվել է";body=ru?"Клиент подтвердил получение заказа.":"Հաճախորդը հաստատել է պատվերի ստացումը։";}
   else if("order.comment".equals(kind)){title=ru?"Комментарий к заказу":"Պատվերի մեկնաբանություն";body=ru?"Добавлен комментарий к заказу.":"Պատվերին ավելացվել է մեկնաբանություն։";}
   else if("order.status".equals(kind)){title=ru?"Изменение статуса заказа":"Պատվերի կարգավիճակի փոփոխություն";body=ru?"Статус заказа изменён.":"Պատվերի կարգավիճակը փոխվել է։";String status=statusLabel(data.get("orderStatus"),ru);if(status!=null)body=(ru?"Статус заказа: ":"Պատվերի կարգավիճակ՝ ")+status+".";}
   else {title=ru?"Изменение заказа":"Պատվերի փոփոխություն";body=ru?"Состав или данные заказа изменены.":"Պատվերի կազմը կամ տվյալները փոխվել են։";}
   return new String[]{title+" №"+number,identity+"\n"+body};
  }
  if(amount==null||!amount.matches("(?:0|[1-9][0-9]{0,15})(?:\\.[0-9]{1,2})?"))return null;
  try{
   BigDecimal total=new BigDecimal(amount);if(total.compareTo(new BigDecimal("9007199254740991"))>0)return null;
   NumberFormat money=NumberFormat.getNumberInstance(ru?new Locale("ru","RU"):new Locale("hy","AM"));money.setMaximumFractionDigits(2);money.setMinimumFractionDigits(0);
   String price=money.format(total).replace('\u00a0',' ').replace('\u202f',' ')+" ֏";
   return new String[]{(ru?"Новый заказ №":"Նոր պատվեր №")+number,identity+(ru?" оформил заказ на ":" ձևակերպել է պատվեր՝ ")+price};
  }catch(NumberFormatException invalid){return null;}
 }
 private static String statusLabel(String value,boolean ru){if(value==null)return null;switch(value){case "new":return ru?"Новый":"Նոր";case "confirmed":return ru?"Подтверждён":"Հաստատված";case "in_progress":return ru?"Оформлен":"Ձևակերպված է";case "completed":return ru?"Выполнен":"Կատարված";case "received":return ru?"Получен":"Ստացված";case "rejected":return ru?"Отклонён":"Մերժված";default:return null;}}
}
