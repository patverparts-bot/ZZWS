package am.zzws.admin

import android.graphics.BitmapFactory
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ProductPhotoDecodeRegressionTest {
 @Test fun webPhotoSourcesDecodeUsingAndroidIncludingNegotiatedWebP(){
  val assets=RuntimeEnvironment.getApplication().assets
  val index=assets.open("product-photos.json").bufferedReader().use{JSONObject(it.readText())}
  fun check(code:String,bytes:ByteArray){
   assertFalse("Placeholder $code",isProductPhotoPlaceholder(bytes))
   val bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.size)
   assertNotNull("Android must decode $code",bitmap)
   assertTrue("Photo dimensions $code",bitmap!!.width>0&&bitmap.height>0);bitmap.recycle()
  }
  for(code in index.keys()){
   val path=index.getString(code)
   if(path.startsWith("product-images/"))assets.open(path).use{check(code,it.readBytes())}
  }
  if(System.getenv("ZZWS_PHOTO_LIVE_CHECK")=="true"){
   assertNull("HTTP 200 WebP placeholder must advance fallback",readProductPhoto("https://www.zigzag.am/media/catalog/product/5/2/528117.jpg"))
   for(code in listOf("013411","122300","0147320","528117","53074860","607500")){
   val bytes=productPhotoCandidates(code,index.optString(code)).firstNotNullOfOrNull{readProductPhoto(it)}
   assertNotNull("Native download $code",bytes);check(code,bytes!!)
  }
  }
 }
}
