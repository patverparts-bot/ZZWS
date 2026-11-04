package am.zzws.admin
import org.junit.Assert.*
import org.junit.Test
import java.net.URI

class CloudflareTechnicalUrlTest {
 @Test fun technicalFactsUseOnlyCanonicalPublicHostAndHashedSkuPath(){
  for(code in listOf("001234","../../admin/?token=secret","Հայերեն SKU")){
   val uri=URI(technicalDocumentUrl(code))
   assertEquals("https",uri.scheme);assertEquals("zzws-1z2.pages.dev",uri.host)
   assertEquals("/js/product-specifications/items/"+technicalFile(code),uri.path)
   assertNull(uri.query);assertNull(uri.fragment);assertNull(uri.userInfo)
  }
 }
}
