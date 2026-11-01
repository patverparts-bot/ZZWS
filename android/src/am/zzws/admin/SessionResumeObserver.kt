package am.zzws.admin

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner

/** Subscribing to an already resumed activity must not repeat the completed login. */
internal class SessionResumeObserver(private val onReturn:()->Unit):LifecycleEventObserver {
 private var paused=false
 override fun onStateChanged(source:LifecycleOwner,event:Lifecycle.Event){
  when(event){
   Lifecycle.Event.ON_PAUSE->paused=true
   Lifecycle.Event.ON_RESUME->if(paused){paused=false;onReturn()}
   else->Unit
  }
 }
}
