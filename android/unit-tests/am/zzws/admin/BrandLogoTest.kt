package am.zzws.admin

import org.junit.Test
import org.junit.Assert.*
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class BrandLogoTest {
 private val manifest get()=JSONObject(File("assets/brand-logos.json").readText())
 private class Reply(url:URL,val status:Int=200,val mime:String="image/png",val bytes:ByteArray=byteArrayOf(1,2,3),val location:String?=null,val length:Long=bytes.size.toLong()):HttpURLConnection(url){
  var disconnected=false
  override fun connect(){};override fun disconnect(){disconnected=true};override fun usingProxy()=false
  override fun getResponseCode()=status
  override fun getContentType()=mime
  override fun getContentLengthLong()=length
  override fun getHeaderField(name:String)=if(name=="Location")location else null
  override fun getInputStream()=ByteArrayInputStream(bytes)
 }
 @Test fun allWebsiteDomainsUseExactlyTheSameFaviconSource(){
  val source=File("../js/core.js").readText()
  val block=source.substringAfter("const brandDomains = {").substringBefore("\n};")
  val pairs=Regex("'([^']+)'\\s*:\\s*'([^']+)'").findAll(block).map{it.groupValues[1] to it.groupValues[2]}.toList()
  assertEquals(pairs.size,manifest.getJSONObject("domains").length())
  for((brand,domain)in pairs){assertEquals(domain,brandLogoDomain("  "+brand.uppercase()+" ",manifest.getJSONObject("domains")));assertEquals("https://www.google.com/s2/favicons?domain=$domain&sz=64",brandLogoUrl(domain))}
 }
 @Test fun namesRetainWebsiteFallbackAndAliasesWithoutAcceptingUrls(){
  val domains=manifest.getJSONObject("domains")
  assertEquals("roborock.com",brandLogoDomain("ROBOROCK",domains));assertEquals("delonghi.com",brandLogoDomain("De’Longhi",domains))
  for(name in listOf("","—","Այլ","https://example.com","bad/name","bad&name","a..b"))assertNull(name,brandLogoDomain(name,domains))
 }
 @Test fun bundledDemoLogosAreRealDecodableImagesFromWebsiteEndpoint(){
  val bundled=manifest.getJSONObject("bundled")
  for(brand in listOf("apple","asus","bosch","delonghi","dyson","jbl","lenovo","lg","marshall","roborock","samsung","sony")){
   val entry=bundled.getJSONObject(brand);assertEquals(brandLogoUrl(entry.getString("domain")),entry.getString("source"))
   val bytes=File("assets/"+entry.getString("file")).readBytes();assertTrue(bytes.size<=MAX_BRAND_LOGO_BYTES)
   val hash=java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)};assertEquals(entry.getString("sha256"),hash)
   val image=Class.forName("javax.imageio.ImageIO").getMethod("read",java.io.InputStream::class.java).invoke(null,ByteArrayInputStream(bytes))
   assertNotNull(brand,image)
  }
 }
 @Test fun googleRedirectNeverIncludesAccountHeaders(){
  val seen=mutableListOf<Reply>()
  val source=brandLogoUrl("apple.com")
  val bytes=readBrandLogo(source,open={url->Reply(url,if(seen.isEmpty())302 else 200,location="https://t2.gstatic.com/faviconV2?url=https://apple.com&size=64").also{seen.add(it)}})
  assertArrayEquals(byteArrayOf(1,2,3),bytes);assertEquals(2,seen.size)
  for(reply in seen){assertTrue(reply.disconnected);assertFalse(reply.instanceFollowRedirects);for(header in listOf("Authorization","apikey","Cookie"))assertNull(reply.getRequestProperty(header))}
 }
 @Test fun untrustedRedirectsAndInvalidImagesAreRejectedAndRequestsAreBounded(){
  val source=brandLogoUrl("apple.com")
  for(url in listOf("http://www.google.com/s2/favicons","https://www.google.com.evil.invalid/s2/favicons","https://www.google.com/account","https://user:pass@www.google.com/s2/favicons","https://t2.gstatic.com/other")){
   assertFalse(trustedBrandLogoUrl(url));assertNull(readBrandLogo(url,open={throw AssertionError("Unexpected request")}))
  }
  var calls=0;assertNull(readBrandLogo(source,open={url->calls++;Reply(url,302,location="https://example.com/private")}));assertEquals(1,calls)
  calls=0;assertNull(readBrandLogo(source,open={url->calls++;Reply(url,302,location=source)}));assertEquals(4,calls)
  for(reply in listOf(Reply(URL(source),404),Reply(URL(source),mime="text/html"),Reply(URL(source),length=MAX_BRAND_LOGO_BYTES+1L),Reply(URL(source),bytes=ByteArray(MAX_BRAND_LOGO_BYTES+1),length=-1))){assertNull(readBrandLogo(source,open={reply}));assertTrue(reply.disconnected)}
  try{readBrandLogo(source,checkCancelled={throw kotlinx.coroutines.CancellationException("test")});fail("Cancellation swallowed")}catch(_:kotlinx.coroutines.CancellationException){}
 }
}
