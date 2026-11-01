package am.zzws.admin

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.platform.testTag
import org.json.JSONObject

internal const val ORDER_XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
internal fun orderExportRequest(id:String?,filters:Triple<String,String,String>?,language:String):JSONObject {
 val payload=JSONObject().put("locale",if(language=="ru")"ru"else"hy")
 if(!id.isNullOrBlank())payload.put("id",id)
 else if(filters!=null){val data=JSONObject();listOf("search" to filters.first,"from" to filters.second,"to" to filters.third).forEach{(key,value)->if(value.isNotBlank())data.put(key,value.trim())};payload.put("filters",data)}
 return payload
}
@Composable internal fun OrderDataExportButton(model:UnifiedModel,id:String?=null,number:Long?=null,filtered:Boolean=false){
 val owner=model.user?.text("id")
 var pending by remember(owner,id,filtered){mutableStateOf<JSONObject?>(null)}
 var requestedOwner by remember{mutableStateOf<String?>(null)}
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(ORDER_XLSX_MIME)){uri->
  val payload=pending;pending=null
  if(uri!=null&&payload!=null&&requestedOwner==model.user?.text("id"))model.exportOrderData(uri,payload,requestedOwner.orEmpty())
 }
 if(model.user?.text("role")=="client")OutlinedButton(onClick={
  pending=orderExportRequest(id,if(filtered)model.exportOrderFilters()else null,L10n.language());requestedOwner=owner
  picker.launch(if(number!=null)"ZZWS-Order-$number.xlsx"else"ZZWS-Orders.xlsx")
 },enabled=!model.busy&&!model.demo,modifier=Modifier.fillMaxWidth().testTag(if(id!=null)"download-order-data"else if(filtered)"download-filtered-order-data"else"download-all-order-data")){
  LocalizedText(if(filtered)"Ներբեռնել ըստ որոնման"else"Ներբեռնել տվյալները")
 }
}
