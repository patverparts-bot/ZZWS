package am.zzws.admin;
import android.content.Context;import android.view.View;import android.widget.*;import org.json.*;import org.junit.Before;import org.junit.Test;import org.junit.runner.RunWith;import org.robolectric.RobolectricTestRunner;import org.robolectric.RuntimeEnvironment;import org.robolectric.annotation.Config;import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28,application=android.app.Application.class)
public class OrderHistoryViewsRegressionTest {
 private Context context;
 @Before public void setup(){context=RuntimeEnvironment.getApplication();L10n.initialize(context);L10n.setLanguage(context,"hy");}
 private JSONObject event(String id)throws Exception{return new JSONObject().put("id",id).put("revision",4).put("at","2026-11-01T15:29:00Z").put("action","approved").put("actor",new JSONObject().put("id","primary").put("role","client").put("login","primary-login").put("firstName","Actual Primary").put("clientRole","manager").put("actingForAuthor",true)).put("lines",new JSONArray().put(new JSONObject().put("articul","SKU-A").put("name","Recognizable model ABC-123").put("kind","changed").put("before",new JSONObject().put("qty",1).put("unitPrice",100)).put("after",new JSONObject().put("qty",2).put("unitPrice",90))));}
 private TextView summary(LinearLayout root,int index){return (TextView)((LinearLayout)root.getChildAt(index)).getChildAt(0);}
 private LinearLayout body(LinearLayout root,int index){return (LinearLayout)((LinearLayout)root.getChildAt(index)).getChildAt(1);}
 private String allText(LinearLayout root){StringBuilder b=new StringBuilder();for(int i=0;i<root.getChildCount();i++)if(root.getChildAt(i) instanceof TextView)b.append(((TextView)root.getChildAt(i)).getText()).append('\n');return b.toString();}
 @Test public void eventsStartShortAndCollapsedAndOnlyTappedDetailsAreCreated()throws Exception{
  LinearLayout root=OrderHistoryViews.create(context,new JSONArray().put(event("first")).put(event("second")));assertEquals(View.GONE,body(root,0).getVisibility());assertEquals(0,body(root,0).getChildCount());assertFalse(summary(root,0).getText().toString().contains("Actual Primary"));assertFalse(summary(root,0).getText().toString().contains("SKU-A"));assertTrue(summary(root,0).isFocusable());assertTrue(summary(root,0).isClickable());summary(root,0).performClick();assertEquals(View.VISIBLE,body(root,0).getVisibility());assertTrue(allText(body(root,0)).contains("SKU-A"));assertTrue(allText(body(root,0)).contains("Recognizable model ABC-123"));assertTrue(allText(body(root,0)).contains("Actual Primary"));assertEquals(View.GONE,body(root,1).getVisibility());summary(root,0).performClick();assertEquals(View.GONE,body(root,0).getVisibility());assertEquals(0,body(root,0).getChildCount());
 }
 @Test public void refreshKeepsExpandedExistingEventAndLeavesNewEventsCollapsed()throws Exception{
  JSONObject existing=event("same");LinearLayout root=OrderHistoryViews.create(context,new JSONArray().put(existing));summary(root,0).performClick();OrderHistoryViews.bind(root,new JSONArray().put(event("new")).put(existing));assertEquals(View.GONE,body(root,0).getVisibility());assertEquals(View.VISIBLE,body(root,1).getVisibility());assertTrue(allText(body(root,1)).contains("SKU-A"));
 }
 @Test public void legacyUnknownDetailsStayPlainTextAndNullPricesStayUnknown()throws Exception{
  JSONObject e=new JSONObject().put("id","legacy").put("action","unknown").put("actor",JSONObject.NULL).put("lines",new JSONArray().put(new JSONObject().put("articul","<img src=x>").put("kind","added").put("before",JSONObject.NULL).put("after",new JSONObject().put("qty",1).put("unitPrice",JSONObject.NULL))));LinearLayout root=OrderHistoryViews.create(context,new JSONArray().put(e));summary(root,0).performClick();String text=allText(body(root,0));assertTrue(text.contains("<img src=x>"));assertTrue(text.contains("—"));assertFalse(text.contains("0 ֏"));assertFalse(text.contains("Ադմինիստրատոր"));
 }
}
