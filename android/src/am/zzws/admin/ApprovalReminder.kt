package am.zzws.admin
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.json.JSONObject
internal const val APPROVAL_REMINDER_INTERVAL_MS=60000L
internal fun approvalReminderDue(now:Long,lastShown:Long?,pending:Boolean,canShow:Boolean)=pending&&canShow&&(lastShown==null||now-lastShown>=APPROVAL_REMINDER_INTERVAL_MS)
internal fun approvalDelayMinutes(value:String)=value.toIntOrNull()?.takeIf{it in 1..60}
@Composable internal fun ApprovalReminderDialog(model:UnifiedModel,item:JSONObject){
 var minutes by rememberSaveable(item.text("proposalId")){mutableStateOf("1")}
 val delay=approvalDelayMinutes(minutes)
 Dialog(onDismissRequest={if(!model.busy)model.dismissApprovalReminder()},properties=DialogProperties(usePlatformDefaultWidth=false)){
  Surface(modifier=Modifier.fillMaxWidth(.94f).widthIn(max=620.dp).border(4.dp,Color(0xFFF59E0B),RoundedCornerShape(24.dp)),shape=RoundedCornerShape(24.dp),tonalElevation=12.dp){
   Column(Modifier.padding(24.dp).heightIn(max=680.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(18.dp)){
    Text("!",fontSize=56.sp,fontWeight=FontWeight.Black,color=Color(0xFFF59E0B))
    LocalizedText("Պատվերը սպասում է Ձեր համաձայնությանը",fontSize=26.sp,fontWeight=FontWeight.Bold)
    LocalizedText("Պատվեր №"+item.optLong("number"),fontSize=21.sp,fontWeight=FontWeight.Bold)
    LocalizedText("Ադմինիստրատորը փոխել է պատվերը։ Ստուգեք փոփոխությունները և հաստատեք կամ մերժեք դրանք։",fontSize=18.sp)
    Button(onClick={model.openApprovalReminder()},enabled=!model.busy,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)){LocalizedText("Բացել պատվերը",fontSize=18.sp)}
    OutlinedTextField(value=minutes,onValueChange={if(it.length<=2&&it.all(Char::isDigit))minutes=it},enabled=!model.busy,label={LocalizedText("Հիշեցնել քանի րոպեից՝")},supportingText={LocalizedText("Ընտրեք 1-ից 60 րոպե")},isError=delay==null,keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number),singleLine=true,modifier=Modifier.fillMaxWidth())
    OutlinedButton(onClick={delay?.let{model.deferApprovalReminder(it)}},enabled=!model.busy&&delay!=null,modifier=Modifier.fillMaxWidth().heightIn(min=56.dp)){LocalizedText("Հիշեցնել նշված ժամանակից հետո",fontSize=17.sp)}
    LocalizedText("Ադմինիստրատորը ծանուցում կստանա Ձեր խնդրած ժամանակի մասին։",style=MaterialTheme.typography.bodyMedium)
   }
  }
 }
}
