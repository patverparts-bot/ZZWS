package am.zzws.admin;
import org.junit.Test;import static org.junit.Assert.*;import java.util.*;
public class TranslationCatalogTest {
 private TranslationCatalog dictionary(){Map<String,String> values=new HashMap<>();values.put("Պահպանել","Сохранить");values.put("Պատվեր","Заказ");values.put("Պատվերներ","Заказы");values.put("Ընդամենը","Итого");return new TranslationCatalog(values);}
 @Test public void longestPhraseDoesNotConsumePluralAsShorterWord(){assertEquals("Заказы · Заказ №42",dictionary().translate("Պատվերներ · Պատվեր №42"));}
 @Test public void quantitiesPricesArticlesAndModelsStayExact(){assertEquals("Заказ №42 · Итого: 12 345.50 ֏ · 014676 · LG 65C4",dictionary().translate("Պատվեր №42 · Ընդամենը՝ 12 345.50 ֏ · 014676 · LG 65C4"));}
 @Test public void surroundingWhitespaceAndUnknownDataArePreserved(){assertEquals("  Сохранить\n",dictionary().translate("  Պահպանել\n"));assertEquals("ООО Пример · Main Street 42",dictionary().translate("ООО Пример · Main Street 42"));}
 @Test public void dictionaryConstructionDoesNotMutateSourceValues(){Map<String,String> values=new HashMap<>();values.put("Պատվեր","Заказ");TranslationCatalog catalog=new TranslationCatalog(values);catalog.translate("Պատվեր №7");assertEquals("Заказ",values.get("Պատվեր"));assertEquals(1,values.size());}
 @Test public void catalogMenuAndDynamicLabelsUseShippedRussianDictionary() throws Exception {
  org.json.JSONObject data=new org.json.JSONObject(new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get("assets/i18n-ru.json")),java.nio.charset.StandardCharsets.UTF_8));
  Map<String,String> values=new HashMap<>();java.util.Iterator<String> keys=data.keys();while(keys.hasNext()){String key=keys.next();values.put(key,data.getString(key));}
  TranslationCatalog catalog=new TranslationCatalog(values);
  assertEquals("Меню",catalog.translate("Մենյու"));
  assertEquals("23 товаров",catalog.translate("23 ապրանք"));
  assertEquals("Фильтры · 3",catalog.translate("Զտիչներ · 3"));
  assertEquals("Заказчик: ACME 014676",catalog.translate("Պատվիրատու՝ ACME 014676"));
  for(String label:Arrays.asList("Ընտրել հաճախորդին","Բացել ZZWS կայքը","Կառավարում","Դուրս գալ","Ավելացնել","Ձեր գինը","Արտիկուլ, ապրանք կամ բրենդ"))assertFalse(label,catalog.translate(label).matches(".*[\\u0530-\\u058f].*"));
 }
}
