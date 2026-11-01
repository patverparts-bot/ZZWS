package am.zzws.admin

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeNavigationPolicyTest {
 private fun admin(mobile:Boolean,vararg rights:String)=JSONObject().put("role","admin").put("active",true).put("mobileAdminEnabled",mobile).put("permissions",JSONArray(rights.toList()))
 @Test fun ordersUseNativeOrDirectWebManagementAccordingToActualAdminCapability(){
  assertEquals(OrdersDestination.NATIVE,ordersDestination(admin(true,"orders:read")))
  assertEquals(OrdersDestination.WEB,ordersDestination(admin(false,"orders:read","orders:write")))
  assertEquals("admin/#tab=manager",PartnerFeature.ORDERS.path)
  assertTrue(canOpenFeature(PartnerFeature.ORDERS,admin(false,"orders:read")))
 }
 @Test fun priceAdminsAndUnavailableAccountsNeverFallBackToPersonalOrders(){
  for(user in listOf(null,admin(true,"price:read"),admin(false,"price:write"),admin(true,"orders:read").put("active",false),admin(false,"orders:read").put("needsPasswordSetup",true),admin(true,"orders:read").put("needsProfileSetup",true)))assertEquals(OrdersDestination.NONE,ordersDestination(user))
  assertFalse(canOpenFeature(PartnerFeature.ORDERS,admin(false,"price:read")))
  assertFalse(canOpenFeature(PartnerFeature.ORDERS,admin(false,"orders:read").put("needsProfileSetup",true)))
  assertFalse(canOpenFeature(PartnerFeature.ASSISTANT,admin(false,"orders:read").put("needsProfileSetup",true)))
 }
 @Test fun clientAndEmployeeOrdersRemainPersonalAfterAnAdminAccountSwitch(){
  for(role in listOf("manager","employee")){val user=JSONObject().put("role","client").put("clientRole",role).put("permissions",JSONArray().put("orders:read")).put("mobileAdminEnabled",true)
   assertEquals(OrdersDestination.PERSONAL,ordersDestination(user));assertEquals("Իմ պատվերները",ordersLabel(user));assertFalse(canOpenFeature(PartnerFeature.ORDERS,user))
  }
  assertEquals("Պատվերների կառավարում",ordersLabel(admin(false,"orders:read")))
 }
 @Test fun statusHandoffsAcceptOnlyKnownMachineStates(){for(status in listOf("new","confirmed","in_progress","completed","rejected","received"))assertTrue(validOrderStatus(status));for(status in listOf("","all","new&other=1","<script>","NEW"))assertFalse(validOrderStatus(status))}
}
