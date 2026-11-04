package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
class CheckoutPolicyTest{
 @Test fun selectedCalendarMonthUsesAndroidZeroBasedMonth(){assertEquals("2026-10-29",checkoutDate(2026,9,29));assertEquals("2027-01-01",checkoutDate(2027,0,1));assertEquals("2028-02-29",checkoutDate(2028,1,29))}
 @Test fun missingDateHasExplicitArmenianMessage(){val e=runCatching{validateCheckout(true,true,"Առաքում","Test address","Test contact","")}.exceptionOrNull();assertNotNull(e);assertEquals("Ընտրեք ամսաթիվը օրացույցից",e!!.message)}
 @Test fun validDeliveryAndPickupAreAccepted(){validateCheckout(true,true,"Առաքում","Test address","Test contact",checkoutDate(2026,9,30));validateCheckout(true,true,"Ինքնաառաքում","","Test contact",checkoutDate(2026,9,30))}
 @Test fun invalidDateAndMissingRequiredFieldsRejectBeforeSending(){for(date in listOf("30.10.2026","2026-02-30","not-a-date")){assertTrue(runCatching{validateCheckout(true,true,"Առաքում","Address","Contact",date)}.isFailure)};assertTrue(runCatching{validateCheckout(false,true,"Առաքում","Address","Contact","2026-10-30")}.isFailure);assertTrue(runCatching{validateCheckout(true,false,"Առաքում","Address","Contact","2026-10-30")}.isFailure);assertTrue(runCatching{validateCheckout(true,true,"Առաքում","","Contact","2026-10-30")}.isFailure);assertTrue(runCatching{validateCheckout(true,true,"Ինքնաառաքում","","","2026-10-30")}.isFailure)}
}
