package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable internal fun AccountDetails(model:UnifiedModel){
 val person=model.user?.optJSONObject("person")
 var first by remember{mutableStateOf(person?.text("firstName").orEmpty())}
 var last by remember{mutableStateOf(person?.text("lastName").orEmpty())}
 var phone by remember{mutableStateOf(person?.text("phone").orEmpty())}
 var email by remember{mutableStateOf(person?.text("email").orEmpty())}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  LocalizedText("Լրացրեք անձնական տվյալները",style=MaterialTheme.typography.headlineSmall)
  LocalizedText("Նշեք ճիշտ անունը, ազգանունը, հեռախոսահամարը և էլ․ փոստը։ Այդ տվյալներով կկապվենք ձեզ հետ, իսկ նշված էլ․ փոստով կստանաք վաճառքի հաշվետվությունները։ Մինչև ավարտելը ստուգեք տվյալները։")
  OutlinedTextField(first,{first=it},label={LocalizedText("Անուն")},singleLine=true,modifier=Modifier.fillMaxWidth())
  OutlinedTextField(last,{last=it},label={LocalizedText("Ազգանուն")},singleLine=true,modifier=Modifier.fillMaxWidth())
  OutlinedTextField(phone,{phone=it},label={LocalizedText("Հեռախոս")},singleLine=true,modifier=Modifier.fillMaxWidth())
  OutlinedTextField(email,{email=it},label={LocalizedText("Էլ․ փոստ")},singleLine=true,modifier=Modifier.fillMaxWidth())
  if(model.notice.isNotBlank())LocalizedText(model.notice,color=MaterialTheme.colorScheme.error)
  Button(onClick={model.saveAccountPerson(first,last,phone,email)},enabled=!model.busy&&listOf(first,last,phone,email).all{it.isNotBlank()},modifier=Modifier.fillMaxWidth()){LocalizedText("Պահպանել տվյալները")}
  TextButton(onClick={model.cancelAccountProfile()},enabled=!model.busy){LocalizedText("Ելք")}
 }
}
