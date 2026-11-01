package am.zzws.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal data class AdminCatalogPrice(val key:String,val label:String,val amount:Double?,val promotion:Boolean=false)
internal fun showAdminCatalogPrices(role:String?,viewingBuyer:Boolean)=role=="admin"&&!viewingBuyer
/** Display only the authorized DTO fields. Never substitute one price for the other. */
internal fun adminCatalogPrices(product:Product,role:String?,viewingBuyer:Boolean):List<AdminCatalogPrice>{
 if(!showAdminCatalogPrices(role,viewingBuyer))return emptyList()
 val wholesale=product.price.takeIf{it.isFinite()&&it>0}
 val partner=product.kp.takeIf{it.isFinite()&&it>0}
 return listOf(AdminCatalogPrice("ws","Մեծածախ",wholesale),AdminCatalogPrice("kp","Խոշոր գործընկերոջ գին",partner,partner!=null&&product.data.optBoolean("kpIsPromo")))
}

/** Separate, equally sized labels/amounts; both blocks can grow at narrow widths or large font scales. */
@Composable internal fun AdminCatalogPriceBlocks(product:Product,role:String?,viewingBuyer:Boolean,scope:String,modifier:Modifier=Modifier){
 val prices=adminCatalogPrices(product,role,viewingBuyer)
 if(prices.isEmpty())return
 Column(modifier.fillMaxWidth().testTag("admin-price-blocks-$scope:${product.code}"),verticalArrangement=Arrangement.spacedBy(6.dp)){
  if(product.retail.isFinite()&&product.retail>0){
   Column(Modifier.fillMaxWidth().testTag("admin-retail-$scope:${product.code}"),verticalArrangement=Arrangement.spacedBy(3.dp)){
    LocalizedText("Մանրածախ",Modifier.fillMaxWidth().testTag("admin-retail-$scope:${product.code}:label"),fontSize=12.sp,lineHeight=16.sp,color=Color(0xFF626870))
    Text(money(product.retail),Modifier.fillMaxWidth().testTag("admin-retail-$scope:${product.code}:amount"),fontSize=18.sp,lineHeight=23.sp,fontWeight=FontWeight.SemiBold,color=Color(0xFF1F2937))
   }
  }
  prices.forEach{price->
   val foreground=if(price.key=="ws")Color(0xFF075985)else Color(0xFF047857)
   val background=if(price.key=="ws")Color(0xFFF0F9FF)else Color(0xFFECFDF5)
   val tag="admin-price-$scope:${product.code}:${price.key}"
   Surface(color=background,shape=RoundedCornerShape(8.dp),border=BorderStroke(1.dp,foreground.copy(alpha=.35f)),modifier=Modifier.fillMaxWidth().testTag(tag)){
    Column(Modifier.padding(8.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
     LocalizedText(price.label,Modifier.fillMaxWidth().testTag("$tag:label"),fontSize=12.sp,lineHeight=16.sp,fontWeight=FontWeight.SemiBold,color=foreground)
     Text(price.amount?.let{money(it)}?:"—",Modifier.fillMaxWidth().testTag("$tag:amount"),fontSize=18.sp,lineHeight=23.sp,fontWeight=FontWeight.Bold,color=foreground)
     if(price.promotion)LocalizedText("KP ակցիա",Modifier.fillMaxWidth().testTag("$tag:promotion"),fontSize=10.sp,lineHeight=14.sp,fontWeight=FontWeight.SemiBold,color=foreground)
    }
   }
  }
 }
}
