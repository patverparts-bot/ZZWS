package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
class ApprovalReminderTest {
 @Test fun firstReminderIsImmediateAndRepeatsEveryMinute(){assertTrue(approvalReminderDue(0,null,true,true));assertFalse(approvalReminderDue(59999,0,true,true));assertTrue(approvalReminderDue(60000,0,true,true));assertTrue(approvalReminderDue(60001,0,true,true))}
 @Test fun noReminderDuringReviewOrWithoutPendingOrders(){assertFalse(approvalReminderDue(60000,0,false,true));assertFalse(approvalReminderDue(60000,0,true,false))}
 @Test fun clientCanRequestAnyWholeMinuteUpToOneHour(){for(n in 1..60)assertEquals(n,approvalDelayMinutes(n.toString()));for(s in listOf("","0","61","-1","1.5","text"))assertNull(approvalDelayMinutes(s))}
}
