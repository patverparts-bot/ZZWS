package am.zzws.admin

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** A restored session is checked before exposing the sign-in form or account UI. */
@Composable internal fun SessionRestoringScreen(){
 Surface(color=MaterialTheme.colorScheme.background,modifier=Modifier.fillMaxSize().testTag("session-restoring-screen")){
  Column(Modifier.fillMaxSize().padding(32.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
   PartnerLogo(Modifier.width(210.dp).height(58.dp))
   Spacer(Modifier.height(30.dp))
   CircularProgressIndicator(Modifier.size(30.dp).testTag("session-restoring-progress"),strokeWidth=3.dp)
   Spacer(Modifier.height(18.dp))
   LocalizedText("Վերականգնվում է աշխատաշրջանը…",fontSize=14.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
  }
 }
}
