package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable internal fun ReceiptPanel(user:JSONObject?,order:JSONObject,busy:Boolean,compact:Boolean=false,onConfirm:()->Unit){
 if(receiptRecorded(order)){
  Surface(color=Color(0xFFE5F7EE),shape=MaterialTheme.shapes.medium,modifier=Modifier.fillMaxWidth()){
   Column(Modifier.padding(if(compact)12.dp else 16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
    LocalizedText("Ստացումը հաստատված է",style=MaterialTheme.typography.titleSmall,fontWeight=FontWeight.SemiBold,color=Color(0xFF087547))
    if(!compact)LocalizedText(order.optJSONObject("receipt")?.text("statement")?.ifBlank{RECEIPT_STATEMENT}?:RECEIPT_STATEMENT,style=MaterialTheme.typography.bodyMedium)
    val date=order.text("received_at");if(date.isNotBlank())LocalizedText(receiptTime(date),style=MaterialTheme.typography.bodySmall,color=Color(0xFF087547))
   }
  }
 }else if(clientCanConfirmReceipt(user,order)){
  if(compact){
   Button(onClick=onConfirm,enabled=!busy,modifier=Modifier.fillMaxWidth().heightIn(min=50.dp)){LocalizedText("Հաստատել ստացումը")}
  }else{
   Surface(color=MaterialTheme.colorScheme.primaryContainer,shape=MaterialTheme.shapes.medium,modifier=Modifier.fillMaxWidth()){
    Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
     LocalizedText("Ապրանքներն արդեն ստացե՞լ եք",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
     if(clientActsForOrderAuthor(user,order))LocalizedText(COMPANY_ORDER_ACTION_CAPTION,style=MaterialTheme.typography.bodyMedium)
     LocalizedText("Ստանալուց հետո հաստատեք, որ բոլոր ապրանքներն ամբողջությամբ և առանց վնասվածքների են։",style=MaterialTheme.typography.bodyMedium)
     Button(onClick=onConfirm,enabled=!busy,modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)){LocalizedText("Հաստատել ապրանքների ստացումը")}
    }
   }
  }
 }else if(order.text("status")=="received"){
  LocalizedText("Պատվերը նշված է որպես ստացված։",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
 }else if(!compact&&user?.text("role")=="client"&&order.text("status")=="new"){
  LocalizedText("Ստացումը կարող եք հաստատել ադմինիստրատորի կողմից պատվերը հաստատելուց հետո։",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
 }
}
internal fun receiptTime(value:String)=try{
 java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(java.time.ZoneId.of("Asia/Yerevan")).format(java.time.Instant.parse(value))+" · Երևան"
}catch(_:Exception){value}
