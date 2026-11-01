package am.zzws.admin

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.json.JSONObject

internal data class StartupData(val catalog:JSONObject,val state:JSONObject,val preferences:JSONObject)

/** Only independent reads run together, after identity and mobile-session renewal. */
internal suspend fun readStartupData(catalogPath:String,read:suspend (String)->JSONObject):StartupData=coroutineScope {
 val catalog=async{read(catalogPath)}
 val state=async{read("me/state")}
 val preferences=async{read("me/mobile/preferences")}
 StartupData(catalog.await(),state.await(),preferences.await())
}
