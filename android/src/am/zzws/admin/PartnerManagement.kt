package am.zzws.admin

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Same shell and cards as the catalogue; every task follows the server's permission model. */
@Composable internal fun PartnerManagement(model:UnifiedModel,onCustomerOrder:()->Unit){
 val context=androidx.compose.ui.platform.LocalContext.current
 val allowed=canOpenFeature(PartnerFeature.ADMIN,model.user)
 LaunchedEffect(allowed){if(allowed){while(model.busy)kotlinx.coroutines.delay(50);model.loadManagement()}}
 if(!allowed){LaunchedEffect(Unit){model.screen="profile"};return}
 val role=when(model.user?.text("adminScope")){"owner"->"Սեփականատեր";"manager"->"Պատվերների կառավարիչ";"price"->"Գնացուցակի կառավարիչ";else->"Միայն դիտում"}
 fun orders(status:String=""){model.openOrders(context,status)}
 LazyColumn(Modifier.fillMaxSize(),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  item{Row(verticalAlignment=Alignment.CenterVertically){IconButton(onClick={model.screen="profile"}){AppIcon("back")};LocalizedText("Կառավարում",fontSize=26.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));IconButton(onClick={model.loadManagement()},enabled=!model.busy){AppIcon("refresh")}}}
  item{Surface(shape=RoundedCornerShape(16.dp),color=Color.Transparent){Column(Modifier.fillMaxWidth().background(Brush.horizontalGradient(listOf(BrandBlue,ShopInk))).padding(20.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   Text("ZZWS",color=Color.White.copy(alpha=.8f),fontSize=11.sp,letterSpacing=2.sp)
   LocalizedText(role,color=Color.White,fontSize=21.sp,fontWeight=FontWeight.Bold)
   LocalizedText(model.user?.text("client").orEmpty(),color=Color.White.copy(alpha=.85f),fontSize=13.sp)
   LocalizedText("Ձեր իրավունքներին համապատասխան գործողություններ",color=Color.White.copy(alpha=.85f),fontSize=12.sp)
  }}}
  if(ordersDestination(model.user) in listOf(OrdersDestination.NATIVE,OrdersDestination.WEB)){
   item{Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
    listOf("new" to "Նոր պատվերներ","in_progress" to "Ձևակերպված է").forEach{(key,title)->
     Surface(onClick={orders(key)},enabled=!model.busy,shape=RoundedCornerShape(14.dp),color=Color.White,modifier=Modifier.weight(1f)){
      Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(5.dp)){LocalizedText(title,fontSize=12.sp,color=ShopMuted);Text(model.management?.optJSONObject("counts")?.optInt(key)?.toString()?:"—",fontSize=28.sp,fontWeight=FontWeight.Bold,color=BrandAccent)}
     }
    }
   }}
   item{ManagementTask("Պատվերներ",if(model.user?.permission("orders:write")==true)"Որոնում, կազմ, կարգավիճակներ և պատմություն"else"Պատվերների դիտում և պատմություն","orders",!model.busy){orders()}}
  }
  listOf(PartnerFeature.CLIENTS to "Հաշիվներ, հասանելիություն և առաքման տվյալներ",PartnerFeature.PRICES to if(model.user?.permission("price:write")==true)"Գնացուցակների բեռնում, ստուգում և հրապարակում"else"Ընթացիկ գնացուցակի դիտում",PartnerFeature.DASHBOARD to "Համակարգի ընթացիկ վիճակը",PartnerFeature.ADMIN to "Միայն ձեր իրավունքներով հասանելի բաժինները").filter{canOpenFeature(it.first,model.user)}.forEach{(feature,detail)->
   item{ManagementTask(feature.title,detail,when(feature){PartnerFeature.CLIENTS->"person";PartnerFeature.PRICES->"offer";PartnerFeature.DASHBOARD->"home";else->"catalog"},!model.busy&&!model.pendingSubmission){model.openFeature(feature,context)}}
  }
  if(canSelectCustomer(model.user))item{ManagementTask("Պատվեր հաճախորդի համար","Ընտրեք հաճախորդին և աշխատեք նրա կատալոգով","cart",!model.busy&&!model.pendingSubmission,onCustomerOrder)}
  item{LocalizedText("Գործիքները բացվում են ձեր հաշվի իրավունքներով։",fontSize=12.sp,color=ShopMuted,modifier=Modifier.padding(4.dp))}
 }
}
@Composable private fun ManagementTask(title:String,detail:String,icon:String,enabled:Boolean,onClick:()->Unit){
 Surface(onClick=onClick,enabled=enabled,shape=RoundedCornerShape(14.dp),color=Color.White){
  Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(14.dp)){
   Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFEFF6FF)){Box(Modifier.size(46.dp),contentAlignment=Alignment.Center){CompositionLocalProvider(LocalContentColor provides BrandAccent){AppIcon(icon)}}}
   Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)){LocalizedText(title,fontSize=15.sp,fontWeight=FontWeight.SemiBold);LocalizedText(detail,fontSize=12.sp,color=ShopMuted)}
   CompositionLocalProvider(LocalContentColor provides ShopMuted){AppIcon("chevron")}
  }
 }
}
