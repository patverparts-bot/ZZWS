package am.zzws.admin
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Test
import org.junit.Assert.*
class CustomerSelectionTest{
 @Test fun initialEmptySearchShowsTheWholeLoadedList(){val rows=listOf(JSONObject().put("client","Հայ գործընկեր").put("login","private-login-one").put("customerCode","BUYER-001"),JSONObject().put("client","Երկրորդ գործընկեր").put("login","private-login-two").put("customerCode","BUYER-002"));assertEquals(2,customerChoices(rows,"").size);assertEquals(2,customerChoices(rows,"  ").size);assertEquals("BUYER-002",customerChoices(rows,"buyer-002").single().text("customerCode"));assertEquals("BUYER-001",customerChoices(rows,"Հայ").single().text("customerCode"));assertTrue(customerChoices(rows,"absent").isEmpty());assertTrue(customerChoices(rows,"private-login-two").isEmpty())}
 @Test fun customerAndReadonlyStaffCannotSelectAnotherBuyer(){val user=JSONObject().put("role","client").put("mobileAdminEnabled",true).put("permissions",JSONArray().put("orders:write"));assertFalse(canSelectCustomer(user));user.put("role","admin");assertTrue(canSelectCustomer(user));user.put("permissions",JSONArray().put("orders:read"));assertFalse(canSelectCustomer(user));user.put("permissions",JSONArray().put("orders:write")).put("mobileAdminEnabled",false);assertFalse(canSelectCustomer(user))}
}
