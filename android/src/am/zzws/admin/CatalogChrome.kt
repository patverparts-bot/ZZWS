package am.zzws.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal fun usesCatalogChrome(screen:String)=screen=="catalog"||screen=="favorites"
internal data class CatalogDockState(val searchEnabled:Boolean=true,val ordersEnabled:Boolean=true,val searchActive:Boolean=false,val cartQuantity:Int=0,val screen:String="home")

/** One bottom row owns its system insets; no floating control covers product cards. */
@Composable internal fun CatalogBottomBar(
 state:CatalogDockState,onHome:()->Unit,onCatalog:()->Unit,onOrders:()->Unit,onSearch:()->Unit,
 onCart:()->Unit,onMenu:()->Unit
){
 Surface(color=MaterialTheme.colorScheme.surface,shadowElevation=6.dp){
  Row(Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom+WindowInsetsSides.Horizontal)).fillMaxWidth().height(56.dp).testTag("catalog-bottom-bar"),verticalAlignment=Alignment.CenterVertically){
   CatalogDockButton("home","Գլխավոր",Modifier.weight(1f).testTag("navigation-home"),active=state.screen=="home",onClick=onHome)
   CatalogDockButton("catalog","Կատալոգ",Modifier.weight(1f).testTag("navigation-catalog"),active=state.screen=="catalog",onClick=onCatalog)
   CatalogDockButton("orders","Պատվերներ",Modifier.weight(1f).testTag("navigation-orders"),enabled=state.ordersEnabled,active=state.screen in listOf("orders","order"),onClick=onOrders)
   CatalogDockButton("search","Որոնել",Modifier.weight(1f).testTag("catalog-search-button"),enabled=state.searchEnabled,active=state.searchActive,onClick=onSearch)
   CatalogDockButton("cart","Զամբյուղ",Modifier.weight(1f).testTag("navigation-cart"),count=state.cartQuantity,active=state.screen=="cart",onClick=onCart)
   CatalogDockButton("person","Մենյու",Modifier.weight(1f).testTag("navigation-menu"),onClick=onMenu)
  }
 }
}
@Composable private fun CatalogDockButton(icon:String,label:String,modifier:Modifier,enabled:Boolean=true,active:Boolean=false,count:Int=0,onClick:()->Unit){
 val tint=if(!enabled)ShopMuted.copy(alpha=.45f)else if(active||count>0)BrandAccent else ShopInk
 Column(modifier.fillMaxHeight().clickable(enabled=enabled,role=Role.Button,onClick=onClick).padding(top=5.dp,bottom=3.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(3.dp,Alignment.CenterVertically)){
  BadgedBox(badge={if(count>0)Badge{Text(if(count>99)"99+"else"$count",fontSize=8.sp)}}){
   Box(Modifier.clearAndSetSemantics{}){CompositionLocalProvider(LocalContentColor provides tint){AppIcon(icon)}}
  }
  LocalizedText(label,fontSize=9.sp,color=tint,maxLines=1,overflow=TextOverflow.Ellipsis)
 }
}

/** The home-page search keeps its visual place, but editing happens only on demand. */
@Composable internal fun CatalogSearchEntry(model:UnifiedModel,onFilters:()->Unit,onSearch:()->Unit){
 Row(Modifier.fillMaxWidth().padding(horizontal=14.dp,vertical=8.dp),horizontalArrangement=Arrangement.spacedBy(9.dp),verticalAlignment=Alignment.CenterVertically){
  FilledIconButton(onClick=onFilters,shape=RoundedCornerShape(7.dp),modifier=Modifier.size(49.dp)){AppIcon("filter")}
  if(model.control("search"))Surface(onClick=onSearch,shape=RoundedCornerShape(8.dp),border=BorderStroke(1.dp,MaterialTheme.colorScheme.outline),color=MaterialTheme.colorScheme.surface,modifier=Modifier.weight(1f).heightIn(min=49.dp)){
   Row(Modifier.padding(horizontal=13.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)){
    LocalizedText(model.query.ifBlank{"Ապրանք, արտիկուլ կամ բրենդ"},fontSize=12.sp,color=ShopMuted,maxLines=1,overflow=TextOverflow.Ellipsis,modifier=Modifier.weight(1f))
    AppIcon("search")
   }
  }
 }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun CatalogSearchSheet(initialQuery:String,onSearch:(String)->Unit,onDismiss:()->Unit){
 var draft by rememberSaveable{mutableStateOf(initialQuery)}
 val focus=remember{FocusRequester()}
 val keyboard=LocalSoftwareKeyboardController.current
 fun close(){keyboard?.hide();onDismiss()}
 fun search(){keyboard?.hide();onSearch(draft.trim())}
 ModalBottomSheet(onDismissRequest={close()},sheetState=rememberModalBottomSheetState(skipPartiallyExpanded=true),containerColor=MaterialTheme.colorScheme.surface){
  Column(Modifier.fillMaxWidth().imePadding().padding(horizontal=16.dp).padding(bottom=20.dp).testTag("catalog-search-sheet"),verticalArrangement=Arrangement.spacedBy(12.dp)){
   Row(verticalAlignment=Alignment.CenterVertically){LocalizedText("Որոնել",fontWeight=FontWeight.Bold,fontSize=22.sp,modifier=Modifier.weight(1f));TextButton(onClick={close()},modifier=Modifier.testTag("catalog-search-close")){LocalizedText("Փակել")}}
   OutlinedTextField(value=draft,onValueChange={draft=it},singleLine=true,placeholder={LocalizedText("Ապրանք, արտիկուլ կամ բրենդ")},leadingIcon={AppIcon("search")},trailingIcon={if(draft.isNotEmpty())IconButton(onClick={draft=""}){AppIcon("close")}},keyboardOptions=KeyboardOptions(imeAction=ImeAction.Search),keyboardActions=KeyboardActions(onSearch={search()}),modifier=Modifier.fillMaxWidth().focusRequester(focus).testTag("catalog-search-input"))
   Button(onClick={search()},modifier=Modifier.fillMaxWidth().heightIn(min=48.dp).testTag("catalog-search-submit")){LocalizedText("Որոնել")}
   LaunchedEffect(Unit){focus.requestFocus();keyboard?.show()}
  }
 }
}
