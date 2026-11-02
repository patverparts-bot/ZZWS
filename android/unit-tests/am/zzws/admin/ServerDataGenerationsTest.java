package am.zzws.admin;
import org.junit.Test;
import static org.junit.Assert.*;

public class ServerDataGenerationsTest {
 @Test public void orderAndWorkspaceRevisionsAreIndependentAndFirstObservationIsNotAReset(){ServerDataGenerations state=new ServerDataGenerations();assertTrue(state.observe("1","1"));assertEquals(0,state.ordersRevision());assertEquals(0,state.workspaceRevision());assertTrue(state.observe("2","1"));assertEquals(1,state.ordersRevision());assertEquals(0,state.workspaceRevision());assertTrue(state.observe("2","2"));assertEquals(1,state.ordersRevision());assertEquals(1,state.workspaceRevision());assertTrue(state.observe("2","2"));assertEquals(1,state.workspaceRevision());}
 @Test public void oldOrMalformedFramesNeverRollBackOrPartiallyAdvanceEitherDomain(){ServerDataGenerations state=new ServerDataGenerations();state.observe("5","8");assertFalse(state.observe("4","9"));assertFalse(state.observe("6","7"));assertEquals("8",state.workspaceGeneration());for(String bad:new String[]{"0","-1","01","NaN","9223372036854775808","1\n2"})assertFalse(state.observe(bad,"8"));assertTrue(state.observe("9223372036854775807","8"));assertEquals(1,state.ordersRevision());}
 @Test public void sessionResetAndOlderApiWithoutHeadersDoNotInventAWorkspaceDeletion(){ServerDataGenerations state=new ServerDataGenerations();assertTrue(state.observe(null,null));state.observe("7","9");state.clear();assertEquals("",state.workspaceGeneration());assertTrue(state.observe("1","1"));assertEquals(0,state.ordersRevision());assertEquals(0,state.workspaceRevision());}
 @Test public void clearedMarkersRejectOldJournalsButPreservePostResetWorkAndOrderOnlyPendingRequests(){assertTrue(ServerDataGenerations.pendingOrderMatchesWorkspace("","1",0));assertFalse(ServerDataGenerations.pendingOrderMatchesWorkspace("","2",4));assertFalse(ServerDataGenerations.pendingOrderMatchesWorkspace("1","2",4));assertTrue(ServerDataGenerations.pendingOrderMatchesWorkspace("2","2",4));assertTrue(ServerDataGenerations.pendingOrderMatchesWorkspace("2","",4));assertTrue(ServerDataGenerations.journalWasCleared(3,4));assertFalse(ServerDataGenerations.journalWasCleared(4,4));assertFalse(ServerDataGenerations.journalWasCleared(5,4));}
 @Test public void checkoutDraftEpochRejectsPreResetWorkEvenWhenAnOlderArchiveRestoresLowerVersions(){
  assertFalse(ServerDataGenerations.checkoutDraftMatchesWorkspace("1","3",100,6));
  assertTrue(ServerDataGenerations.checkoutDraftMatchesWorkspace("3","3",100,6));
  assertFalse(ServerDataGenerations.checkoutDraftMatchesWorkspace("3","3",5,6));
  assertTrue(ServerDataGenerations.checkoutDraftMatchesWorkspace("3","",100,6));
  assertTrue(ServerDataGenerations.checkoutDraftMatchesWorkspace("","3",100,6));
  assertFalse(ServerDataGenerations.checkoutDraftMatchesWorkspace("","3",5,6));
  assertTrue(ServerDataGenerations.checkoutDraftMatchesWorkspace("1","1",4,0));
 }
}
