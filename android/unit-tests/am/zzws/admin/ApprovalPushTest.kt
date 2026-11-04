package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
class ApprovalPushTest {
 @Test fun requestsAndRepliesHaveSpecificNotifications(){for(action in listOf("requested","approved","declined"))assertNotNull(ApprovalPush.notice(action,null));assertTrue(ApprovalPush.notice("approved",null)!![1].contains("ձևակերպել"));assertNull(ApprovalPush.notice("unknown",null))}
 @Test fun adminGetsTheExactRequestedMinutesAndNoInvalidDelay(){assertTrue(ApprovalPush.notice("deferred","60")!![1].contains("60"));for(value in listOf(null,"0","61","-1","1.5","<script>"))assertNull(ApprovalPush.notice("deferred",value))}
}
