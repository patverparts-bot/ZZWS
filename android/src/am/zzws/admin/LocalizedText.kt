package am.zzws.admin
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.*
import androidx.compose.ui.unit.*

internal object AppLanguage {
 val current=mutableStateOf("hy")
 fun initialize(context:Context){L10n.initialize(context);current.value=L10n.language()}
 fun select(context:Context,language:String){L10n.setLanguage(context,language);current.value=language}
}
@Composable internal fun LocalizedText(text:String,modifier:Modifier=Modifier,color:Color=Color.Unspecified,fontSize:TextUnit=TextUnit.Unspecified,fontStyle:FontStyle?=null,fontWeight:FontWeight?=null,fontFamily:FontFamily?=null,letterSpacing:TextUnit=TextUnit.Unspecified,textDecoration:TextDecoration?=null,textAlign:TextAlign?=null,lineHeight:TextUnit=TextUnit.Unspecified,overflow:TextOverflow=TextOverflow.Clip,softWrap:Boolean=true,maxLines:Int=Int.MAX_VALUE,minLines:Int=1,onTextLayout:((TextLayoutResult)->Unit)?=null,style:TextStyle=LocalTextStyle.current){
 val language=AppLanguage.current.value
 Text(text=L10n.t(text,language),modifier=modifier,color=color,fontSize=fontSize,fontStyle=fontStyle,fontWeight=fontWeight,fontFamily=fontFamily,letterSpacing=letterSpacing,textDecoration=textDecoration,textAlign=textAlign,lineHeight=lineHeight,overflow=overflow,softWrap=softWrap,maxLines=maxLines,minLines=minLines,onTextLayout=onTextLayout,style=style)
}
@Composable internal fun LanguagePicker(){
 val context=androidx.compose.ui.platform.LocalContext.current
 val language=AppLanguage.current.value
 androidx.compose.foundation.layout.Row(modifier=Modifier.fillMaxWidth().padding(horizontal=0.dp),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
  TextButton(onClick={AppLanguage.select(context,"hy")},enabled=language!="hy"){Text("Հայերեն")}
  TextButton(onClick={AppLanguage.select(context,"ru")},enabled=language!="ru"){Text("Русский")}
 }
}

@Composable internal fun localizedDescription(value:String):String = L10n.t(value,AppLanguage.current.value)
