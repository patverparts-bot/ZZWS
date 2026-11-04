package am.zzws.admin

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URI
import java.net.URL
import java.net.HttpURLConnection
import java.io.File
import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale

internal data class TechnicalProduct(val name:String,val source:String,val checkedAt:String,val specifications:List<Pair<String,String>>,val main:List<Int> = specifications.indices.take(6))
internal fun technicalFile(code:String)=MessageDigest.getInstance("SHA-256").digest(code.toByteArray(Charsets.UTF_8)).joinToString(""){"%02x".format(it)}+".json"
internal fun technicalDocumentUrl(code:String)=PARTNER_SITE+"js/product-specifications/items/"+technicalFile(code)
internal fun checkedTechnicalDocument(bytes:ByteArray,code:String,name:String):JSONObject?=runCatching{if(bytes.size>131072)return null;JSONObject(String(bytes,Charsets.UTF_8)).takeIf{technicalProduct(it,code,name)!=null}}.getOrNull()
internal fun limitedTechnicalBytes(input:InputStream):ByteArray{
 val output=ByteArrayOutputStream();val buffer=ByteArray(4096)
 while(output.size()<=131072){val count=input.read(buffer,0,minOf(buffer.size,131073-output.size()));if(count<0)break;output.write(buffer,0,count)}
 return output.toByteArray()
}
private fun technicalName(value:String)=Normalizer.normalize(value,Normalizer.Form.NFKC).lowercase(Locale.ROOT).replace(Regex("[^\\p{L}\\p{N}]"),"")
internal fun technicalProduct(data:JSONObject,code:String,name:String):TechnicalProduct?{
 if(data.optInt("schemaVersion")!=1)return null
 val row=data.optJSONObject("products")?.optJSONArray(code)?:return null
 if(technicalName(row.optString(0))!=technicalName(name))return null
 val source=row.optString(1);val uri=runCatching{URI(source)}.getOrNull()?:return null
 if(uri.scheme!="https"||uri.host!="www.zigzag.am"||uri.userInfo!=null||uri.port!=-1)return null
 val specs=row.optJSONArray(3)?:return null
 val values=(0 until specs.length()).mapNotNull{i->specs.optJSONArray(i)?.let{r->val label=r.optString(0);val value=r.optString(1);if(label.isBlank()||value.isBlank())null else label to value}}
 if(values.isEmpty())return null
 val preferred=row.optJSONArray(4)
 val main=if(preferred==null)values.indices.take(6) else (0 until preferred.length()).map{preferred.optInt(it,-1)}.filter{it in values.indices}.distinct().take(8)
 return TechnicalProduct(row.optString(0),source,row.optString(2),values,main.ifEmpty{values.indices.take(6)})
}
private object TechnicalSnapshot{
 @Volatile private var value:JSONObject?=null
 fun load(context:Context):JSONObject=value?:synchronized(this){value?:JSONObject(context.assets.open("product-specifications.json").bufferedReader(Charsets.UTF_8).use{it.readText()}).also{value=it}}
 fun cached(context:Context,code:String,name:String):TechnicalProduct?=runCatching{technicalProduct(JSONObject(File(context.cacheDir,"technical/"+technicalFile(code)).readText()),code,name)}.getOrNull()
 fun update(context:Context,code:String,name:String):TechnicalProduct?{
  val folder=File(context.cacheDir,"technical");folder.mkdirs();val file=File(folder,technicalFile(code))
  if(file.exists()&&System.currentTimeMillis()-file.lastModified()<86400000)return cached(context,code,name)
  val connection=URL(technicalDocumentUrl(code)).openConnection() as HttpURLConnection
  try{
   connection.connectTimeout=5000;connection.readTimeout=5000;connection.instanceFollowRedirects=false;connection.setRequestProperty("Accept","application/json")
   if(connection.responseCode!=200)return null
   val bytes=connection.inputStream.use{limitedTechnicalBytes(it)}
   val data=checkedTechnicalDocument(bytes,code,name)?:return null
   val temp=File(folder,file.name+".tmp");temp.writeBytes(bytes);if(!temp.renameTo(file)){temp.delete();return technicalProduct(data,code,name)}
   folder.listFiles()?.filter{it.extension=="json"}?.sortedByDescending{it.lastModified()}?.drop(100)?.forEach{it.delete()}
   return technicalProduct(data,code,name)
  }finally{connection.disconnect()}
 }
}
private sealed interface TechnicalState{
 data object Loading:TechnicalState
 data class Loaded(val product:TechnicalProduct?):TechnicalState
 data object Failed:TechnicalState
}
@Composable internal fun ProductTechnicalDetails(product:Product){
 val context=androidx.compose.ui.platform.LocalContext.current
 var retry by remember(product.code){mutableIntStateOf(0)}
 val state by produceState<TechnicalState>(TechnicalState.Loading,product.code,product.name,retry){
  value=TechnicalState.Loading
  value=try{TechnicalState.Loaded(withContext(Dispatchers.IO){TechnicalSnapshot.cached(context,product.code,product.name)?:technicalProduct(TechnicalSnapshot.load(context),product.code,product.name)})}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(e:Exception){TechnicalState.Failed}
  try{val updated=withContext(Dispatchers.IO){TechnicalSnapshot.update(context,product.code,product.name)};if(updated!=null)value=TechnicalState.Loaded(updated)}catch(e:kotlinx.coroutines.CancellationException){throw e}catch(_:Exception){/* Keep the cached or bundled offline version. */}
 }
 HorizontalDivider(Modifier.padding(vertical=12.dp))
 LocalizedText("Տեխնիկական բնութագրեր",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
 when(val current=state){
  TechnicalState.Loading->CircularProgressIndicator(Modifier.padding(16.dp).size(24.dp))
  TechnicalState.Failed->{LocalizedText("Չհաջողվեց բեռնել բնութագրերը։ Կրկին փորձեք։");TextButton(onClick={retry++}){LocalizedText("Կրկին բեռնել")}}
  is TechnicalState.Loaded->{
   val info=current.product
   if(info==null)LocalizedText("Այս ճշգրիտ մոդելի հաստատված տեխնիկական տվյալները դեռ չկան։",Modifier.padding(vertical=12.dp))
   else{
    var expanded by remember(product.code){mutableStateOf(false)}
    val shown=if(expanded)info.specifications.indices.toList() else info.main
    for(index in shown){val (name,value)=info.specifications[index]
     Column(Modifier.fillMaxWidth().padding(vertical=9.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
      LocalizedText(name,style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
      LocalizedText(value,style=MaterialTheme.typography.bodyMedium)
     };HorizontalDivider()
    }
    if(info.specifications.size>info.main.size)TextButton(onClick={expanded=!expanded}){LocalizedText(if(expanded)"Ցույց տալ հիմնականը" else "Բոլոր բնութագրերը")}
    LocalizedText("Աղբյուր՝ zigzag.am",Modifier.padding(top=12.dp),style=MaterialTheme.typography.bodySmall)
    LocalizedText("Ստուգված է՝ "+info.checkedAt.take(10),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
   }
  }
 }
}
