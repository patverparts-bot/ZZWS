package am.zzws.admin

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.collect

internal data class CatalogPosition(val item:Int,val offset:Int)
internal fun cardQuantity(value:String):Int?=value.takeIf{it.matches(Regex("[0-9]{1,4}"))}?.toIntOrNull()
internal fun catalogSearchVisible(previous:CatalogPosition,current:CatalogPosition,visible:Boolean):Boolean=when{
 current.item==0&&current.offset==0->true
 current.item>previous.item||current.item==previous.item&&current.offset>previous.offset+8->false
 current.item<previous.item||current.item==previous.item&&current.offset<previous.offset-8->true
 else->visible
}

@Composable internal fun CatalogScreen(model:UnifiedModel,onFilters:()->Unit,onBuyer:()->Unit,onProduct:(Product)->Unit,onMenu:()->Unit){
 val list=rememberLazyListState()
 val focus=LocalFocusManager.current
 LaunchedEffect(list){snapshotFlow{list.isScrollInProgress}.distinctUntilChanged().collect{if(it)focus.clearFocus()}}
 val rows by remember(model){derivedStateOf{model.filtered}}
 LaunchedEffect(model.query,model.brands.toList(),model.categories.toList(),model.onlyAvailable,model.onlyPromo,model.onlyWholesale,model.sort){list.scrollToItem(0)}
 LazyColumn(state=list,contentPadding=PaddingValues(horizontal=10.dp,vertical=8.dp),verticalArrangement=Arrangement.spacedBy(8.dp),modifier=Modifier.fillMaxSize()){
  item(key="catalog-tools"){
   Column(verticalArrangement=Arrangement.spacedBy(4.dp)){
    Row(verticalAlignment=Alignment.CenterVertically){
     LocalizedText("${rows.size} ապրանք",style=MaterialTheme.typography.titleSmall,modifier=Modifier.weight(1f))
     IconButton(onClick={model.refresh()},enabled=!model.busy){AppIcon("refresh")}
     TextButton(onClick=onMenu){LocalizedText("Մենյու")}
    }
    Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)){
     OutlinedTextField(model.query,{model.query=it},placeholder={LocalizedText("Արտիկուլ, ապրանք կամ բրենդ")},singleLine=true,shape=RoundedCornerShape(12.dp),modifier=Modifier.weight(1f),leadingIcon={AppIcon("search")},trailingIcon={if(model.query.isNotEmpty())IconButton(onClick={model.query=""}){AppIcon("close")}})
     val active=CatalogFilters(model.brands.toSet(),model.categories.toSet(),model.onlyAvailable,model.onlyPromo,model.sort,model.onlyWholesale&&model.user?.text("role")=="admin"&&model.control("wholesale")).activeCount
     OutlinedButton(onClick=onFilters,contentPadding=PaddingValues(horizontal=10.dp)){LocalizedText(if(active>0)"Զտիչներ · $active"else"Զտիչներ",fontSize=12.sp)}
    }
    model.catalogBuyer?.let{Surface(onClick=onBuyer,color=Color(0xFFE8EEFF),shape=RoundedCornerShape(8.dp),modifier=Modifier.fillMaxWidth()){LocalizedText("Պատվիրատու՝ "+it.text("client"),Modifier.padding(8.dp),style=MaterialTheme.typography.labelLarge)}}
    if(model.notice.isNotBlank())LocalizedText(model.notice,Modifier.padding(vertical=6.dp),color=MaterialTheme.colorScheme.primary)
   }
  }
  if(rows.isEmpty())item{LocalizedText("Համապատասխան ապրանքներ չկան։ Փոխեք որոնումը կամ զտիչները։",Modifier.padding(24.dp))}
  items(rows,key={"product:"+it.code}){p->ProductCard(p,model.unit(p),model.user?.text("role"),model.buyerView,model.cart[p.code]?:0,!model.busy&&!model.pendingSubmission,{model.setQty(p.code,it)},{onProduct(p)})}
 }
}

@Composable private fun ProductCard(p:Product,price:Double,role:String?,viewingBuyer:Boolean,quantity:Int,enabled:Boolean,onQuantity:(Int)->Unit,onOpen:()->Unit){
 val context=LocalContext.current
 ElevatedCard(onClick=onOpen,shape=RoundedCornerShape(14.dp),colors=CardDefaults.elevatedCardColors(containerColor=Color.White),elevation=CardDefaults.elevatedCardElevation(defaultElevation=2.dp),modifier=Modifier.fillMaxWidth()){
  Column(Modifier.padding(10.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
   Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    Surface(shape=RoundedCornerShape(16.dp),color=Color(0xFFF5F7FC)){Box(Modifier.size(64.dp),contentAlignment=Alignment.Center){ProductPhoto(p.code,edge=60,onTechnical=onOpen)}}
    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)){
     Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)){
      LocalizedText(p.brand.uppercase(),style=MaterialTheme.typography.labelMedium,fontWeight=FontWeight.Bold,color=Color(0xFF3159D9),modifier=Modifier.weight(1f),maxLines=1,overflow=TextOverflow.Ellipsis)
      if(p.promo)Surface(shape=RoundedCornerShape(6.dp),color=Color(0xFFFFE7DD)){LocalizedText("ԱԿՑԻԱ",Modifier.padding(horizontal=6.dp,vertical=3.dp),fontSize=10.sp,color=Color(0xFFB64219),fontWeight=FontWeight.Bold)}
     }
     LocalizedText(p.name,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold,color=Color(0xFF12243C),maxLines=2,overflow=TextOverflow.Ellipsis)
     Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(6.dp)){
      LocalizedText(p.code,style=MaterialTheme.typography.labelMedium,color=Color(0xFF718096),modifier=Modifier.weight(1f).clickable{val clipboard=context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager;clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Արտիկուլ",p.code))},maxLines=1,overflow=TextOverflow.Ellipsis)

     }
    }
   }
   WarehouseAvailability(p)
   if(showAdminCatalogPrices(role,viewingBuyer))AdminCatalogPriceBlocks(p,role,viewingBuyer,"alternate")
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
    if(showAdminCatalogPrices(role,viewingBuyer))Spacer(Modifier.weight(1f))else Column(Modifier.weight(1f)){LocalizedText("Ձեր գինը",style=MaterialTheme.typography.labelSmall,color=Color(0xFF64748B));OneLineLabel(money(price),18,FontWeight.Bold)}
    if(quantity==0)Button(onClick={onQuantity(1)},enabled=enabled&&price>0,shape=RoundedCornerShape(12.dp),contentPadding=PaddingValues(horizontal=14.dp,vertical=10.dp)){OneLineLabel("Ավելացնել",12)}
    else QuantityControl(quantity,enabled&&price>0,onQuantity)
   }
  }
 }
}

@Composable internal fun QuantityControl(quantity:Int,enabled:Boolean,onChange:(Int)->Unit){
 var editing by remember{mutableStateOf(false)};var draft by remember{mutableStateOf(quantity.toString())}
 Surface(shape=RoundedCornerShape(14.dp),color=Color(0xFFEFF6FF)){
  Row(verticalAlignment=Alignment.CenterVertically){
   IconButton(onClick={onChange(quantity-1)},enabled=enabled){LocalizedText("−",fontSize=24.sp,color=BrandBlue)}
   LocalizedText("$quantity",modifier=Modifier.widthIn(min=26.dp).clickable(enabled=enabled){draft=quantity.toString();editing=true}.padding(vertical=12.dp),fontWeight=FontWeight.Bold,maxLines=1)
   IconButton(onClick={onChange(quantity+1)},enabled=enabled&&quantity<9999){LocalizedText("+",fontSize=24.sp,color=BrandBlue)}
  }
 }
 if(editing)AlertDialog(onDismissRequest={editing=false},title={OneLineLabel("Քանակ",20)},text={OutlinedTextField(draft,{if(it.length<=4&&it.all(Char::isDigit))draft=it},label={LocalizedText("Քանակ՝ 0–9999")},singleLine=true,keyboardOptions=androidx.compose.foundation.text.KeyboardOptions(keyboardType=androidx.compose.ui.text.input.KeyboardType.Number))},confirmButton={TextButton(onClick={cardQuantity(draft)?.let(onChange);editing=false},enabled=enabled&&cardQuantity(draft)!=null){OneLineLabel("Պահպանել",13)}},dismissButton={TextButton(onClick={editing=false}){OneLineLabel("Չեղարկել",13)}})
}

@Composable internal fun OneLineLabel(text:String,size:Int=11,weight:FontWeight=FontWeight.Medium){
 BoxWithConstraints{val density=androidx.compose.ui.platform.LocalDensity.current;val style=MaterialTheme.typography.labelMedium;val displayed=L10n.t(text,AppLanguage.current.value);val measurer=androidx.compose.ui.text.rememberTextMeasurer();var selected=size
  while(selected>8&&measurer.measure(displayed,style.copy(fontSize=selected.sp,fontWeight=weight),maxLines=1,softWrap=false).size.width>with(density){maxWidth.toPx()})selected--
  LocalizedText(text,fontSize=selected.sp,maxLines=1,softWrap=false,overflow=TextOverflow.Ellipsis,fontWeight=weight)
 }
}
