package am.zzws.admin;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Locale;
import java.util.Map;

/** Render only the bounded, recipient-scoped order summary sent by the worker. */
final class OrderPush {
 static String[] notice(Map<String,String> data,String language){
  if(!"order.created".equals(data.get("kind")))return null;
  String customer=data.get("customerName"),number=data.get("orderNumber"),amount=data.get("orderTotal");
  if(customer==null||customer.trim().isEmpty()||customer.length()>200||customer.matches("(?s).*[\\x00-\\x1f\\x7f].*")||number==null||!number.matches("[1-9][0-9]{0,15}")||amount==null||!amount.matches("(?:0|[1-9][0-9]{0,15})(?:\\.[0-9]{1,2})?"))return null;
  try{
   BigDecimal total=new BigDecimal(amount);if(total.compareTo(new BigDecimal("9007199254740991"))>0)return null;
   boolean ru="ru".equals(language);NumberFormat money=NumberFormat.getNumberInstance(ru?new Locale("ru","RU"):new Locale("hy","AM"));money.setMaximumFractionDigits(2);money.setMinimumFractionDigits(0);
   String price=money.format(total).replace('\u00a0',' ').replace('\u202f',' ')+" ֏";
   return new String[]{(ru?"Новый заказ №":"Նոր պատվեր №")+number,customer.trim()+(ru?" оформил заказ на ":" ձևակերպել է պատվեր՝ ")+price};
  }catch(NumberFormatException invalid){return null;}
 }
}
