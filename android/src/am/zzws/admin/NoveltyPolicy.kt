package am.zzws.admin

import java.time.Instant

/** Same stock and server-issued novelty flags as the website's New collection. */
internal fun noveltyInStock(product:Product):Boolean {
 val value=product.data.opt("stockAvailable")
 return when(value){
  true->true
  false->false
  null,org.json.JSONObject.NULL->product.data.optDouble("targetWarehousesStock",0.0)>=3||product.stock=="Առկա է"
  else->false
 }
}
internal fun noveltyExpiry(product:Product):Long?=product.data.text("newUntil").takeIf{it.isNotBlank()}?.let{runCatching{Instant.parse(it).toEpochMilli()}.getOrNull()}
internal fun isNovelty(product:Product,now:Long):Boolean {
 if(!product.data.optBoolean("isNew")||!noveltyInStock(product))return false
 return product.data.text("newUntil").isBlank()||(noveltyExpiry(product)?.let{it>now}==true)
}
internal fun noveltyProducts(products:List<Product>,now:Long)=products.filter{isNovelty(it,now)}
internal fun nextNoveltyExpiry(products:List<Product>,now:Long)=products.filter{isNovelty(it,now)}.mapNotNull(::noveltyExpiry).filter{it>now}.minOrNull()
