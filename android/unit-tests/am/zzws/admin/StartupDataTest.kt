package am.zzws.admin

import kotlinx.coroutines.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class StartupDataTest {
 @Test fun allReadsStartBeforeAnyCompletesAndNoPartialResultEscapes()=runBlocking {
  withTimeout(3000){
   val started=mutableSetOf<String>();val allStarted=CompletableDeferred<Unit>()
   val responses=listOf("catalog","me/state","me/mobile/preferences").associateWith{CompletableDeferred<JSONObject>()}
   val result=async{readStartupData("catalog"){path->started.add(path);if(started.size==3)allStarted.complete(Unit);responses.getValue(path).await()}}
   allStarted.await();assertEquals(responses.keys,started)
   responses.getValue("catalog").complete(JSONObject().put("version","fresh"));yield();assertFalse(result.isCompleted)
   responses.getValue("me/state").complete(JSONObject().put("cart",3));yield();assertFalse(result.isCompleted)
   responses.getValue("me/mobile/preferences").complete(JSONObject().put("enabled",true))
   val data=result.await();assertEquals("fresh",data.catalog.getString("version"));assertEquals(3,data.state.getInt("cart"));assertTrue(data.preferences.getBoolean("enabled"))
  }
 }
 @Test fun readFailureCancelsTheOtherReadsAndPreservesTheOriginalError()=runBlocking {
  withTimeout(3000){
   val started=CompletableDeferred<Unit>();val release=CompletableDeferred<Unit>();val stopped=mutableSetOf<String>();var count=0
   val failure=ApiClient.ApiError(401,"Expired")
   try{
    readStartupData("catalog"){path->
     if(++count==3)started.complete(Unit)
     if(path=="me/mobile/preferences"){started.await();release.complete(Unit);throw failure}
     try{release.await();awaitCancellation()}finally{stopped.add(path)}
    };fail("Expected authentication failure")
   }catch(error:ApiClient.ApiError){assertSame(failure,error)}
   assertEquals(setOf("catalog","me/state"),stopped)
  }
 }
 @Test fun cancellingStartupCancelsEveryRead()=runBlocking {
  withTimeout(3000){
   val started=CompletableDeferred<Unit>();val stopped=mutableSetOf<String>();var count=0
   val job=launch{readStartupData("catalog"){path->try{if(++count==3)started.complete(Unit);awaitCancellation()}finally{stopped.add(path)}}}
   started.await();job.cancelAndJoin();assertEquals(setOf("catalog","me/state","me/mobile/preferences"),stopped)
  }
 }
}
