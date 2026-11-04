package am.zzws.admin;
import android.content.*;import android.content.res.Configuration;import android.view.*;import android.widget.*;import android.app.Activity;import org.json.*;import java.io.*;import java.util.*;
public final class L10n {
 private static volatile String language="hy";private static TranslationCatalog catalog;private static boolean initialized=false;
 private static final WeakHashMap<TextView,Value> textSources=new WeakHashMap<>(),hintSources=new WeakHashMap<>();private static final WeakHashMap<View,Value> descriptions=new WeakHashMap<>();
 private static final class Value {String source,last;Value(String s,String l){source=s;last=l;}}
 private L10n(){}
 public static synchronized void initialize(Context context){if(initialized)return;language=context.getSharedPreferences("zzws_language",0).getString("language","hy");if(!"ru".equals(language))language="hy";Map<String,String> values=new HashMap<>();try(InputStream in=context.getAssets().open("i18n-ru.json")){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);JSONObject data=new JSONObject(out.toString("UTF-8"));Iterator<String> keys=data.keys();while(keys.hasNext()){String key=keys.next();values.put(key,data.getString(key));}}catch(Exception ignored){}catalog=new TranslationCatalog(values);initialized=true;}
 public static String language(){return language;}
 public static void setLanguage(Context context,String next){initialize(context);if(!"hy".equals(next)&&!"ru".equals(next))return;language=next;context.getSharedPreferences("zzws_language",0).edit().putString("language",next).apply();}
 public static String t(String text){return t(text,language);}
 public static String t(String text,String selected){return "ru".equals(selected)&&catalog!=null?catalog.translate(text):text==null?"":text;}
 public static Locale locale(){return "ru".equals(language)?new Locale("ru","RU"):new Locale("hy","AM");}
 /** Keep the Activity's window service/token while overriding only translated resources. */
 public static Context context(Context base){initialize(base);android.view.ContextThemeWrapper localized=new android.view.ContextThemeWrapper(base,base.getTheme());Configuration override=new Configuration();override.setLocale(locale());localized.applyOverrideConfiguration(override);return localized;}
 public static String[] labels(String[] original){String[] result=new String[original.length];for(int i=0;i<original.length;i++)result[i]=t(original[i]);return result;}
 public static void attach(Activity activity){initialize(activity);View decor=activity.getWindow().getDecorView();decor.getViewTreeObserver().addOnGlobalLayoutListener(()->apply(decor));apply(decor);}
 public static void apply(View view){
  if(view instanceof TextView){TextView text=(TextView)view;if(!(view instanceof EditText)){String current=text.getText().toString();Value previous=textSources.get(text);String source=previous!=null&&current.equals(previous.last)?previous.source:current;String translated=t(source);textSources.put(text,new Value(source,translated));if(!current.equals(translated))text.setText(translated);}CharSequence hint=text.getHint();if(hint!=null){String current=hint.toString();Value previous=hintSources.get(text);String source=previous!=null&&current.equals(previous.last)?previous.source:current;String translated=t(source);hintSources.put(text,new Value(source,translated));if(!current.equals(translated))text.setHint(translated);}}
  CharSequence desc=view.getContentDescription();if(desc!=null){String current=desc.toString();Value previous=descriptions.get(view);String source=previous!=null&&current.equals(previous.last)?previous.source:current;String translated=t(source);descriptions.put(view,new Value(source,translated));if(!current.equals(translated))view.setContentDescription(translated);}
  if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)apply(group.getChildAt(i));}
 }
 public static void languageButton(Activity activity,LinearLayout container){Button button=new Button(activity);button.setAllCaps(false);button.setText("Հայերեն / Русский");button.setContentDescription(t("Լեզու"));button.setOnClickListener(v->new android.app.AlertDialog.Builder(activity).setTitle("Հայերեն / Русский").setSingleChoiceItems(new String[]{"Հայերեն","Русский"},"ru".equals(language)?1:0,(dialog,which)->{setLanguage(activity,which==1?"ru":"hy");apply(activity.getWindow().getDecorView());dialog.dismiss();}).setNegativeButton(t("Չեղարկել"),null).show());container.addView(button,new LinearLayout.LayoutParams(-1,-2));}
}
