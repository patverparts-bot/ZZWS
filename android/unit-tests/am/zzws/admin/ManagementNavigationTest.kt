package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*

class ManagementNavigationTest {
 @Test fun managementBackReturnsToProfileAndOrderBackReturnsToItsList(){assertEquals("profile",mainBackDestination("management"));assertEquals("orders",mainBackDestination("order"));assertEquals("home",mainBackDestination("catalog"))}
 @Test fun managerNestedScreensReturnToOrderBeforeReturningToHub(){for(screen in listOf("history","status"))assertEquals("detail",managerBackDestination(screen));for(screen in listOf("filters","statistics","settings","detail"))assertEquals("orders",managerBackDestination(screen));assertEquals("parent",managerBackDestination("orders"));assertEquals("parent",managerBackDestination("login"))}
}
