package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.LocalTextStyle
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.ceil

/** Shows every count already authorized in Product.stock, without truncation. */
@OptIn(ExperimentalLayoutApi::class)
@Composable internal fun WarehouseAvailability(product:Product,modifier:Modifier=Modifier){
 val label=productAvailabilityLabel(product)
 val warehouses=warehouseCounts(label)
 val color=if(product.available)Color(0xFF087547)else Color(0xFF916000)
 val textStyle=LocalTextStyle.current.copy(fontSize=11.sp,lineHeight=15.sp)
 val measure=rememberTextMeasurer()
 val density=LocalDensity.current
 if(warehouses==null){
  LocalizedText(label,modifier=modifier.fillMaxWidth(),fontSize=11.sp,lineHeight=16.sp,color=color)
 }else FlowRow(modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(4.dp),verticalArrangement=Arrangement.spacedBy(4.dp)){
  warehouses.forEach{warehouse->
   val text=warehouse.code+": "+warehouse.quantity
   // FlowRow intrinsic measurement can round fractional glyph widths down.
   // Reserve the true natural width plus one physical pixel inside each pill;
   // parent constraints still allow long labels to wrap rather than overflow.
   val natural=measure.measure(text,style=textStyle,softWrap=false).multiParagraph.maxIntrinsicWidth
   val width=with(density){(ceil(natural)+1f).toDp()}
   Surface(color=color.copy(alpha=.08f),shape=RoundedCornerShape(5.dp)){
    Text(text,modifier=Modifier.padding(horizontal=5.dp,vertical=3.dp).widthIn(min=width),style=textStyle,color=color)
  }}
 }
}
