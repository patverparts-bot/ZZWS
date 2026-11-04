package am.zzws.admin
import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import org.json.JSONArray

class PartnerPolicyTest {
 @Test fun onlyTheCustomerManagerCanOpenTeamManagement(){
  assertTrue(canOpenFeature(PartnerFeature.TEAM,JSONObject().put("role","client").put("clientRole","manager").put("active",true)))
  assertFalse(canOpenFeature(PartnerFeature.TEAM,JSONObject().put("role","client").put("clientRole","employee").put("active",true)))
  assertFalse(canOpenFeature(PartnerFeature.TEAM,JSONObject().put("role","admin").put("active",true)))
 }
 @Test fun viberNavigationAllowsOnlyManualShare(){
  assertTrue(viberShareLink("viber://forward?text=Order%20%2342%0AHello"))
  assertTrue(viberShareLink("viber://forward?text=%D4%B2%D5%A1%D6%80%D6%87"))
  assertTrue(viberShareLink("viber://forward?text="+"a".repeat(2000)))
  for(url in listOf("viber://chat?number=%2B37491123456&draft=Hello", "viber://forward?text=Hello&number=%2B37491123456", "viber://pa?chatURI=other", "intent://forward?text=Hello", "https://viber.com/", "viber://forward?text=Hello#extra", "viber://forward?text=Hello&text=Other", "viber://forward?text=%ZZ", "viber://forward?text=%00", "viber://forward?text=%7F", "viber://forward?text=", "viber://forward?text="+"a".repeat(2001), "viber://user@forward?text=Hello", "viber://forward:42?text=Hello", "viber://forward/path?text=Hello"))assertFalse(url,viberShareLink(url))
 }
 @Test fun onlyTheExactWebsiteReceivesTheSession(){
  assertEquals("https://zzws-1z2.pages.dev/",PARTNER_SITE)
  assertTrue(trustedPartnerPage(PARTNER_SITE))
  assertTrue(trustedPartnerPage(PARTNER_SITE+"admin/#tab=users"))
  assertTrue(trustedPartnerPage(LEGACY_PARTNER_SITE))
  assertTrue(trustedPartnerPage(LEGACY_PARTNER_SITE+"admin/#tab=users"))
  assertTrue(trustedPartnerPage("https://zzws-1z2.pages.dev:443/admin/"))
  for(url in listOf("http://zzws-1z2.pages.dev/","https://zzws-1z2.pages.dev.evil.test/","https://main.zzws-1z2.pages.dev/","https://evil.test/","https://user@zzws-1z2.pages.dev/","https://zzws-1z2.pages.dev:444/","https://zzws-1z2.pages.dev/%2e%2e/","https://zzws-1z2.pages.dev/a/../admin/"))assertFalse(url,trustedPartnerPage(url))
  for(url in listOf("http://patverparts-bot.github.io/ZZWS/","https://patverparts-bot.github.io.evil.test/ZZWS/","https://patverparts-bot.github.io/other/","https://user@patverparts-bot.github.io/ZZWS/","https://patverparts-bot.github.io/ZZWS/%2e%2e/","file:///ZZWS/index.html","https://patverparts-bot.github.io:444/ZZWS/"))assertFalse(url,trustedPartnerPage(url))
 }
 @Test fun canonicalAndLegacyPathsShareOnlyTheSameReviewedAdminAndAssetRules(){
  for(site in listOf(PARTNER_SITE,LEGACY_PARTNER_SITE)){
   assertEquals("/admin/",partnerPagePath(site+"admin/#tab=users"))
   assertTrue(partnerAdminPage(site+"admin/#tab=manager"));assertFalse(partnerAdminPage(site+"administrator/"))
   assertFalse(partnerAdminPage(site));assertEquals("dealer-tools.js",partnerBundledAsset(site+"js/dealer-tools.js?v=1"))
   assertEquals("bundle-policy.js",partnerBundledAsset(site+"js/bundle-policy.js"));assertNull(partnerBundledAsset(site+"other/js/dealer-tools.js"))
  }
  assertNull(partnerPagePath("https://evil.test/admin/"));assertNull(partnerBundledAsset("https://evil.test/js/dealer-tools.js"))
 }
 @Test fun blobDownloadsRemainPinnedToExactCanonicalOrLegacyOrigin(){
  assertTrue(trustedPartnerBlob("blob:https://zzws-1z2.pages.dev/00000000-0000-4000-8000-000000000000"))
  assertTrue(trustedPartnerBlob("blob:https://patverparts-bot.github.io/00000000-0000-4000-8000-000000000000"))
  for(url in listOf("blob:https://zzws-1z2.pages.dev.evil.test/id","blob:https://preview.zzws-1z2.pages.dev/id","blob:http://zzws-1z2.pages.dev/id","blob:https://user@zzws-1z2.pages.dev/id","blob:https://zzws-1z2.pages.dev:444/id","https://zzws-1z2.pages.dev/id","blob:null/id"))assertFalse(url,trustedPartnerBlob(url))
 }
 @Test fun supplementalToolsKeepExistingPermissionBoundaries(){
  val client=JSONObject().put("role","client").put("active",true)
  assertTrue(canOpenFeature(PartnerFeature.ASSISTANT,client))
  assertFalse(canOpenFeature(PartnerFeature.ADMIN,client))
  val price=JSONObject().put("role","admin").put("permissions",JSONArray().put("price:read"))
  assertTrue(canOpenFeature(PartnerFeature.PRICES,price))
  assertFalse(canOpenFeature(PartnerFeature.CLIENTS,price))
  assertFalse(canOpenFeature(PartnerFeature.ADMIN,JSONObject().put("role","admin")))
  assertFalse(canOpenFeature(PartnerFeature.ASSISTANT,client.put("active",false)))
 }
 @Test fun selectionSendsOnlySelectedLinesAndDefaultsNewItemsToSelected(){
  val cart=mapOf("001" to 2,"002" to 3,"003" to 1)
  assertEquals(mapOf("001" to 2,"003" to 1),selectedCart(cart,mapOf("002" to false)))
  assertEquals(cart,selectedCart(cart,emptyMap()))
  assertTrue(selectedCart(cart,cart.keys.associateWith{false}).isEmpty())
 }
 @Test fun aFavoriteTogglePreservesChangesFromOtherDevices(){
  assertEquals(setOf("003","001"),favoriteChange(setOf("003"),"001",true))
  assertEquals(setOf("003"),favoriteChange(setOf("001","003"),"001",false))
  assertEquals(setOf("001"),favoriteChange(setOf("001"),"001",true))
 }
 @Test fun orderPaginationRetainsAllFiltersAndEncodesSearch(){
  assertEquals("orders",orderHistoryPath("","",""))
  assertEquals("orders?search=AA%26BB&from=2026-10-01&to=2026-10-31&before=100",orderHistoryPath("AA&BB","2026-10-01","2026-10-31",100))
 }
 @Test(expected=IllegalArgumentException::class) fun orderFiltersRejectReversedDates(){orderHistoryPath("","2026-10-31","2026-10-01")}
 @Test fun managementTasksFollowTheServerScopePermissions(){
  fun admin(vararg rights:String)=JSONObject().put("role","admin").put("permissions",JSONArray(rights.toList()))
  val manager=admin("orders:read","orders:write")
  assertTrue(canOpenFeature(PartnerFeature.DASHBOARD,manager));assertFalse(canOpenFeature(PartnerFeature.PRICES,manager));assertFalse(canOpenFeature(PartnerFeature.CLIENTS,manager))
  val viewer=admin("orders:read","price:read")
  assertTrue(canOpenFeature(PartnerFeature.PRICES,viewer));assertFalse(canOpenFeature(PartnerFeature.CLIENTS,viewer));assertFalse(canSelectCustomer(viewer))
  val price=admin("price:read","price:write")
  assertTrue(canOpenFeature(PartnerFeature.PRICES,price));assertFalse(canOpenFeature(PartnerFeature.CLIENTS,price));assertFalse(canSelectCustomer(price))
  val owner=admin("orders:read","orders:write","users","price:read","price:write").put("mobileAdminEnabled",true)
  assertTrue(canOpenFeature(PartnerFeature.CLIENTS,owner));assertTrue(canSelectCustomer(owner))
 }
}
