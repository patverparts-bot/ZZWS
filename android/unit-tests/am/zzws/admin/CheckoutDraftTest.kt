package am.zzws.admin
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*

class CheckoutDraftTest {
 private val rows=listOf(JSONObject().put("id","delivery-a").put("address","Default address A").put("contact","Default contact A"),JSONObject().put("id","delivery-b").put("address","Default address B").put("contact","Default contact B"))
 @Test fun websiteDraftRestoresTheExactVariantAndAllUserFields(){
  val expected=CheckoutDraft("delivery-b","Ինքնաառաքում","Edited address · հայերեն","Edited contact","2027-02-03","First line\nSecond line")
  val restored=restoreCheckoutDraft(JSONObject(expected.json().toString()),rows)
  assertEquals(1,restored.index);assertEquals(expected,restored.value)
  assertEquals(setOf("organizationSelect","deliveryMethodInput","deliveryAddressInput","contactPersonInput","deliveryDateInput","orderCommentInput"),expected.json().keys().asSequence().toSet())
 }
 @Test fun missingDraftUsesTheFirstDeliveryDefaultsWithoutInventingDateOrComment(){val r=restoreCheckoutDraft(null,rows);assertEquals(0,r.index);assertEquals("Default address A",r.value.address);assertEquals("Default contact A",r.value.contact);assertEquals("Առաքում",r.value.method);assertEquals("",r.value.date);assertEquals("",r.value.comment)}
 @Test fun savedEmptyFieldsRemainEmptyInsteadOfReturningProfileValues(){val r=restoreCheckoutDraft(CheckoutDraft("delivery-b","Առաքում","","","","").json(),rows);assertEquals(1,r.index);assertEquals("",r.value.address);assertEquals("",r.value.contact);assertEquals("",r.value.date);assertEquals("",r.value.comment)}
 @Test fun removedDeliveryVariantRequiresReselectionAndKeepsTypedInformation(){val value=CheckoutDraft("deleted-variant","Առաքում","Keep address","Keep contact","2027-02-03","Keep comment");val r=restoreCheckoutDraft(value.json(),rows);assertEquals(-1,r.index);assertEquals("",r.value.deliveryId);assertEquals(value.copy(deliveryId=""),r.value);assertTrue(runCatching{validateCheckout(true,r.index>=0,r.value.method,r.value.address,r.value.contact,r.value.date)}.isFailure)}
 @Test fun emptyDeliveryChoiceIsPreservedAndInvalidMethodCannotBypassDeliveryValidation(){val r=restoreCheckoutDraft(JSONObject().put("organizationSelect","").put("deliveryMethodInput","malformed"),rows);assertEquals(-1,r.index);assertEquals("Առաքում",r.value.method)}
 @Test fun comparisonsIgnoreJsonKeyOrderButDistinguishMissingAndClearedFields(){val a=CheckoutDraft("delivery-a","Առաքում","Address","Contact","","").json();val b=JSONObject();a.keys().asSequence().toList().reversed().forEach{b.put(it,a.get(it))};assertTrue(sameCheckoutDraft(a,b));b.remove("orderCommentInput");assertFalse(sameCheckoutDraft(a,b));assertTrue(sameCheckoutDraft(null,null));assertFalse(sameCheckoutDraft(null,JSONObject()))}
 @Test fun serverCompatibleBoundsDoNotDiscardOtherDraftFields(){val r=restoreCheckoutDraft(CheckoutDraft("delivery-a","Առաքում","A".repeat(4000),"contact","date","comment").json(),rows);assertEquals(3000,r.value.address.length);assertEquals("contact",r.value.contact);assertEquals("comment",r.value.comment)}
}
