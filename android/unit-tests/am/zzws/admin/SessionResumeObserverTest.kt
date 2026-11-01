package am.zzws.admin

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionResumeObserverTest {
 private val owner=object:LifecycleOwner{override val lifecycle:Lifecycle get()=error("Unused by observer")}
 @Test fun initialLifecycleReplayDoesNotReloadTheNewlyRestoredAccount(){
  var calls=0;val observer=SessionResumeObserver{calls++}
  for(event in listOf(Lifecycle.Event.ON_CREATE,Lifecycle.Event.ON_START,Lifecycle.Event.ON_RESUME))observer.onStateChanged(owner,event)
  assertEquals(0,calls)
 }
 @Test fun everyRealReturnFromBackgroundStillRefreshesExactlyOnce(){
  var calls=0;val observer=SessionResumeObserver{calls++}
  observer.onStateChanged(owner,Lifecycle.Event.ON_RESUME)
  repeat(2){
   for(event in listOf(Lifecycle.Event.ON_PAUSE,Lifecycle.Event.ON_STOP,Lifecycle.Event.ON_START,Lifecycle.Event.ON_RESUME,Lifecycle.Event.ON_RESUME))observer.onStateChanged(owner,event)
   assertEquals(it+1,calls)
  }
 }
}
