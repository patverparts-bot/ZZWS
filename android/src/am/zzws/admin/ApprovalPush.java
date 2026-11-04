package am.zzws.admin;
final class ApprovalPush {
 static String[] notice(String action,String minutes){
  if("requested".equals(action))return new String[]{"ZZWS — անհրաժեշտ է Ձեր համաձայնությունը","Ադմինիստրատորը փոխել է պատվերը։ Ստուգեք փոփոխությունները և հաստատեք կամ մերժեք դրանք։"};
  if("approved".equals(action))return new String[]{"ZZWS — հաճախորդը համաձայնեցրել է","Հաճախորդը համաձայնեցրել է փոփոխությունները։ Կարելի է ձևակերպել պատվերը։"};
  if("declined".equals(action))return new String[]{"ZZWS — հաճախորդը հրաժարվել է պատվերից","Հաճախորդը հրաժարվել է պատվերից"};
  if("deferred".equals(action)&&minutes!=null&&minutes.matches("(?:[1-9]|[1-5][0-9]|60)"))return new String[]{"ZZWS — հաճախորդը ժամանակ է խնդրել","Հաճախորդը ժամանակ է խնդրել դիտարկման համար՝ "+minutes+" րոպե։"};
  return null;
 }
}
