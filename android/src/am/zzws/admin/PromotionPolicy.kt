package am.zzws.admin

internal enum class PromotionKind(val label:String){
 ACCOUNT("Ակցիա"),KP("KP ակցիա"),RETAIL("Մանրածախ ակցիա")
}
/** Server flags are authoritative; the retail/wholesale margin is never a discount. */
internal fun promotionKind(product:Product,isAdmin:Boolean,mode:String,viewingBuyer:Boolean):PromotionKind?{
 val price=nativePrice(product,isAdmin,mode,viewingBuyer)
 if(!price.isFinite()||price<=0)return null
 val usingKp=isAdmin&&!viewingBuyer&&mode=="KP"
 return when{
  usingKp&&product.data.optBoolean("kpIsPromo")->PromotionKind.KP
  !usingKp&&product.data.optBoolean("isWholesalePromo")->PromotionKind.ACCOUNT
  product.data.optBoolean("isPromo")&&product.retail.isFinite()&&product.retail>0->PromotionKind.RETAIL
  else->null
 }
}
internal fun promotionProducts(products:List<Product>,isAdmin:Boolean,mode:String,viewingBuyer:Boolean)=products.filter{promotionKind(it,isAdmin,mode,viewingBuyer)!=null}

/** Automatic account wholesale promotions plus the live manually selected list. */
internal fun publishedOfferProducts(products:List<Product>,offer:org.json.JSONObject?,isAdmin:Boolean,mode:String,viewingBuyer:Boolean):List<Product>{
 val automatic=products.filter{val kind=promotionKind(it,isAdmin,mode,viewingBuyer);kind==PromotionKind.ACCOUNT||kind==PromotionKind.KP}
 if(offer==null)return automatic
 val expires=offer.text("manualExpiresOn").ifEmpty{offer.text("expiresOn")}
 if(expires.isNotEmpty()&&expires<java.time.LocalDate.now(java.time.ZoneId.of("Asia/Yerevan")).toString())return automatic
 val articles=offer.optJSONArray("manualArticles")?:offer.optJSONArray("articles")?:return automatic
 val byCode=products.associateBy{it.code}
 val manual=(0 until articles.length()).mapNotNull{byCode[articles.optString(it)]}.distinctBy{it.code}.filter{
  val price=nativePrice(it,isAdmin,mode,viewingBuyer);price.isFinite()&&price>0
 }
 return (manual+automatic).distinctBy{it.code}
}
