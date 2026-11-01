package am.zzws.admin

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

private object ProductPhotos {
 val paths:JSONObject by lazy{runCatching{AppContext.value.assets.open("product-photos.json").bufferedReader().use{JSONObject(it.readText())}}.getOrElse{JSONObject()}}
 val cache=object:LruCache<String,Bitmap>(8*1024*1024){override fun sizeOf(key:String,value:Bitmap)=value.byteCount}
 private val connections=Semaphore(4)
 private val diskLock=Any()
 private val directory get()=File(AppContext.value.cacheDir,"product-photos-v2")
 private fun diskFile(url:String)=File(directory,MessageDigest.getInstance("SHA-256").digest(url.toByteArray(Charsets.UTF_8)).joinToString(""){"%02x".format(it)})
 private fun decode(bytes:ByteArray):Bitmap?{
  if(isProductPhotoPlaceholder(bytes))return null
  val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
  if(bounds.outWidth<=0||bounds.outHeight<=0)return null
  val options=BitmapFactory.Options().apply{inSampleSize=1}
  while(bounds.outWidth/options.inSampleSize>800||bounds.outHeight/options.inSampleSize>800)options.inSampleSize*=2
  return BitmapFactory.decodeByteArray(bytes,0,bytes.size,options)
 }
 private fun fromDisk(url:String):Bitmap?=synchronized(diskLock){runCatching{
  val file=diskFile(url)
  if(!file.isFile)return@runCatching null
  if(file.length()>MAX_PHOTO_BYTES||System.currentTimeMillis()-file.lastModified()>7*24*60*60*1000L){file.delete();return@runCatching null}
  decode(file.readBytes()).also{if(it==null)file.delete()}
 }.getOrNull()}
 private fun saveDisk(url:String,bytes:ByteArray)=synchronized(diskLock){runCatching{
  directory.mkdirs();diskFile(url).writeBytes(bytes)
  val files=directory.listFiles()?.filter{it.isFile}?.sortedBy{it.lastModified()}.orEmpty();var total=files.sumOf{it.length()}
  for(file in files){if(total<=32*1024*1024)break;val size=file.length();if(file.delete())total-=size}
 };Unit}
 suspend fun load(code:String):Bitmap?=withTimeoutOrNull(25000){withContext(Dispatchers.IO){
  val mapped=paths.optString(code.trim())
  if(mapped.matches(Regex("product-images/[A-Za-z0-9_-]+\\.(png|jpg|jpeg|webp)"))){
   runCatching{AppContext.value.assets.open(mapped).use{decode(it.readBytes())}}.getOrNull()?.let{return@withContext it}
  }
  runCatching{AppContext.value.assets.open("demo-photos/$code.img").use{decode(it.readBytes())}}.getOrNull()?.let{return@withContext it}
  val urls=productPhotoCandidates(code,mapped)
  for(url in urls){cache.get(url)?.let{return@withContext it}}
  connections.withPermit{
   for(url in urls){
    ensureActive();cache.get(url)?.let{return@withPermit it}
    fromDisk(url)?.let{cache.put(url,it);return@withPermit it}
   }
   for(url in urls){
    ensureActive()
    try{
     val bytes=readProductPhoto(url,checkCancelled={ensureActive()})?:continue
     val bitmap=decode(bytes)?:continue
     cache.put(url,bitmap);saveDisk(url,bytes);return@withPermit bitmap
    }catch(error:CancellationException){throw error}catch(_:Exception){/* Try the next public image URL. */}
   }
   null
  }
 }}
}

private sealed interface PhotoState {
 data object Loading:PhotoState
 data class Ready(val bitmap:Bitmap):PhotoState
 data object Failed:PhotoState
}
@Composable internal fun ProductPhoto(code:String,large:Boolean=false,edge:Int=if(large)220 else 64,onTechnical:(()->Unit)?=null,interactive:Boolean=true){
 var retry by remember(code){mutableIntStateOf(0)}
 val state by produceState<PhotoState>(PhotoState.Loading,code,retry){
  value=PhotoState.Loading
  value=ProductPhotos.load(code)?.let{PhotoState.Ready(it)}?:PhotoState.Failed
 }
 val technicalLabel=localizedDescription("Տեխնիկական բնութագրեր")
 Box(Modifier.size(edge.dp).then(if(interactive&&onTechnical!=null)Modifier.clickable(role=Role.Button,onClickLabel=technicalLabel){onTechnical()}else Modifier),contentAlignment=Alignment.Center){
  when(val photo=state){
   is PhotoState.Ready->Image(photo.bitmap.asImageBitmap(),contentDescription=localizedDescription("Ապրանքի լուսանկար"),contentScale=ContentScale.Fit,modifier=Modifier.fillMaxSize())
   PhotoState.Loading->CircularProgressIndicator(Modifier.size(if(large)32.dp else 22.dp),strokeWidth=2.dp)
   PhotoState.Failed->Column(Modifier.fillMaxSize().then(if(interactive)Modifier.clickable(role=Role.Button,onClickLabel="Կրկին բեռնել լուսանկարը"){if(onTechnical!=null)onTechnical()else retry++}else Modifier).padding(4.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
    AppIcon("refresh")
    LocalizedText(if(large)"Լուսանկարը չբեռնվեց"else"Նկար չկա",fontSize=if(large)14.sp else 10.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
    if(interactive)LocalizedText(if(onTechnical!=null)"Բնութագրեր"else"Կրկնել",fontSize=if(large)14.sp else 10.sp,color=MaterialTheme.colorScheme.primary)
   }
  }
 }
}
