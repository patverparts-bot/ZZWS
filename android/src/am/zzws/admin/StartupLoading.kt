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
 LoadingSceneTheme{
 Surface(color=MaterialTheme.colorScheme.background,modifier=Modifier.fillMaxSize().testTag("session-restoring-screen")){
  Column(Modifier.fillMaxSize().padding(12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){
   LoadingSceneLogo(Modifier.width(198.dp).height(46.dp))
   Spacer(Modifier.height(24.dp))
   Box(Modifier.widthIn(max=800.dp)){CatalogueLoadingScene()}
   Spacer(Modifier.height(20.dp))
   LocalizedText(CATALOG_LOADING_TITLE,fontSize=20.sp,fontWeight=androidx.compose.ui.text.font.FontWeight.Bold,textAlign=androidx.compose.ui.text.style.TextAlign.Center,color=MaterialTheme.colorScheme.onSurface)
  }
 }
 }
}
