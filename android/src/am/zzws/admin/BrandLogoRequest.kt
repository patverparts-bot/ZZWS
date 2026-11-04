package am.zzws.admin

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.util.Locale

internal const val MAX_BRAND_LOGO_BYTES=256*1024
/** Same domain table and Google favicon endpoint as js/core.js#getBrandLogoHtml. */
internal fun brandLogoDomain(brand:String,domains:JSONObject):String?{
 val name=brand.trim().lowercase(Locale.ROOT)
 if(name.isEmpty()||name in setOf("այլ","—"))return null
 val alias=name.replace(Regex("[\\s'’.-]"),"")
 val domain=domains.optString(name).ifEmpty{domains.optString(alias)}.ifEmpty{name.replace(Regex("\\s+"),"")+".com"}
 return domain.takeIf{it.length<=253&&Regex("[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\\.[a-z]{2,}").matches(it)&&!it.contains("..")}
}
internal fun brandLogoUrl(domain:String)="https://www.google.com/s2/favicons?domain="+URLEncoder.encode(domain,"UTF-8")+"&sz=64"
internal fun trustedBrandLogoUrl(address:String):Boolean=runCatching{
 val uri=URI(address)
 uri.scheme=="https"&&uri.userInfo==null&&uri.port==-1&&uri.fragment==null&&(
  (uri.host=="www.google.com"&&uri.path=="/s2/favicons")||
  (uri.host in setOf("t0.gstatic.com","t1.gstatic.com","t2.gstatic.com","t3.gstatic.com")&&uri.path=="/faviconV2")
 )
}.getOrDefault(false)
internal fun readBrandLogo(source:String,open:(URL)->HttpURLConnection={it.openConnection() as HttpURLConnection},checkCancelled:()->Unit={}):ByteArray?{
 var address=source
 repeat(4){
  checkCancelled();if(!trustedBrandLogoUrl(address))return null
  val connection=open(URL(address))
  try{
   connection.instanceFollowRedirects=false;connection.connectTimeout=4000;connection.readTimeout=5000;connection.useCaches=false
   connection.setRequestProperty("Accept","image/png,image/*;q=0.8")
   val status=connection.responseCode
   if(status in listOf(301,302,303,307,308)){
    address=URI(address).resolve(connection.getHeaderField("Location")?:return null).toString()
   }else{
    if(status!=200||!connection.contentType.orEmpty().startsWith("image/",ignoreCase=true)||connection.contentLengthLong>MAX_BRAND_LOGO_BYTES)return null
    return connection.inputStream.use{input->
     val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(4096)
     while(true){checkCancelled();val count=input.read(buffer);if(count<0)break;if(out.size()+count>MAX_BRAND_LOGO_BYTES)return null;out.write(buffer,0,count)}
     out.toByteArray().takeIf{it.isNotEmpty()}
    }
   }
  }finally{connection.disconnect()}
 }
 return null
}
