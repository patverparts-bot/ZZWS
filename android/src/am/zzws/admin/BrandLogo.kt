package am.zzws.admin

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

private object BrandLogos {
 private val manifest by lazy{runCatching{AppContext.value.assets.open("brand-logos.json").bufferedReader().use{JSONObject(it.readText())}}.getOrElse{JSONObject()}}
 private val domains get()=manifest.optJSONObject("domains")?:JSONObject()
 private val cache=object:LruCache<String,Bitmap>(1024*1024){override fun sizeOf(key:String,value:Bitmap)=value.byteCount}
 private val connections=Semaphore(3)
 private val failures=java.util.concurrent.ConcurrentHashMap<String,Long>()
 private val diskLock=Any()
 private val directory get()=File(AppContext.value.cacheDir,"brand-logos-v1")
 private fun diskFile(domain:String)=File(directory,MessageDigest.getInstance("SHA-256").digest(domain.toByteArray()).joinToString(""){"%02x".format(it)}+".img")
 private fun decode(bytes:ByteArray):Bitmap?{
  if(bytes.size>MAX_BRAND_LOGO_BYTES)return null
  val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true};BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
  if(bounds.outWidth !in 1..256||bounds.outHeight !in 1..256)return null
  return BitmapFactory.decodeByteArray(bytes,0,bytes.size)
 }
 suspend fun load(brand:String):Bitmap?=withContext(Dispatchers.IO){
  val domain=brandLogoDomain(brand,domains)?:return@withContext null
  cache.get(domain)?.let{return@withContext it}
  connections.withPermit{
   ensureActive();cache.get(domain)?.let{return@withPermit it}
   synchronized(diskLock){runCatching{diskFile(domain).takeIf{it.isFile&&it.length()<=MAX_BRAND_LOGO_BYTES}?.readBytes()?.let(::decode)}.getOrNull()}?.let{cache.put(domain,it);return@withPermit it}
   val bundled=manifest.optJSONObject("bundled")
   val entry=bundled?.keys()?.asSequence()?.mapNotNull{bundled.optJSONObject(it)}?.firstOrNull{it.optString("domain")==domain}
   if(entry!=null)runCatching{AppContext.value.assets.open(entry.getString("file")).use{decode(it.readBytes())}}.getOrNull()?.let{cache.put(domain,it);return@withPermit it}
   if(System.currentTimeMillis()-(failures[domain]?:0L)<5*60*1000)return@withPermit null
   try{
    val bytes=readBrandLogo(brandLogoUrl(domain),checkCancelled={ensureActive()})
    val bitmap=bytes?.let(::decode)
    if(bitmap!=null&&bytes!=null){
     cache.put(domain,bitmap)
     synchronized(diskLock){runCatching{
      directory.mkdirs();diskFile(domain).writeBytes(bytes)
      val files=directory.listFiles()?.filter{it.isFile}?.sortedBy{it.lastModified()}.orEmpty();var total=files.sumOf{it.length()}
      for(file in files){if(total<=4*1024*1024)break;val length=file.length();if(file.delete())total-=length}
     }}
     bitmap
    }else{failures[domain]=System.currentTimeMillis();null}
   }catch(error:CancellationException){throw error}catch(_:Exception){failures[domain]=System.currentTimeMillis();null}
  }
 }
}

/** In a circle use a name fallback; beside a caption keep an empty image slot on failure. */
@Composable internal fun BrandLogo(brand:String,modifier:Modifier=Modifier,nameFallback:Boolean=false){
 var bitmap by remember(brand){mutableStateOf<Bitmap?>(null)}
 LaunchedEffect(brand){bitmap=BrandLogos.load(brand)}
 Box(modifier,contentAlignment=Alignment.Center){
  if(bitmap!=null)Image(bitmap!!.asImageBitmap(),contentDescription=if(nameFallback)brand else null,contentScale=ContentScale.Fit,modifier=Modifier.fillMaxSize())
  else if(nameFallback)Text(brand,fontSize=10.sp,lineHeight=12.sp,fontWeight=FontWeight.Bold,maxLines=2,overflow=TextOverflow.Ellipsis,color=ShopInk)
 }
}
@Composable internal fun BrandLabel(brand:String,modifier:Modifier=Modifier){
 Row(modifier,verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)){
  BrandLogo(brand,Modifier.size(18.dp))
  Text(brand,fontSize=10.sp,fontWeight=FontWeight.Bold,maxLines=1,overflow=TextOverflow.Ellipsis,color=ShopInk)
 }
}
