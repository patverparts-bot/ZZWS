package am.zzws.admin

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class PromotionPolicyTest {
 private fun offer(vararg codes:String)=JSONObject().put("id","published").put("articles",org.json.JSONArray(codes.toList()))
 @Test fun manualListAddsOrdinaryGoodsToAutomaticAccountWholesaleCampaigns(){
  val products=listOf(product("included","isWholesalePromo"),product("retail-only","isPromo"),product("unlisted","isWholesalePromo"),product("ordinary"))
  assertEquals(listOf("included","retail-only","ordinary","unlisted"),publishedOfferProducts(products,offer("included","retail-only","ordinary"),false,"WS",false).map{it.code})
  assertEquals(listOf("included","unlisted"),publishedOfferProducts(products,null,false,"WS",false).map{it.code})
 }
 @Test fun publishedWholesaleCampaignMustMatchTheAccountPriceContext(){
  val products=listOf(product("kp","kpIsPromo"),product("retail","isPromo"))
  val automatic=offer().put("manualArticles",org.json.JSONArray())
  assertTrue(publishedOfferProducts(products,automatic,true,"WS",false).isEmpty())
  assertEquals(listOf("kp"),publishedOfferProducts(products,automatic,true,"KP",false).map{it.code})
  assertTrue(publishedOfferProducts(products,automatic,true,"KP",true).isEmpty())
 }
 @Test fun expiredManualListLeavesAutomaticPromotionsAndHidesUnbuyableGoods(){
  val products=listOf(product("expired","isWholesalePromo"),product("zero","isWholesalePromo",ws=0.0))
  assertEquals(listOf("expired"),publishedOfferProducts(products,offer("expired").put("manualExpiresOn","2000-01-01"),false,"WS",false).map{it.code})
  assertEquals(listOf("expired"),publishedOfferProducts(products,offer("zero","missing"),false,"WS",false).map{it.code})
  val manual=listOf(product("ordinary"),product("zero",ws=0.0))
  assertTrue(publishedOfferProducts(manual,offer("ordinary").put("manualExpiresOn","2000-01-01"),false,"WS",false).isEmpty())
  assertEquals(listOf("ordinary"),publishedOfferProducts(manual,offer("ordinary","zero","other-customer-only"),false,"WS",false).map{it.code})
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
