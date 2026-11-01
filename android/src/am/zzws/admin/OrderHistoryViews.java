package am.zzws.admin;

import android.content.Context;
import android.graphics.Color;
import android.text.TextUtils;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.*;
import org.json.*;

/** Each event starts collapsed. Exact details are created only after a tap. */
final class OrderHistoryViews {
 private OrderHistoryViews(){}
 private static final class State {String fingerprint="";JSONArray events;final Set<String> expanded=new HashSet<>();}
 private static int dp(Context c,int n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
 private static TextView text(Context c,String value,int size){TextView v=new TextView(c);v.setText(value);v.setTextSize(size);v.setTextColor(Color.rgb(15,23,42));v.setPadding(0,dp(c,5),0,dp(c,5));return v;}
 static LinearLayout create(Context c,JSONArray events){LinearLayout root=new LinearLayout(c);root.setOrientation(LinearLayout.VERTICAL);root.setTag(new State());bind(root,events);root.getViewTreeObserver().addOnGlobalLayoutListener(()->{State state=(State)root.getTag();if(!state.fingerprint.startsWith(L10n.language()+"|"))bind(root,state.events);});return root;}
 static void bind(LinearLayout root,JSONArray events){
  State state=root.getTag() instanceof State?(State)root.getTag():new State();root.setTag(state);String fingerprint=L10n.language()+"|"+String.valueOf(events);if(fingerprint.equals(state.fingerprint))return;state.events=events;state.fingerprint=fingerprint;root.removeAllViews();Context c=root.getContext();
  if(events==null||events.length()==0){root.addView(text(c,L10n.t("Պատմության գրառումներ չկան։"),14));return;}
  for(int i=0;i<Math.min(events.length(),100);i++){
   JSONObject event=events.optJSONObject(i);if(event==null)continue;String id=event.optString("id","");String key=(id.isEmpty()?"event-"+i:id)+"|"+event.optInt("revision");
   LinearLayout row=new LinearLayout(c);row.setOrientation(LinearLayout.VERTICAL);row.setPadding(dp(c,12),dp(c,4),dp(c,12),dp(c,4));
   TextView summary=text(c,"",14);summary.setMinHeight(dp(c,52));summary.setMaxLines(2);summary.setEllipsize(TextUtils.TruncateAt.END);summary.setTypeface(null,1);summary.setClickable(true);summary.setFocusable(true);summary.setTag("history-summary");
   LinearLayout details=new LinearLayout(c);details.setOrientation(LinearLayout.VERTICAL);details.setPadding(dp(c,8),0,0,dp(c,10));details.setVisibility(View.GONE);details.setTag("history-details");
   Runnable render=()->{boolean open=state.expanded.contains(key);summary.setText((open?"▾ ":"▸ ")+OrderHistoryText.headline(event)+" · "+OrderHistoryText.time(event));summary.setActivated(open);summary.setContentDescription(OrderHistoryText.headline(event)+" · "+OrderHistoryText.time(event)+" · "+L10n.t(open?"Փակել մանրամասները":"Բացել մանրամասները"));details.removeAllViews();if(open)for(String line:OrderHistoryText.details(event))details.addView(text(c,line,13));details.setVisibility(open?View.VISIBLE:View.GONE);};
   summary.setOnClickListener(v->{if(state.expanded.contains(key))state.expanded.remove(key);else state.expanded.add(key);render.run();});row.addView(summary,new LinearLayout.LayoutParams(-1,-2));row.addView(details,new LinearLayout.LayoutParams(-1,-2));render.run();root.addView(row,new LinearLayout.LayoutParams(-1,-2));
  }
 }
}
