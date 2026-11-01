package am.zzws.admin

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject

/** Same concise, expandable event renderer as the legacy administrator screen. */
@Composable internal fun OrderHistoryPanel(order:JSONObject,modifier:Modifier=Modifier){
 val entries=OrderHistoryText.entries(order)
 AndroidView(factory={context->OrderHistoryViews.create(context,entries)},update={root->OrderHistoryViews.bind(root,entries)},modifier=modifier.fillMaxWidth())
}
