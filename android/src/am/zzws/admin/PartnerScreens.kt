package am.zzws.admin

import android.app.DatePickerDialog
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.ZoneId

@Composable internal fun PartnerLogo(modifier:Modifier=Modifier){
 val context=androidx.compose.ui.platform.LocalContext.current
 val bitmap=remember{context.assets.open("logo.png").use{android.graphics.BitmapFactory.decodeStream(it)}.asImageBitmap()}
 Image(bitmap,contentDescription="ZZWS",modifier=modifier)
}
@Composable internal fun PartnerToolLinks(model:UnifiedModel){
 val context=androidx.compose.ui.platform.LocalContext.current
 Surface(shape=MaterialTheme.shapes.medium,color=MaterialTheme.colorScheme.surface){
  Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   LocalizedText("Աշխատանքային գործիքներ",fontWeight=FontWeight.Bold,fontSize=18.sp)
   LocalizedText("Գործիքները բացվում են ձեր հաշվի իրավունքներով։",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
   PartnerFeature.entries.filter{it!=PartnerFeature.TEAM&&it.permission==null&&canOpenFeature(it,model.user)}.forEach{feature->
    OutlinedButton(onClick={model.openFeature(feature,context)},enabled=!model.busy&&!model.pendingSubmission,modifier=Modifier.fillMaxWidth()){
     LocalizedText(feature.title,Modifier.weight(1f));AppIcon("chevron")
    }
   }
   PartnerUpdateControl(model)
  }
 }
}
@Composable private fun PartnerUpdateControl(model:UnifiedModel){
 val context=androidx.compose.ui.platform.LocalContext.current
 LocalizedText("Սեղմեք «Թարմացնել»՝ հավելվածի նոր տարբերակը ներբեռնելու համար։",fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
 OutlinedButton(onClick={VersionReminder.manual(context as android.app.Activity)},enabled=!model.demo&&!model.busy,modifier=Modifier.fillMaxWidth()){
  LocalizedText("Ստուգել թարմացումները")
 }
 OutlinedButton(onClick={UserUpdateDownload.showDownloads(context as android.app.Activity)},enabled=!model.demo,modifier=Modifier.fillMaxWidth()){
  LocalizedText("Բացել ներբեռնումները")
 }
}
@Composable internal fun PartnerOrderSearch(model:UnifiedModel){
 val context=androidx.compose.ui.platform.LocalContext.current
 Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
  OutlinedTextField(model.orderSearch,{model.orderSearch=it.take(100)},label={LocalizedText("Պատվերի համար կամ արտիկուլ")},singleLine=true,modifier=Modifier.fillMaxWidth(),enabled=!model.busy)
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
   listOf(true,false).forEach{from->OutlinedButton(onClick={val value=if(from)model.orderFrom else model.orderTo;val day=runCatching{LocalDate.parse(value)}.getOrDefault(LocalDate.now(ZoneId.of("Asia/Yerevan")));DatePickerDialog(L10n.context(context),{_,year,month,date->if(from)model.orderFrom=checkoutDate(year,month,date)else model.orderTo=checkoutDate(year,month,date)},day.year,day.monthValue-1,day.dayOfMonth).show()},enabled=!model.busy,modifier=Modifier.weight(1f)){LocalizedText((if(from)"Սկսած՝ "else"Մինչև՝ ")+(if(from)model.orderFrom else model.orderTo),fontSize=11.sp)}}
  }
  Row{Button(onClick={model.history()},enabled=!model.busy){LocalizedText("Որոնել")};TextButton(onClick={model.orderSearch="";model.orderFrom="";model.orderTo="";model.history()},enabled=!model.busy){LocalizedText("Մաքրել")}}
 }
}
@Composable private fun CheckoutInput(value:String,onChange:(String)->Unit,label:String,enabled:Boolean){
 OutlinedTextField(value,onChange,label={LocalizedText(label)},enabled=enabled,modifier=Modifier.fillMaxWidth(),maxLines=3)
}
@Composable internal fun PartnerCheckout(model:UnifiedModel,onBuyer:()->Unit){
 val context=androidx.compose.ui.platform.LocalContext.current
 var confirm by remember{mutableStateOf(false)}
 var reload by remember{mutableStateOf(false)}
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  LocalizedText("Զամբյուղ",fontSize=26.sp,fontWeight=FontWeight.Bold)
  if(model.pendingSubmission){
   LocalizedText("Նախորդ ուղարկման պատասխանը չի ստացվել։ Կրկնելիս կստուգվի նույն պատվերը՝ առանց կրկնօրինակի։")
   Button(onClick={model.submit()},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Կրկնել նույն ուղարկումը")}
   OutlinedButton(onClick={model.history()},enabled=!model.busy){LocalizedText("Ստուգել պատվերների պատմությունը")}
   return@Column
  }
  if(model.cart.isEmpty()){RetailEmptyCart{model.showDepartments()};return@Column}
  Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(6.dp)){
   listOf("Պատրաստում","Տվյալներ","Ստուգում").forEachIndexed{index,label->
    FilterChip(selected=model.checkoutStep==index+1,onClick={if(index+1<model.checkoutStep)model.checkoutStep=index+1},enabled=!model.busy&&index+1<=model.checkoutStep,label={LocalizedText("${index+1}. $label",fontSize=10.sp)},modifier=Modifier.weight(1f))
   }
  }
  when(model.checkoutStep){
   1->{
    LocalizedText("Ընտրեք հիմա ուղարկվող ապրանքները։ Մյուսները կմնան զամբյուղում։",fontSize=13.sp)
    model.cart.toMap().forEach{(code,qty)->RetailCartItem(model.products.find{it.code==code},code,qty,model)}
    LocalizedText("Ընտրված է՝ ${model.selectedCount} հատ",fontWeight=FontWeight.Bold)
    LocalizedText("Ընդամենը՝ "+money(model.total),fontSize=22.sp,fontWeight=FontWeight.Bold)
    Button(onClick={model.checkoutStep=2},enabled=!model.busy&&model.selectedLines.isNotEmpty(),modifier=Modifier.fillMaxWidth()){LocalizedText("Շարունակել ձևակերպումը")}
    if(model.buyer==null){
     LocalizedText(model.cartSync,fontSize=12.sp)
     OutlinedButton(onClick={model.saveServerCart()},enabled=!model.busy&&!model.cartConflict,modifier=Modifier.fillMaxWidth()){LocalizedText("Համաժամացնել զամբյուղը")}
     TextButton(onClick={reload=true},enabled=!model.busy){LocalizedText("Բեռնել կայքի զամբյուղը")}
    }
   }
   2->{
    LocalizedText("Գնորդի և առաքման տվյալներ",fontSize=19.sp,fontWeight=FontWeight.Bold)
    if(canSelectCustomer(model.user))OutlinedButton(onClick=onBuyer,enabled=!model.busy){LocalizedText(if(model.buyer==null)"Ընտրել պատվիրատուին"else"Փոխել պատվիրատուին")}
    model.buyer?.let{LocalizedText("Պատվիրատու՝ "+it.text("client"),fontWeight=FontWeight.Bold)}
    if(model.buyer==null&&model.user?.text("role")=="admin")Row{
     listOf("WS","KP").forEach{mode->FilterChip(selected=model.priceMode==mode,onClick={model.changePriceMode(mode)},enabled=!model.busy,label={LocalizedText("$mode գին")},modifier=Modifier.padding(end=8.dp))}
    }
    model.deliveryRows.forEachIndexed{index,row->
     OutlinedCard(onClick={model.setDelivery(index)},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){
      Row(Modifier.padding(8.dp),verticalAlignment=Alignment.CenterVertically){RadioButton(selected=model.deliveryIndex==index,onClick=null);Column(Modifier.weight(1f)){LocalizedText(row.text("organization"),fontWeight=FontWeight.Bold);LocalizedText(row.text("address"),fontSize=12.sp)}}
     }
    }
    if(model.deliveryRows.isEmpty())LocalizedText("Առաքման տվյալները պետք է լրացնի պատասխանատու ադմինիստրատորը։",color=MaterialTheme.colorScheme.error)
    Row{listOf("Առաքում","Ինքնաառաքում").forEach{method->FilterChip(selected=model.method==method,onClick={model.updateDelivery(method=method)},enabled=!model.busy,label={LocalizedText(method)},modifier=Modifier.padding(end=8.dp))}}
    if(model.method=="Առաքում")CheckoutInput(model.address,{model.updateDelivery(address=it)},"Առաքման հասցե",false)
    CheckoutInput(model.contact,{model.updateDelivery(contact=it)},"Կոնտակտային անձ",!model.busy&&model.user?.text("role")!="client")
    OutlinedButton(onClick={val selected=runCatching{LocalDate.parse(model.date)}.getOrDefault(LocalDate.now(ZoneId.of("Asia/Yerevan")));DatePickerDialog(L10n.context(context),{_,year,month,day->model.updateDelivery(date=checkoutDate(year,month,day))},selected.year,selected.monthValue-1,selected.dayOfMonth).show()},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){
     LocalizedText(if(model.date.isBlank())"Ընտրել ամսաթիվը օրացույցից"else"Ամսաթիվ՝ "+model.date)
    }
    CheckoutInput(model.comment,{model.updateDelivery(comment=it)},"Մեկնաբանություն",!model.busy)
    if(model.buyer==null&&!model.buyerView){
     LocalizedText(model.draftSync,fontSize=12.sp)
     if(model.draftConflict){
      OutlinedButton(onClick={model.keepCheckoutDraft()},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Պահպանել այս սարքի պատվերի տվյալները")}
      TextButton(onClick={model.reloadCheckoutDraft()},enabled=!model.busy){LocalizedText("Բեռնել կայքի պատվերի տվյալները")}
     }else TextButton(onClick={model.saveCheckoutDraft()},enabled=!model.busy){LocalizedText("Պահպանել պատվերի տվյալները")}
    }
    Button(onClick={model.nextCheckout{model.checkoutStep=3}},enabled=!model.busy&&model.selectedLines.isNotEmpty(),modifier=Modifier.fillMaxWidth()){LocalizedText("Թարմացնել գները և ստուգել")}
    TextButton(onClick={model.checkoutStep=1},enabled=!model.busy){LocalizedText("Վերադառնալ կազմին")}
   }
   3->{
    LocalizedText("Պատվերի վերջնական ստուգում",fontSize=20.sp,fontWeight=FontWeight.Bold)
    LocalizedText(model.target?.text("client").orEmpty(),fontWeight=FontWeight.Bold)
    LocalizedText(model.deliveryRows.getOrNull(model.deliveryIndex)?.text("organization").orEmpty())
    LocalizedText(model.method+" · "+model.date)
    if(model.method=="Առաքում")LocalizedText(model.address)
    LocalizedText(model.contact)
    if(model.comment.isNotBlank())LocalizedText(model.comment)
    HorizontalDivider()
    model.selectedLines.forEach{(code,qty)->val p=model.products.find{it.code==code};Column(Modifier.fillMaxWidth().padding(vertical=5.dp)){
     LocalizedText(p?.name?:code,fontWeight=FontWeight.SemiBold)
     LocalizedText(code+" · "+qty+" × "+money(p?.let{model.unit(it)}?:0.0),fontSize=13.sp)
    }}
    HorizontalDivider()
    LocalizedText("Ընդամենը՝ "+money(model.total),fontWeight=FontWeight.Bold,fontSize=24.sp)
    if(model.cart.size>model.selectedLines.size)LocalizedText("Չընտրված ապրանքները կմնան զամբյուղում։",fontSize=12.sp)
    Button(onClick={confirm=true},enabled=!model.busy&&model.checkoutReady,modifier=Modifier.fillMaxWidth()){LocalizedText("Ուղարկել պատվերը")}
    TextButton(onClick={model.checkoutStep=2},enabled=!model.busy){LocalizedText("Փոխել տվյալները")}
   }
  }
 }
 if(confirm)AlertDialog(onDismissRequest={confirm=false},title={LocalizedText("Ուղարկե՞լ պատվերը")},text={LocalizedText("Ընդամենը՝ "+money(model.total)+" · "+model.selectedCount+" հատ")},confirmButton={Button(onClick={confirm=false;model.submit()},enabled=!model.busy){LocalizedText("Ուղարկել")}},dismissButton={TextButton(onClick={confirm=false}){LocalizedText("Հետ")}})
 if(reload)AlertDialog(onDismissRequest={reload=false},title={LocalizedText("Բեռնե՞լ սերվերի զամբյուղը")},text={LocalizedText("Այս սարքի զամբյուղը կփոխարինվի կայքում պահպանված տարբերակով։")},confirmButton={Button(onClick={reload=false;model.reloadServerCart()}){LocalizedText("Բեռնել")}},dismissButton={TextButton(onClick={reload=false}){LocalizedText("Չեղարկել")}})
}
