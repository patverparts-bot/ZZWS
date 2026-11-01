package am.zzws.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

internal data class CatalogFilters(
 val brands:Set<String> = emptySet(),
 val categories:Set<String> = emptySet(),
 val onlyAvailable:Boolean = false,
 val onlyPromo:Boolean = false,
 val sort:Int = 0,
 val onlyWholesale:Boolean = false
){
 val activeCount get()=brands.size+categories.size+(if(onlyAvailable)1 else 0)+(if(onlyPromo)1 else 0)+(if(sort!=0)1 else 0)+(if(onlyWholesale)1 else 0)
}

private val filterSaver=listSaver<CatalogFilters,Any>(
 save={listOf(ArrayList(it.brands),ArrayList(it.categories),it.onlyAvailable,it.onlyPromo,it.sort,it.onlyWholesale)},
 restore={CatalogFilters((it[0] as List<*>).filterIsInstance<String>().toSet(),(it[1] as List<*>).filterIsInstance<String>().toSet(),it[2] as Boolean,it[3] as Boolean,it[4] as Int,it.getOrNull(5)==true)}
)
internal fun filterChoiceLabel(value:String)=value.ifBlank{"Նշված չէ"}
internal fun searchableFilterChoices(options:List<String>,selected:Set<String>,query:String,selectedOnly:Boolean):List<String>{
 val term=query.trim()
 return (options+selected).distinct().sortedWith(String.CASE_INSENSITIVE_ORDER).filter{
  (!selectedOnly||it in selected)&&(term.isEmpty()||(filterChoiceLabel(it).contains(term,ignoreCase=true)||L10n.t(filterChoiceLabel(it),"ru").contains(term,ignoreCase=true)))
 }
}
internal fun catalogFilterCount(products:List<Product>,query:String,filters:CatalogFilters,isPromotion:(Product)->Boolean={it.promo},allowWholesale:Boolean=false)=
 visibleProducts(wholesalePricedProducts(products,filters.onlyWholesale,allowWholesale),query,filters.brands,filters.categories,filters.onlyAvailable,filters.onlyPromo,0,{it.price},isPromotion).size

/** One compact overview; searchable multi-select lists open separately. Changes
 * remain a draft until Apply, so Back/Close never silently changes the catalogue. */
@Composable internal fun CatalogFiltersDialog(
 products:List<Product>,query:String,initial:CatalogFilters,
 onApply:(CatalogFilters)->Unit,onDismiss:()->Unit,enabled:(String)->Boolean={true},isPromotion:(Product)->Boolean={it.promo},allowWholesale:Boolean=false
){
 var draft by rememberSaveable(allowWholesale,stateSaver=filterSaver){mutableStateOf(initial.copy(onlyWholesale=allowWholesale&&initial.onlyWholesale))}
 var section by rememberSaveable{mutableStateOf("overview")}
 var search by rememberSaveable{mutableStateOf("")}
 var selectedOnly by rememberSaveable{mutableStateOf(false)}
 val focus=LocalFocusManager.current
 val overview=section=="overview"
 val choosingBrand=section=="brand"
 val selected=if(choosingBrand)draft.brands else draft.categories
 val count=remember(products,query,draft,isPromotion,allowWholesale){catalogFilterCount(products,query,draft,isPromotion,allowWholesale)}
 fun back(){focus.clearFocus();if(overview)onDismiss()else{section="overview";search="";selectedOnly=false}}
 fun choose(key:String){focus.clearFocus();section=key;search="";selectedOnly=false}
 fun changeSelection(value:String,checked:Boolean){
  val next=if(checked)selected+value else selected-value
  draft=if(choosingBrand)draft.copy(brands=next)else draft.copy(categories=next)
 }
 Dialog(onDismissRequest={back()},properties=DialogProperties(usePlatformDefaultWidth=false,decorFitsSystemWindows=false)){
  Box(Modifier.fillMaxSize().safeDrawingPadding().imePadding(),contentAlignment=Alignment.Center){
   Surface(modifier=Modifier.widthIn(max=560.dp).fillMaxWidth().heightIn(max=800.dp).fillMaxHeight(),shape=MaterialTheme.shapes.large,color=MaterialTheme.colorScheme.surface){
    Column(Modifier.fillMaxSize()){
     Row(Modifier.fillMaxWidth().padding(start=4.dp,end=12.dp,top=4.dp,bottom=4.dp),verticalAlignment=Alignment.CenterVertically){
      IconButton(onClick={back()}){AppIcon(if(overview)"close"else"back")}
      LocalizedText(if(overview)"Զտիչներ"else if(choosingBrand)"Բրենդ"else"Կատեգորիա",style=MaterialTheme.typography.titleLarge,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f))
      TextButton(onClick={draft=if(overview)CatalogFilters()else if(choosingBrand)draft.copy(brands=emptySet())else draft.copy(categories=emptySet())},enabled=if(overview)draft.activeCount>0 else selected.isNotEmpty()){
       LocalizedText("Մաքրել")
      }
     }
     HorizontalDivider()
     if(overview){
      LazyColumn(modifier=Modifier.weight(1f),contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
       item{LocalizedText("Ընտրեք անհրաժեշտ պայմանները և կիրառեք։",style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)}
       item{OutlinedCard(Modifier.fillMaxWidth()){
        if(enabled("category"))FilterSectionRow("Կատեգորիա",draft.categories){choose("category")}
        HorizontalDivider(Modifier.padding(horizontal=16.dp))
        if(enabled("brand"))FilterSectionRow("Բրենդ",draft.brands){choose("brand")}
       }}
       item{OutlinedCard(Modifier.fillMaxWidth()){
        if(enabled("stock"))FilterSwitch("Միայն առկա պահեստում",draft.onlyAvailable){draft=draft.copy(onlyAvailable=it)}
        HorizontalDivider(Modifier.padding(horizontal=16.dp))
        if(enabled("promo"))FilterSwitch("Միայն ակցիաներ",draft.onlyPromo){draft=draft.copy(onlyPromo=it)}
        if(allowWholesale){HorizontalDivider(Modifier.padding(horizontal=16.dp));FilterSwitch("Միայն մեծածախ գին ունեցող ապրանքները",draft.onlyWholesale){draft=draft.copy(onlyWholesale=it)}}
       }}
       item{Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
        LocalizedText("Դասավորել",style=MaterialTheme.typography.titleSmall,fontWeight=FontWeight.SemiBold)
        if(enabled("sorting"))FilterSort(draft.sort){draft=draft.copy(sort=it)}
       }}
      }
     }else{
      val options=remember(products,draft.brands,draft.categories,choosingBrand){
       if(choosingBrand)brandChoices(products,draft.categories,draft.brands)else categoryChoices(products,draft.brands,draft.categories)
      }
      val choices=remember(options,selected,search,selectedOnly){searchableFilterChoices(options,selected,search,selectedOnly)}
      OutlinedTextField(value=search,onValueChange={search=it},placeholder={LocalizedText(if(choosingBrand)"Որոնել բրենդը"else"Որոնել կատեգորիան")},
       leadingIcon={AppIcon("search")},trailingIcon={if(search.isNotEmpty())IconButton(onClick={search=""}){AppIcon("close")}},singleLine=true,
       keyboardOptions=KeyboardOptions(imeAction=ImeAction.Search),keyboardActions=KeyboardActions(onSearch={focus.clearFocus()}),modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=12.dp))
      Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){
       FilterChip(selected=!selectedOnly,onClick={selectedOnly=false},label={LocalizedText("Բոլորը")})
       FilterChip(selected=selectedOnly,onClick={selectedOnly=true},label={LocalizedText("Ընտրված՝ ${selected.size}")})
      }
      LocalizedText("Գտնված՝ ${choices.size}",Modifier.padding(horizontal=16.dp,vertical=4.dp),style=MaterialTheme.typography.labelMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
      LazyColumn(modifier=Modifier.weight(1f),contentPadding=PaddingValues(bottom=8.dp)){
       if(choices.isEmpty())item{LocalizedText(if(selectedOnly&&selected.isEmpty())"Դեռ ոչինչ ընտրված չէ։"else"Համապատասխան տարբերակներ չկան։ Փոխեք որոնումը։",Modifier.padding(24.dp),color=MaterialTheme.colorScheme.onSurfaceVariant)}
       items(choices,key={it}){value->
        Row(Modifier.fillMaxWidth().toggleable(value=value in selected,role=Role.Checkbox,onValueChange={changeSelection(value,it)}).heightIn(min=56.dp).padding(horizontal=16.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically){
         Checkbox(checked=value in selected,onCheckedChange=null)
         if(choosingBrand)BrandLogo(value,Modifier.padding(start=12.dp).size(24.dp))
         LocalizedText(filterChoiceLabel(value),Modifier.weight(1f).padding(start=12.dp),style=MaterialTheme.typography.bodyLarge)
        }
        HorizontalDivider(Modifier.padding(start=56.dp,end=16.dp),color=MaterialTheme.colorScheme.surfaceVariant)
       }
      }
     }
     HorizontalDivider()
     Column(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
      if(!overview)LocalizedText("Արդյունք՝ $count ապրանք",style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.onSurfaceVariant)
      Button(onClick={focus.clearFocus();if(overview)onApply(draft.copy(onlyWholesale=allowWholesale&&draft.onlyWholesale))else back()},modifier=Modifier.fillMaxWidth().heightIn(min=52.dp)){
       LocalizedText(if(overview)"Ցույց տալ՝ $count ապրանք"else"Պատրաստ է",style=MaterialTheme.typography.titleSmall)
      }
     }
    }
   }
  }
 }
}

@Composable private fun FilterSectionRow(title:String,selected:Set<String>,onClick:()->Unit){
 Row(Modifier.fillMaxWidth().clickable(onClick=onClick).heightIn(min=76.dp).padding(16.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
  Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)){
   LocalizedText(title,style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold)
   val summary=if(selected.isEmpty())"Բոլորը"else selected.take(2).joinToString(" · ",transform=::filterChoiceLabel)+(if(selected.size>2)" · +${selected.size-2}"else"")
   LocalizedText(summary,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=2,overflow=TextOverflow.Ellipsis)
  }
  if(selected.isNotEmpty())Badge{LocalizedText(selected.size.toString())}
  AppIcon("chevron")
 }
}
@Composable private fun FilterSwitch(title:String,checked:Boolean,onChange:(Boolean)->Unit){
 Row(Modifier.fillMaxWidth().toggleable(value=checked,role=Role.Switch,onValueChange=onChange).heightIn(min=64.dp).padding(horizontal=16.dp,vertical=8.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
  LocalizedText(title,Modifier.weight(1f),style=MaterialTheme.typography.bodyLarge)
  Switch(checked=checked,onCheckedChange=null)
 }
}
@Composable private fun FilterSort(value:Int,onChange:(Int)->Unit){
 val labels=listOf("Արտիկուլ՝ աճման","Գին՝ աճման","Գին՝ նվազման")
 var expanded by remember{mutableStateOf(false)}
 Box{
  OutlinedButton(onClick={expanded=true},modifier=Modifier.fillMaxWidth().heightIn(min=52.dp),contentPadding=PaddingValues(horizontal=16.dp,vertical=12.dp)){
   LocalizedText(labels.getOrElse(value){labels[0]},Modifier.weight(1f),style=MaterialTheme.typography.bodyLarge)
   AppIcon("chevron")
  }
  DropdownMenu(expanded=expanded,onDismissRequest={expanded=false}){
   labels.forEachIndexed{index,label->DropdownMenuItem(text={LocalizedText(label)},onClick={onChange(index);expanded=false},leadingIcon={RadioButton(selected=value==index,onClick=null)})}
  }
 }
}
