package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

internal fun approvalStatusLabel(order:JSONObject)=when(order.optJSONObject("approval")?.text("state")){
 "pending"->"Սպասում է հաճախորդի համաձայնությանը"
 "approved"->if(order.text("status")=="confirmed")"Հաճախորդը համաձայնեցրել է"else""
 "declined"->"Հաճախորդը հրաժարվել է պատվերից"
 else->""
}
internal fun clientCanReviewApproval(user:JSONObject?,order:JSONObject)=clientCanActOnOrder(user,order)&&order.optJSONObject("approval")?.text("state")=="pending"
internal fun approvalResponsePayload(user:JSONObject?,order:JSONObject,decision:String,declined:List<String>,requestId:String):JSONObject{
 check(clientCanReviewApproval(user,order)){"Միայն հաճախորդը կարող է հաստատել փոփոխությունները"}
 require(decision in listOf("accept","reject")){"Ստուգեք համաձայնության պատասխանը"}
 val offer=order.getJSONObject("approval");val codes=offer.optJSONArray("lines").objects().map{it.text("articul")}
 require(declined.distinct().size==declined.size&&declined.all{it in codes}){"Ստուգեք համաձայնության պատասխանը"}
 require(decision=="reject"||codes.isEmpty()||codes.any{it !in declined}){"Մերժեք ամբողջ պատվերը կամ ընտրեք առնվազն մեկ ապրանք"}
 return JSONObject().put("orderId",order.text("id")).put("revision",order.optInt("revision")).put("proposalId",offer.text("id")).put("decision",decision).put("declinedArticuls",JSONArray(if(decision=="reject")emptyList<String>()else declined.sorted())).put("requestId",requestId)
}
@Composable internal fun OrderApprovalPanel(model:UnifiedModel,order:JSONObject){
 val offer=order.optJSONObject("approval")?:return
 val key=offer.text("id");if(key.isBlank())return
 val accountKey=key+"|"+model.user?.text("id").orEmpty()
 var declined by rememberSaveable(accountKey){mutableStateOf(arrayListOf<String>())}
 var confirmation by rememberSaveable(accountKey){mutableStateOf("")}
 var delayDialog by rememberSaveable(accountKey){mutableStateOf(false)}
 var delayMinutes by rememberSaveable(accountKey){mutableStateOf("1")}
 val lines=offer.optJSONArray("lines").objects();val before=(offer.optJSONArray("beforeLines")?:order.optJSONArray("lines")).objects().associateBy{it.text("articul")}
 val after=lines.associateBy{it.text("articul")};val selected=lines.filter{it.text("articul") !in declined}
 Card(Modifier.fillMaxWidth()){
  Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
   LocalizedText(if(offer.text("state")=="approved")"Հաճախորդը համաձայնեցրել է"else approvalStatusLabel(order),style=MaterialTheme.typography.titleMedium)
   if(offer.text("state")=="pending"){
    if(offer.optInt("reviewRequestedMinutes")>0)LocalizedText("Հաճախորդը ժամանակ է խնդրել դիտարկման համար՝ "+offer.optInt("reviewRequestedMinutes")+" րոպե։")
    LocalizedText("Ադմինիստրատորն առաջարկել է փոփոխություններ։ Ստուգեք քանակը, գինը և հեռացված ապրանքները։ Ցանկից կարող եք հանել ցանկացած ապրանք և հաստատել մնացածը կամ հրաժարվել ամբողջ պատվերից։")
    (before.keys+after.keys).distinct().forEach{code->
     val old=before[code];val line=after[code]
     HorizontalDivider()
     LocalizedText((line?:old)?.text("name").orEmpty(),textDecoration=if(line==null)TextDecoration.LineThrough else null)
     LocalizedText(code)
     if(old!=null&&(line==null||old.optInt("qty")!=line.optInt("qty")||old.optDouble("unitPrice")!=line.optDouble("unitPrice")))LocalizedText("${old.optInt("qty")} × ${money(old.optDouble("unitPrice"))}",textDecoration=TextDecoration.LineThrough)
     if(line!=null){
      LocalizedText("${line.optInt("qty")} × ${money(line.optDouble("unitPrice"))}")
      if(clientCanReviewApproval(model.user,order))OutlinedButton(onClick={declined=ArrayList(if(code in declined)declined.filter{it!=code}else declined+code)},enabled=!model.busy){LocalizedText(if(code in declined)"Վերադարձնել ապրանքը"else"Մերժել ապրանքը")}
     }
    }
    if(clientCanReviewApproval(model.user,order)){
     if(clientActsForOrderAuthor(model.user,order))LocalizedText(COMPANY_ORDER_ACTION_CAPTION,style=MaterialTheme.typography.bodyMedium)
     LocalizedText("Հաստատվող գումար՝ "+money(selected.sumOf{it.optInt("qty")*it.optDouble("unitPrice")}))
     Button(onClick={confirmation="accept"},enabled=!model.busy&&(lines.isEmpty()||selected.isNotEmpty()),modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)){LocalizedText("Հաստատել ընտրված ապրանքները")}
     OutlinedButton(onClick={confirmation="reject"},enabled=!model.busy,modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)){LocalizedText("Հրաժարվել ամբողջ պատվերից")}
     OutlinedButton(onClick={delayDialog=true},enabled=!model.busy,modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)){LocalizedText("Ժամանակ խնդրել դիտարկման համար")}
    }
   }else{
    val refused=offer.optJSONObject("response")?.optJSONArray("declinedArticuls")
    if(refused!=null&&refused.length()>0)LocalizedText("Հաճախորդի մերժած ապրանքները՝ "+(0 until refused.length()).joinToString(", "){refused.optString(it)})
   }
  }
 }
 if(confirmation.isNotEmpty())AlertDialog(onDismissRequest={confirmation=""},title={LocalizedText("Հաստատե՞լ պատասխանը")},text={LocalizedText(if(confirmation=="reject")"Հրաժարվե՞լ ամբողջ պատվերից։"else"Հաստատե՞լ միայն ընտրված ապրանքները՝ նշված քանակներով և գներով։")},confirmButton={TextButton(onClick={val action=confirmation;confirmation="";model.respondToApproval(action,if(action=="reject")emptyList()else declined.toList())},enabled=!model.busy){LocalizedText("Հաստատել փոփոխությունները")}},dismissButton={TextButton(onClick={confirmation=""}){LocalizedText("Չեղարկել")}})
 if(delayDialog)AlertDialog(onDismissRequest={if(!model.busy)delayDialog=false},title={LocalizedText("Ժամանակ խնդրել դիտարկման համար")},text={Column(verticalArrangement=Arrangement.spacedBy(8.dp)){if(clientActsForOrderAuthor(model.user,order))LocalizedText(COMPANY_ORDER_ACTION_CAPTION);OutlinedTextField(value=delayMinutes,onValueChange={if(it.length<=2&&it.all(Char::isDigit))delayMinutes=it},label={LocalizedText("Հիշեցնել քանի րոպեից՝")},supportingText={LocalizedText("Ընտրեք 1-ից 60 րոպե")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),singleLine=true,isError=approvalDelayMinutes(delayMinutes)==null)}},confirmButton={TextButton(onClick={approvalDelayMinutes(delayMinutes)?.let{model.deferCurrentApproval(it);delayDialog=false}},enabled=!model.busy&&approvalDelayMinutes(delayMinutes)!=null){LocalizedText("Հիշեցնել նշված ժամանակից հետո")}},dismissButton={TextButton(onClick={delayDialog=false},enabled=!model.busy){LocalizedText("Չեղարկել")}})
}
