package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PromotionPolicyTest {
 private fun offer(vararg codes:String)=JSONObject().put("id","published").put("articles",org.json.JSONArray(codes.toList()))
 @Test fun publishedListExcludesRetailOnlyAndUnlistedWholesaleCampaigns(){
  val products=listOf(product("included","isWholesalePromo"),product("retail-only","isPromo"),product("unlisted","isWholesalePromo"),product("ordinary"))
  assertEquals(listOf("included"),publishedOfferProducts(products,offer("included","retail-only","ordinary"),false,"WS",false).map{it.code})
  assertTrue(publishedOfferProducts(products,null,false,"WS",false).isEmpty())
 }
 @Test fun publishedWholesaleCampaignMustMatchTheAccountPriceContext(){
  val products=listOf(product("kp","kpIsPromo"),product("retail","isPromo"))
  assertTrue(publishedOfferProducts(products,offer("kp","retail"),true,"WS",false).isEmpty())
  assertEquals(listOf("kp"),publishedOfferProducts(products,offer("kp","retail"),true,"KP",false).map{it.code})
  assertTrue(publishedOfferProducts(products,offer("kp","retail"),true,"KP",true).isEmpty())
 }
 @Test fun expiredOrUnbuyablePublishedProductsAreHiddenWithoutFallback(){
  val products=listOf(product("expired","isWholesalePromo"),product("zero","isWholesalePromo",ws=0.0))
  assertTrue(publishedOfferProducts(products,offer("expired").put("expiresOn","2000-01-01"),false,"WS",false).isEmpty())
  assertTrue(publishedOfferProducts(products,offer("zero","missing"),false,"WS",false).isEmpty())
 }
 private fun product(code:String,flag:String?=null,ws:Double=100.0,kp:Double=80.0,retail:Double=150.0):Product{
  val data=JSONObject().put("articul",code).put("name",code).put("brand","Test").put("category","TV").put("wholesale",ws).put("kpPrice",kp).put("retail",retail)
  if(flag!=null)data.put(flag,true)
  return Product(data)
 }
 @Test fun ordinaryWholesaleMarginNeverCreatesASpecialOffer(){
  val products=(1..10).map{product("$it")}
  assertTrue(promotionProducts(products,false,"WS",false).isEmpty())
  assertTrue(promotionProducts(emptyList(),true,"KP",false).isEmpty())
 }
 @Test fun kpOnlyPromotionDoesNotAdvertiseAnUnchangedWsPrice(){
  val product=product("kp","kpIsPromo")
  assertNull(promotionKind(product,true,"WS",false))
  assertEquals(PromotionKind.KP,promotionKind(product,true,"KP",false))
  assertNull(promotionKind(product,false,"KP",false));assertNull(promotionKind(product,true,"KP",true))
 }
 @Test fun projectedCustomerPromotionUsesTheAccountPriceEvenForKpCustomers(){
  val product=product("account","isWholesalePromo")
  assertEquals(PromotionKind.ACCOUNT,promotionKind(product,false,"KP",false))
  assertEquals(PromotionKind.ACCOUNT,promotionKind(product,true,"KP",true))
  assertNull(promotionKind(product,true,"KP",false))
 }
 @Test fun retailPromotionIsExplicitlyLabelledAndDoesNotInventAWholesaleDiscount(){
  val product=product("retail","isPromo")
  assertEquals(PromotionKind.RETAIL,promotionKind(product,true,"WS",false))
  assertEquals(PromotionKind.RETAIL,promotionKind(product,true,"KP",false))
  assertEquals(100.0,nativePrice(product,true,"WS",false),0.0)
  assertNull(promotionKind(product("invalid","isPromo",retail=0.0),false,"WS",false))
 }
 @Test fun missingOrUnbuyableSelectedPricesNeverBecomeSpecialOffers(){
  assertNull(promotionKind(product("ws-zero","isPromo",ws=0.0),true,"WS",false))
  assertNull(promotionKind(product("kp-zero","kpIsPromo",kp=0.0),true,"KP",false))
  assertNull(promotionKind(product("negative","isWholesalePromo",ws=-1.0),false,"WS",false))
 }
 @Test fun homePreviewAllOffersAndFilterCountUseTheSamePriceContext(){
  val products=(1..8).map{product("$it","isWholesalePromo")}+product("kp","kpIsPromo")+product("ordinary")
  val matches={p:Product->promotionKind(p,true,"WS",false)!=null}
  val all=promotionProducts(products,true,"WS",false)
  val filtered=visibleProducts(products,"",emptySet(),emptySet(),false,true,0,{it.price},matches)
  assertEquals(8,all.size);assertEquals(6,all.take(6).size);assertEquals(all.map{it.code}.toSet(),filtered.map{it.code}.toSet())
  assertEquals(all.size,catalogFilterCount(products,"",CatalogFilters(onlyPromo=true),matches))
  assertEquals(listOf("kp"),promotionProducts(products,true,"KP",false).map{it.code})
 }
}
