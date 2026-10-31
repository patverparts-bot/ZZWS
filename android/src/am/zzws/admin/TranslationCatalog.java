package am.zzws.admin;
import java.util.*;
/** Pure presentation dictionary; never used to alter API payloads or persisted identifiers. */
public final class TranslationCatalog {
 private final Map<String,String> exact;
 private final Map<Character,List<String>> prefixes=new HashMap<>();
 public TranslationCatalog(Map<String,String> values){exact=new HashMap<>(values);for(String key:exact.keySet()){if(key.trim().length()<2)continue;List<String> list=prefixes.get(key.charAt(0));if(list==null){list=new ArrayList<>();prefixes.put(key.charAt(0),list);}list.add(key);}for(List<String> list:prefixes.values())Collections.sort(list,(a,b)->Integer.compare(b.length(),a.length()));}
 public String translate(String value){
  if(value==null)return "";value=value.replace("\u00ad", "");String result=exact.get(value);if(result!=null)return result;String trimmed=value.trim();result=exact.get(trimmed);if(result!=null){int start=value.indexOf(trimmed);return value.substring(0,start)+result+value.substring(start+trimmed.length());}
  StringBuilder output=new StringBuilder();for(int i=0;i<value.length();){List<String> matches=prefixes.get(value.charAt(i));String match=null;if(matches!=null)for(String candidate:matches)if(value.startsWith(candidate,i)){match=candidate;break;}if(match!=null){output.append(exact.get(match));i+=match.length();}else{char c=value.charAt(i++);if(c=='\u0589')c='.';else if(c=='\u055d')c=':';else if(c=='\u055e')c='?';else if(c=='\u055c')c='!';output.append(c);}}return output.toString();
 }
}
