package am.zzws.admin

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.util.concurrent.CopyOnWriteArraySet

/** Only in-flight requests are counted. No timers, estimated percentages or request data. */
internal object ServerMutationProgress {
 private var sequence=0L
 private val tickets=mutableSetOf<Long>()
 private val listeners=CopyOnWriteArraySet<Runnable>()
 @get:JvmStatic var activeRequests by mutableIntStateOf(0);private set
 @JvmStatic @Synchronized fun begin():Long{val ticket=++sequence;tickets.add(ticket);update();return ticket}
 @JvmStatic @Synchronized fun finish(ticket:Long){if(ticket!=0L&&tickets.remove(ticket))update()}
 @JvmStatic fun addListener(listener:Runnable){listeners.add(listener);runCatching{listener.run()}}
 @JvmStatic fun removeListener(listener:Runnable){listeners.remove(listener)}
 private fun update(){activeRequests=tickets.size;listeners.forEach{runCatching{it.run()}}}
}

@Composable internal fun ServerOperationProgress(busy:Boolean,modifier:Modifier=Modifier){
 if(busy||ServerMutationProgress.activeRequests>0)LinearProgressIndicator(modifier.fillMaxWidth().height(3.dp).testTag("server-operation-progress").semantics{contentDescription=L10n.t("Բեռնվում է…")})
}
