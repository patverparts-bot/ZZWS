package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import java.net.HttpURLConnection
import java.net.URL
import java.io.ByteArrayInputStream
import java.io.File
import org.json.JSONObject

class ProductPhotoRequestTest {
 private val source="https://www.zigzag.am/media/catalog/product/0/1/013411.jpg"
 private class Reply(url:URL,val status:Int=200,val mime:String="image/jpeg",val bytes:ByteArray=byteArrayOf(1,2,3),val location:String?=null,val length:Long=bytes.size.toLong()):HttpURLConnection(url){
  var disconnected=false
  override fun connect(){};override fun disconnect(){disconnected=true};override fun usingProxy()=false
  override fun getResponseCode()=status
  override fun getContentType()=mime
  override fun getContentLengthLong()=length
  override fun getHeaderField(name:String)=if(name=="Location")location else null
  override fun getInputStream()=ByteArrayInputStream(bytes)
 }
 @Test fun absentMappingStillTriesArticlePathsAndKeepsLeadingZeroes(){
  val choices=productPhotoCandidates(" 013411 ","")
  assertEquals(source,choices.first());assertEquals(10,choices.size);assertTrue(choices.all(::trustedProductPhoto))
  assertTrue(choices.any{it.endsWith("/013411.png")});assertTrue(choices.any{it.contains("/cache/811d9bdbaebf1cf745388b9849057259/")})
 }
 @Test fun corruptedAbsoluteMappingIsRepairedAndOriginalBypassesStaleCache(){
  val original="https://www.zigzag.am/media/catalog/product/c/a/new.jpg"
  val cached=original.replace("/product/","/product/cache/"+"a".repeat(32)+"/")
  val choices=productPhotoCandidates("0147320","https://www.zigzag.am/media/catalog/product/cache/old/"+cached)
  assertEquals(cached,choices[0]);assertEquals(original,choices[1])
 }
 @Test fun imageRedirectFollowsOnlyTrustedHttpsMediaAndNeverAddsAccountHeaders(){
  val seen=mutableListOf<Reply>()
  val bytes=readProductPhoto(source,open={url->Reply(url,if(seen.isEmpty())302 else 200,location="/media/catalog/product/new.jpg").also{seen.add(it)}})
  assertArrayEquals(byteArrayOf(1,2,3),bytes);assertEquals(2,seen.size)
  assertTrue(seen.all{it.disconnected&&!it.instanceFollowRedirects})
  for(reply in seen){assertNull(reply.getRequestProperty("Authorization"));assertNull(reply.getRequestProperty("apikey"));assertNull(reply.getRequestProperty("Cookie"))}
 }
 @Test fun offsiteRedirectAndInvalidContentAreRejected(){
  var calls=0
  assertNull(readProductPhoto(source,open={url->calls++;Reply(url,302,location="https://example.invalid/private")}));assertEquals(1,calls)
  for(reply in listOf(Reply(URL(source),404),Reply(URL(source),mime="text/html"),Reply(URL(source),length=MAX_PHOTO_BYTES+1L),Reply(URL(source),bytes=ByteArray(MAX_PHOTO_BYTES+1),length=-1))){assertNull(readProductPhoto(source,open={reply}));assertTrue(reply.disconnected)}
  for(url in listOf("http://www.zigzag.am/media/catalog/product/a.jpg","https://www.zigzag.am.evil.invalid/media/catalog/product/a.jpg","https://www.zigzag.am/admin/private","https://name:password@www.zigzag.am/media/catalog/product/a.jpg")){
   assertFalse(trustedProductPhoto(url));assertNull(readProductPhoto(url,open={throw AssertionError("Untrusted request") }))
  }
 }
 @Test fun redirectLoopsAndCancelledLoadsAreBounded(){
  var calls=0;assertNull(readProductPhoto(source,open={url->calls++;Reply(url,302,location=source)}));assertEquals(4,calls)
  try{readProductPhoto(source,checkCancelled={throw kotlinx.coroutines.CancellationException("test")});fail("Cancellation swallowed")}catch(_:kotlinx.coroutines.CancellationException){}
 }
 @Test fun successfulWebPPlaceholderResponseIsRejectedButOtherBodiesOfTheSameLengthAreNot(){
  val placeholder=File("unit-tests/fixtures/missing-photo.webp").readBytes()
  assertTrue(isProductPhotoPlaceholder(placeholder))
  assertNull(readProductPhoto(source,open={Reply(it,bytes=placeholder,mime="image/webp")}))
  assertFalse(isProductPhotoPlaceholder(placeholder.copyOf().also{it[it.lastIndex]=1}))
 }
 @Test fun livePublicImageRequestsUseTheActualNativeTransport(){
  assumeTrue(System.getenv("ZZWS_PHOTO_LIVE_CHECK")=="true")
  val index=JSONObject(File("assets/product-photos.json").readText())
  for(code in listOf("013411","122300","0147320","528117","53074860","607500")){
   val bytes=productPhotoCandidates(code,index.optString(code)).firstNotNullOfOrNull{runCatching{readProductPhoto(it)}.getOrNull()}
   assertNotNull("Public photo $code did not load",bytes)
   assertFalse("Photo $code must not be a successful placeholder response",isProductPhotoPlaceholder(bytes!!))
   // The server negotiates WebP even for PNG URLs; Android decoding is covered separately.
   assertTrue("Photo $code must contain an image body",bytes.size>100)
  }
 }
}
