package am.zzws.admin;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.json.*;

/** Read-only text policy shared by the legacy Activity and Compose history. */
final class OrderHistoryText {
 private OrderHistoryText(){}
 private static String text(JSONObject o,String key){if(o==null||o.isNull(key))return "";Object v=o.opt(key);return v instanceof String?(String)v:"";}
 private static String tr(String value){return L10n.t(value);}
 private static Double finite(Object value){if(!(value instanceof Number))return null;double n=((Number)value).doubleValue();return Double.isFinite(n)?n:null;}
 private static Object json(Object value){return value==null?JSONObject.NULL:value;}
 static JSONArray entries(JSONObject response){
  JSONArray source=response==null?null:response.optJSONArray("history"),out=new JSONArray();boolean normalized=source!=null;
  if(source==null&&response!=null)source=response.optJSONArray("events");if(source==null)return out;
  for(int i=0;i<Math.min(source.length(),100);i++){JSONObject e=source.optJSONObject(i);if(e==null)continue;if(normalized)out.put(e);else try{out.put(legacy(e));}catch(JSONException ignored){}}
  return out;
 }
 private static JSONObject legacy(JSONObject e)throws JSONException{
  JSONObject detail=e.optJSONObject("detail"),snapshot=e.optJSONObject("snapshot"),changes=e.optJSONObject("changes");if(detail==null)detail=new JSONObject();if(snapshot==null)snapshot=new JSONObject();if(changes==null)changes=new JSONObject();
  JSONObject approval=snapshot.optJSONObject("approval");String source=text(e,"source"),kind=text(detail,"kind"),action="unknown";
  if("order.created".equals(text(e,"event_type")))action="created";
  else if("approval_requested".equals(source)||"approval_requested".equals(kind))action="proposal";
  else if("approval_deferred".equals(source)||"approval_deferred".equals(kind))action="deferred";
  else if("approval_response".equals(source)&&"approved".equals(text(approval,"state"))||"approval_approved".equals(kind))action="approved";
  else if("approval_response".equals(source)&&"declined".equals(text(approval,"state"))||"approval_declined".equals(kind))action="declined";
  else if("receipt".equals(source)||"receipt".equals(kind)||"order.received".equals(text(e,"event_type")))action="received";
  else if("closed_order_reopened".equals(source)||"closed_order_reopened".equals(kind))action="reopened";
  else if(changes.optJSONObject("status")!=null||!text(detail,"oldStatus").isEmpty()&&!text(detail,"oldStatus").equals(text(detail,"status")))action="status_changed";
  else if("order.updated".equals(text(e,"event_type"))||detail.optJSONArray("changes")!=null&&detail.optJSONArray("changes").length()>0)action="updated";
  JSONObject actor=e.optJSONObject("actor");if(actor==null)actor=detail.optJSONObject("actor");JSONObject extra=null;
  if(approval!=null){if("deferred".equals(action))extra=approval.optJSONObject("deferredBy");else if(approval.optJSONObject("response")!=null)extra=approval.optJSONObject("response").optJSONObject("actor");}
  if("received".equals(action)&&snapshot.optJSONObject("receipt")!=null)extra=snapshot.optJSONObject("receipt").optJSONObject("actor");
  if("created".equals(action)&&snapshot.optJSONObject("customer")!=null)extra=snapshot.optJSONObject("customer").optJSONObject("author");
  JSONObject safeActor=actor==null?null:new JSONObject();if(actor!=null){for(String key:new String[]{"id","role","login","firstName","lastName","clientRole"}){String v=text(actor,key);if(extra!=null&&!text(actor,"id").isEmpty()&&text(actor,"id").equals(text(extra,"id"))&&!text(extra,key).isEmpty())v=text(extra,key);if(!v.isEmpty())safeActor.put(key,v);}safeActor.put("actingForAuthor",extra!=null&&text(actor,"id").equals(text(extra,"id"))&&extra.optBoolean("actingForAuthor"));}
  JSONArray lines=new JSONArray();boolean proposed="proposal".equals(action);
  if(proposed&&approval!=null&&approval.optJSONArray("lines")!=null)lines=diff(approval.optJSONArray("beforeLines")!=null?approval.optJSONArray("beforeLines"):snapshot.optJSONArray("lines"),approval.optJSONArray("lines"));
  else if(changes.optJSONObject("lines")!=null)lines=diff(changes.optJSONObject("lines").optJSONArray("before"),changes.optJSONObject("lines").optJSONArray("after"));
  else if("created".equals(action))lines=diff(new JSONArray(),snapshot.optJSONArray("lines"));else if(detail.optJSONArray("changes")!=null)lines=detail.optJSONArray("changes");
  JSONObject status=changes.optJSONObject("status");if(status==null&&!text(detail,"oldStatus").isEmpty())status=new JSONObject().put("before",detail.opt("oldStatus")).put("after",json(detail.opt("status")));
  JSONArray fields=new JSONArray();for(String key:new String[]{"comment","delivery","confirmation"}){JSONObject change=changes.optJSONObject(key);if(change==null)continue;if("comment".equals(key))field(fields,key,change.opt("before"),change.opt("after"));else for(String name:new String[]{"method","date","address","organization","paymentDeadline"}){JSONObject a=change.optJSONObject("before"),b=change.optJSONObject("after");field(fields,key+"."+name,a==null?null:a.opt(name),b==null?null:b.opt(name));}}
  JSONObject response=approval==null?null:approval.optJSONObject("response");JSONArray declined=response==null?detail.optJSONArray("declinedArticuls"):response.optJSONArray("declinedArticuls");Object minutes=approval==null||approval.isNull("reviewRequestedMinutes")?detail.opt("minutes"):approval.opt("reviewRequestedMinutes");
  return new JSONObject().put("id",text(e,"id")).put("revision",e.optInt("revision")).put("at",text(e,"occurred_at").isEmpty()?text(e,"created"):text(e,"occurred_at")).put("action",action).put("actor",json(safeActor)).put("status",json(status)).put("lines",lines).put("proposed",proposed).put("declinedArticuls",declined==null?new JSONArray():declined).put("minutes","deferred".equals(action)?json(minutes):JSONObject.NULL).put("fields",fields);
 }
 private static void field(JSONArray out,String key,Object before,Object after)throws JSONException{if(fieldLabel(key)==null)return;String a=value(before),b=value(after);if(!a.equals(b))out.put(new JSONObject().put("key",key).put("before",json(before)).put("after",json(after)));}
 private static JSONArray diff(JSONArray before,JSONArray after)throws JSONException{
  LinkedHashMap<String,JSONObject>a=index(before),b=index(after);LinkedHashSet<String> ids=new LinkedHashSet<>(a.keySet());ids.addAll(b.keySet());JSONArray out=new JSONArray();
  for(String id:ids){JSONObject old=a.get(id),next=b.get(id);if(old!=null&&next!=null&&Objects.equals(finite(old.opt("qty")),finite(next.opt("qty")))&&Objects.equals(finite(old.opt("unitPrice")),finite(next.opt("unitPrice"))))continue;out.put(new JSONObject().put("articul",id).put("name",text(next,"name").isEmpty()?text(old,"name"):text(next,"name")).put("kind",old==null?"added":next==null?"removed":"changed").put("before",json(old)).put("after",json(next)));}return out;
 }
 private static LinkedHashMap<String,JSONObject> index(JSONArray values){LinkedHashMap<String,JSONObject> out=new LinkedHashMap<>();if(values!=null)for(int i=0;i<Math.min(values.length(),500);i++){JSONObject v=values.optJSONObject(i);if(v!=null&&!text(v,"articul").isEmpty())out.put(text(v,"articul"),v);}return out;}
 static String headline(JSONObject e){
  String role=text(e.optJSONObject("actor"),"role"),action=text(e,"action");
  switch(action){case "created":return tr("admin".equals(role)?"Ադմինիստրատորը ստեղծել է պատվերը":"client".equals(role)?"Հաճախորդը ստեղծել է պատվերը":"Պատվերը ստեղծվել է");case "proposal":return tr("Առաջարկվել են փոփոխություններ");case "approved":return tr("Հաճախորդը հաստատել է պատվերը");case "declined":return tr("Հաճախորդը հրաժարվել է պատվերից");case "deferred":return tr("Հաճախորդը ժամանակ է խնդրել");case "received":return tr("Ստացումը հաստատվել է");case "reopened":return tr("Պատվերը վերաբացվել է");case "updated":case "status_changed":return tr("admin".equals(role)?"Ադմինիստրատորը փոխել է պատվերը":"client".equals(role)?"Հաճախորդը փոխել է պատվերը":"Պատվերը փոփոխվել է");default:return tr("Պատվերի իրադարձություն");}
 }
 static String time(JSONObject e){String v=text(e,"at");try{return DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.of("Asia/Yerevan")).format(Instant.parse(v));}catch(Exception ignored){return v.isEmpty()?"—":v;}}
 static String actor(JSONObject e){JSONObject a=e.optJSONObject("actor");if(a==null)return tr("Կատարողը նշված չէ");String name=(text(a,"firstName")+" "+text(a,"lastName")).trim();if(name.isEmpty())name=text(a,"login");String role=text(a,"role"),label="admin".equals(role)?tr("Ադմինիստրատոր"):"system".equals(role)?tr("Համակարգ"):"client".equals(role)||!text(a,"clientRole").isEmpty()?tr("manager".equals(text(a,"clientRole"))?"Հաճախորդի հիմնական հաշիվ":"employee".equals(text(a,"clientRole"))?"Հաճախորդի աշխատակից":"Հաճախորդ"):"";String out=label+(label.isEmpty()||name.isEmpty()?"":" · ")+name;if(a.optBoolean("actingForAuthor"))out+=" · "+tr("Աշխատակցի փոխարեն");return out.isEmpty()?tr("Կատարողը նշված չէ"):out;}
 static List<String> details(JSONObject e){
  List<String> out=new ArrayList<>();out.add(tr("Կատարող")+"՝ "+actor(e));if(e.optBoolean("proposed"))out.add(tr("Առաջարկված փոփոխություններ"));JSONObject status=e.optJSONObject("status");if(status!=null)out.add(tr("Կարգավիճակ")+"՝ "+status(status.opt("before"))+" → "+status(status.opt("after")));
  JSONArray lines=e.optJSONArray("lines");if(lines!=null)for(int i=0;i<Math.min(lines.length(),500);i++){JSONObject c=lines.optJSONObject(i);if(c==null||text(c,"articul").isEmpty())continue;String kind=text(c,"kind");if(!Arrays.asList("added","removed","changed").contains(kind))continue;String name=text(c,"name");if(name.length()>500)name=name.substring(0,500);String identity=text(c,"articul")+(name.isEmpty()||name.equals(text(c,"articul"))?"":" · "+name);out.add(identity+" · "+tr("added".equals(kind)?"Ավելացված":"removed".equals(kind)?"Ջնջված":"Փոփոխված")+" · "+pair(c.optJSONObject("before"))+" → "+pair(c.optJSONObject("after")));}
  JSONArray declined=e.optJSONArray("declinedArticuls");if(declined!=null&&declined.length()>0){List<String> ids=new ArrayList<>();for(int i=0;i<Math.min(declined.length(),500);i++)if(declined.opt(i) instanceof String)ids.add(declined.optString(i));out.add(tr("Մերժված արտիկուլներ")+"՝ "+String.join(", ",ids));}
  Double minutes=finite(e.opt("minutes"));if(minutes!=null&&minutes>=1&&minutes<=60)out.add(tr("Դիտարկման ժամանակ")+"՝ "+String.format(Locale.ROOT,"%.0f",minutes)+" "+tr("րոպե"));
  JSONArray fields=e.optJSONArray("fields");if(fields!=null)for(int i=0;i<Math.min(fields.length(),30);i++){JSONObject c=fields.optJSONObject(i);if(c==null)continue;String label=fieldLabel(text(c,"key"));if(label!=null)out.add(tr(label)+"՝ "+value(c.opt("before"))+" → "+value(c.opt("after")));}return out;
 }
 private static String pair(JSONObject row){if(row==null)return "—";Double qty=finite(row.opt("qty")),price=finite(row.opt("unitPrice"));return (qty==null?"—":String.format(L10n.locale(),qty%1==0?"%.0f":"%.2f",qty))+" × "+(price==null?"—":String.format(L10n.locale(),price%1==0?"%,.0f ֏":"%,.2f ֏",price));}
 private static String value(Object v){return v==null||v==JSONObject.NULL?"—":v instanceof String?((String)v).isEmpty()?"—":(String)v:v instanceof Boolean||finite(v)!=null?String.valueOf(v):"—";}
 private static String status(Object v){String key=value(v);switch(key){case "new":return tr("Նոր");case "confirmed":return tr("Հաստատված");case "in_progress":return tr("Ձևակերպված է");case "completed":return tr("Առաքված է");case "rejected":return tr("Մերժված");case "received":return tr("Ստացված է");default:return key;}}
 private static String fieldLabel(String key){switch(key){case "comment":return "Մեկնաբանություն";case "delivery.method":case "confirmation.method":return "Առաքման եղանակ";case "delivery.date":case "confirmation.date":return "Առաքման ամսաթիվ";case "delivery.address":return "Առաքման հասցե";case "delivery.organization":return "Կազմակերպություն";case "delivery.paymentDeadline":case "confirmation.paymentDeadline":return "Վճարման վերջնաժամկետ";default:return null;}}
}
