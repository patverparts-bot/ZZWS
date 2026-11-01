package am.zzws.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest

/** Shares the complete account-filtered collection opened by the banner's action. */
@Composable internal fun OfferProductCarousel(products:List<Product>){
 if(products.isEmpty())return
 key(products.map{it.code}){
  val pager=rememberPagerState(pageCount={products.size})
  val dragged by pager.interactionSource.collectIsDraggedAsState()
  val lifecycle=LocalLifecycleOwner.current.lifecycle
  LaunchedEffect(pager,lifecycle){
   if(products.size>1)lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED){
    snapshotFlow{pager.settledPage to dragged}.collectLatest{(_,isDragged)->
     if(!isDragged){
      delay(4000)
      if(!pager.isScrollInProgress){
       val next=(pager.settledPage+1)%products.size
       if(next==0)pager.scrollToPage(0)else pager.animateScrollToPage(next)
      }
     }
    }
   }
  }
  Column(horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(4.dp)){
   Box(Modifier.size(96.dp).background(Color.White,RoundedCornerShape(18.dp)).testTag("home-collection-photo")){
    HorizontalPager(state=pager,userScrollEnabled=products.size>1,modifier=Modifier.fillMaxSize().testTag("home-collection-pager")){page->
     val product=products[page]
     Box(Modifier.fillMaxSize().testTag("home-collection-item:"+product.code).semantics{contentDescription=product.name},contentAlignment=Alignment.Center){ProductPhoto(product.code,edge=88,interactive=false)}
    }
   }
   if(products.size>1)Text("${pager.currentPage+1} / ${products.size}",color=Color.White,fontSize=10.sp,modifier=Modifier.testTag("home-collection-position"))
  }
 }
}
