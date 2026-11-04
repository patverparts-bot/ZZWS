package am.zzws.admin

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Original Partner vectors; tint follows the current enabled/selected content colour. */
@Composable internal fun AppIcon(key:String){
 val color=LocalContentColor.current
 val glyph=partnerIconSet[key]?:partnerIconSet.getValue("person")
 val paths=remember(glyph){glyph.layers.map{it to PathParser().parsePathString(it.data).toPath().apply{fillType=PathFillType.EvenOdd}}}
 val label=L10n.t(glyph.label,AppLanguage.current.value)
 Canvas(Modifier.size(24.dp).semantics{contentDescription=label}){
  scale(size.width/24f,size.height/24f,pivot=Offset.Zero){
   paths.forEach{(layer,path)->
    val tint=if(layer.cutout)Color.White else color
    if(layer.stroke)drawPath(path,tint,alpha=layer.alpha,style=Stroke(1.65f,cap=StrokeCap.Round,join=StrokeJoin.Round))
    else drawPath(path,tint,alpha=layer.alpha)
   }
  }
 }
}
