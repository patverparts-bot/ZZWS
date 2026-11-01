package am.zzws.admin

import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

internal const val MAX_PHOTO_BYTES=4*1024*1024
private const val PHOTO_ORIGIN="https://www.zigzag.am"
internal fun isProductPhotoPlaceholder(bytes:ByteArray):Boolean{
 if(bytes.size!=106707&&bytes.size!=20048&&bytes.size!=12430)return false
 val hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}
 return hash in setOf("3a65f7e45a2c5bb9f3a7cabfc05202b7ee8924ad9fd0421c106f87d759f1819c","9499bbdcdb776d43ad9d00e15ed5e815af7870293aa49d6ee9558764c1371834","cd8aea8dbd8649eca97fb4b8c1bf67b1d6986a82badf38a21f3b502727f3709d")
}

internal fun trustedProductPhoto(raw:String):Boolean=runCatching{
 val u=URI(raw)
 u.scheme=="https"&&u.host in setOf("www.zigzag.am","zigzag.am")&&u.port in setOf(-1,443)&&u.userInfo==null&&u.fragment==null&&
  (u.path.startsWith("/media/catalog/product/")||u.path.startsWith("/pub/media/catalog/product/"))&&u.normalize().path==u.path&&!u.path.contains("\\")&&u.path.split('/').none{it==".."||it=="."}
}.getOrDefault(false)

internal fun productPhotoCandidates(article:String,mapped:String):List<String>{
 val code=article.trim()
 // Older generated indexes accidentally prefixed an already absolute URL.
 val fixed=mapped.trim().let{if(it.lastIndexOf("https://")>0)it.substring(it.lastIndexOf("https://"))else it}
 val source=if(fixed.startsWith("/media/catalog/product/"))PHOTO_ORIGIN+fixed else fixed
 val urls=mutableListOf<String>()
 if(trustedProductPhoto(source)){
  urls.add(source);urls.add(source.replace(Regex("/cache/[a-fA-F0-9]{32}/"),"/"))
 }
 if(code.matches(Regex("[A-Za-z0-9_-][A-Za-z0-9._-]{0,79}"))){
  val first=code.take(1);val second=code.drop(1).take(1).ifEmpty{"0"}
  urls.add("$PHOTO_ORIGIN/media/catalog/product/$first/$second/$code.jpg")
  for(extension in listOf("jpg","png","jpeg","webp"))urls.add("$PHOTO_ORIGIN/media/catalog/product/cache/811d9bdbaebf1cf745388b9849057259/$first/$second/$code.$extension")
  for(extension in listOf("png","jpeg","webp"))urls.add("$PHOTO_ORIGIN/media/catalog/product/$first/$second/$code.$extension")
  urls.add("$PHOTO_ORIGIN/pub/media/catalog/product/$first/$second/$code.jpg")
  urls.add("$PHOTO_ORIGIN/media/catalog/product/$code.jpg")
 }
 return urls.distinct().filter(::trustedProductPhoto)
}

/** Public images only. Never reuse account headers, tokens or cookies. */
internal fun readProductPhoto(source:String,open:(URL)->HttpURLConnection={it.openConnection() as HttpURLConnection},checkCancelled:()->Unit={}):ByteArray?{
 var address=source
 repeat(4){
  checkCancelled();if(!trustedProductPhoto(address))return null
  val connection=open(URL(address))
  try{
   connection.instanceFollowRedirects=false;connection.connectTimeout=5000;connection.readTimeout=7000;connection.useCaches=false
   connection.setRequestProperty("Accept","image/webp,image/png,image/jpeg,image/*;q=0.8")
   connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 ZZWS")
   val status=connection.responseCode
   if(status in listOf(301,302,303,307,308)){
    val location=connection.getHeaderField("Location")?:return null;address=URI(address).resolve(location).toString()
   }else{
    if(status!=200||!connection.contentType.orEmpty().startsWith("image/",ignoreCase=true)||connection.contentLengthLong>MAX_PHOTO_BYTES)return null
    return connection.inputStream.use{input->
     val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
     while(true){checkCancelled();val count=input.read(buffer);if(count<0)break;if(out.size()+count>MAX_PHOTO_BYTES)return null;out.write(buffer,0,count)}
     out.toByteArray().takeIf{it.isNotEmpty()&&!isProductPhotoPlaceholder(it)}
    }
   }
  }finally{connection.disconnect()}
 }
 return null
}
