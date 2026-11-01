package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject

@Composable internal fun OrderOriginCard(order:JSONObject){
 val language=AppLanguage.current.value
 OutlinedCard(Modifier.fillMaxWidth().testTag("order-origin-card")){
  Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
   LocalizedText("Պատվիրատու",style=MaterialTheme.typography.titleSmall,color=MaterialTheme.colorScheme.primary)
   for(field in orderOriginFields(order)){
    when{field.primary->Text(field.value,style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold)
     field.label.isBlank()->LocalizedText(field.value,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
     else->Text(L10n.t(field.label,language)+" "+field.value,style=MaterialTheme.typography.bodyMedium)}
   }
  }
 }
}
