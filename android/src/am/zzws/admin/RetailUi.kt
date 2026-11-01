package am.zzws.admin
import android.content.Context
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
internal val BrandBlue=Color(0xFF2563EB)
internal val BrandAccent=Color(0xFF1D4ED8)
internal val ShopInk=Color(0xFF0F172A)
internal val ShopMuted=Color(0xFF7A8088)
@Composable internal fun RetailTheme(content:@Composable ()->Unit){MaterialTheme(colorScheme=lightColorScheme(primary=BrandAccent,onPrimary=Color.White,primaryContainer=Color(0xFFEFF6FF),onPrimaryContainer=BrandAccent,secondary=BrandBlue,onSecondary=Color.White,secondaryContainer=Color(0xFFEFF6FF),background=Color(0xFFF6F6F6),surface=Color.White,onSurface=ShopInk,surfaceVariant=Color(0xFFF2F3F4),onSurfaceVariant=ShopMuted,outline=Color(0xFFDADDE0)),shapes=Shapes(small=RoundedCornerShape(8.dp),medium=RoundedCornerShape(14.dp),large=RoundedCornerShape(20.dp),extraLarge=RoundedCornerShape(26.dp)),content=content)}
internal object PartnerLibrary {
 val favorites=mutableStateListOf<String>();val comparison=mutableStateListOf<String>();private var user=""
 fun load(id:String){if(user==id)return;user=id;comparison.clear();favorites.clear();favorites.addAll(AppContext.value.getSharedPreferences("design-library",Context.MODE_PRIVATE).getStringSet("favorites:$id",emptySet()).orEmpty())}
 fun accept(values:Set<String>){favorites.clear();favorites.addAll(values);AppContext.value.getSharedPreferences("design-library",Context.MODE_PRIVATE).edit().putStringSet("favorites:$user",values).apply()}
 fun clear(){user="";favorites.clear();comparison.clear()}
 fun favorite(code:String){if(code in favorites)favorites.remove(code)else favorites.add(code);AppContext.value.getSharedPreferences("design-library",Context.MODE_PRIVATE).edit().putStringSet("favorites:$user",favorites.toSet()).apply()}
 fun compare(code:String){if(code in comparison)comparison.remove(code)else if(comparison.size<3)comparison.add(code)}
}
@Composable internal fun RetailHeader(model:UnifiedModel){Surface(color=Color.White,shadowElevation=1.dp){Column(Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top+WindowInsetsSides.Horizontal))){
 Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal=8.dp).testTag("retail-main-header"),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
  IconButton(onClick={model.screen="profile"}){AppIcon("location")}
  Row(verticalAlignment=Alignment.CenterVertically){PartnerLogo(Modifier.width(116.dp).height(28.dp))}
  Row{IconButton(onClick={model.refresh()},enabled=!model.busy&&canReloadCatalog(model.screen,model.pendingSubmission)){AppIcon("refresh")};BadgedBox(badge={if(model.demo)Badge(containerColor=BrandBlue){Text("DEMO",fontSize=8.sp)}}){IconButton(onClick={model.notifications()}){AppIcon("notifications")}}}
 }
}}}
// NavigationBar owns the bottom/horizontal system insets; its height must remain unconstrained.
@Composable internal fun RetailNavigation(model:UnifiedModel){Surface(color=Color.White,shadowElevation=8.dp){NavigationBar(containerColor=Color.White,tonalElevation=0.dp,windowInsets=NavigationBarDefaults.windowInsets){
 listOf(Triple("home","home","Գլխավոր"),Triple("catalog","catalog","Կատալոգ"),Triple("favorites","heart","Ընտրյալներ"),Triple("profile","person","Պրոֆիլ"),Triple("cart","cart","Զամբյուղ")).forEach{(key,icon,label)->NavigationBarItem(selected=model.screen==key||(model.screen=="management"&&key=="profile"),onClick={if(key=="catalog")model.showDepartments()else model.screen=key},icon={val count=if(key=="cart")model.cart.values.sum()else if(key=="favorites")PartnerLibrary.favorites.size else 0
 BadgedBox(badge={if(count>0)Badge(containerColor=BrandAccent){Text(if(count>99)"99+"else"$count",fontSize=9.sp)}}){AppIcon(icon)}
 },label={OneLineLabel(label,9)},colors=NavigationBarItemDefaults.colors(selectedIconColor=BrandAccent,selectedTextColor=BrandAccent,unselectedIconColor=Color(0xFF64748B),unselectedTextColor=ShopMuted,indicatorColor=Color(0xFFDBEAFE)))}
}}}
@Composable private fun SectionTitle(title:String,action:String="",onAction:()->Unit={}){Row(Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=12.dp),verticalAlignment=Alignment.CenterVertically){LocalizedText(title,fontSize=21.sp,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));if(action.isNotEmpty())TextButton(onClick=onAction){LocalizedText(action,fontSize=11.sp,color=BrandAccent)}}}
@Composable internal fun RetailHome(model:UnifiedModel,onFilters:()->Unit,onProduct:(Product)->Unit,onCompare:()->Unit,onSearch:()->Unit){
 val featured=model.specialOffers.take(6);val hasOffers=featured.isNotEmpty()
 val brands=if(model.control("brand"))model.products.map{it.brand}.filter{it.isNotBlank()}.distinct().take(12)else emptyList();val departments=if(model.control("category"))model.departments.take(8)else emptyList()
 LazyColumn(Modifier.fillMaxSize().testTag("retail-home-feed"),contentPadding=PaddingValues(bottom=16.dp)){
 item{CatalogSearchEntry(model,onFilters,onSearch)}
 item{LazyRow(contentPadding=PaddingValues(horizontal=14.dp,vertical=7.dp),horizontalArrangement=Arrangement.spacedBy(14.dp)){items(brands){brand->Column(horizontalAlignment=Alignment.CenterHorizontally,modifier=Modifier.width(69.dp).clickable{model.showBrand(brand)}){
 Box(Modifier.size(65.dp).border(1.5.dp,BrandBlue,CircleShape).padding(5.dp).background(Color.White,CircleShape),contentAlignment=Alignment.Center){BrandLogo(brand,Modifier.fillMaxSize().padding(5.dp),nameFallback=true)}
 Text(brand,Modifier.padding(top=6.dp),fontSize=9.sp,color=ShopMuted,maxLines=1)}}}}
 if(hasOffers)item{Surface(onClick={model.showPromotions()},shape=RoundedCornerShape(16.dp),modifier=Modifier.padding(14.dp).fillMaxWidth().testTag("home-collection-banner")){
 Box(Modifier.background(Brush.horizontalGradient(listOf(Color(0xFF2563EB),Color(0xFF0F172A))))){
 Box(Modifier.matchParentSize().background(Color.White.copy(alpha=.03f)))
 Row(Modifier.fillMaxWidth().heightIn(min=170.dp).padding(18.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)){
 Text("ZZWS COLLECTION",fontSize=10.sp,letterSpacing=2.sp,color=Color.White.copy(alpha=.85f),fontWeight=FontWeight.SemiBold)
 LocalizedText(model.publishedOffer?.text("title").orEmpty().ifBlank{"Հատուկ առաջարկներ"},fontSize=22.sp,lineHeight=26.sp,fontWeight=FontWeight.Bold,color=Color.White,maxLines=3)
 Surface(color=Color.White,shape=RoundedCornerShape(6.dp),modifier=Modifier.testTag("home-collection-action")){LocalizedText("Տեսնել առաջարկները  →",Modifier.padding(horizontal=10.dp,vertical=7.dp),fontSize=12.sp,lineHeight=16.sp,fontWeight=FontWeight.Bold,color=Color(0xFF1D4ED8))}}
 val hero=featured.firstOrNull()
 if(hero!=null)Box(Modifier.size(96.dp).background(Color.White,RoundedCornerShape(18.dp)).testTag("home-collection-photo"),contentAlignment=Alignment.Center){ProductPhoto(hero.code,edge=88,interactive=false)}
 }}}}
 item{Row(Modifier.fillMaxWidth().padding(horizontal=14.dp),horizontalArrangement=Arrangement.spacedBy(9.dp)){
 if(hasOffers)QuickTile("Առաջարկներ","offer",Modifier.weight(1f).testTag("home-offers-shortcut")){model.showPromotions()}
 QuickTile("Պատվերներ","orders",Modifier.weight(1f)){model.history()}
 QuickTile("Համեմատել","compare",Modifier.weight(1f),onCompare)}}
 item{SectionTitle("Բաժիններ","Բոլորը"){model.showDepartments()}}
 item{LazyRow(contentPadding=PaddingValues(horizontal=14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){items(departments){row->Column(Modifier.width(126.dp).clickable{model.showDepartment(row.department.id)},horizontalAlignment=Alignment.CenterHorizontally){
 Surface(shape=RoundedCornerShape(12.dp),color=Color.White,border=BorderStroke(1.dp,BrandBlue),modifier=Modifier.fillMaxWidth().height(72.dp)){Box(contentAlignment=Alignment.Center){CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon(row.department.icon)}}}
 LocalizedText(row.department.title,Modifier.padding(top=7.dp),fontSize=11.sp,maxLines=2,overflow=TextOverflow.Ellipsis);Text("${row.count}",fontSize=10.sp,color=ShopMuted)}}}}
 if(hasOffers){
 item{Box(Modifier.testTag("home-offers-heading")){SectionTitle("Հատուկ առաջարկներ","Բոլորը"){model.showPromotions()}}}
 items(featured.chunked(2)){pair->Row(Modifier.padding(horizontal=14.dp,vertical=5.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){pair.forEach{p->Box(Modifier.weight(1f)){RetailProductCard(p,model,onProduct)}};if(pair.size==1)Spacer(Modifier.weight(1f))}}
 }
 }}
@Composable private fun QuickTile(title:String,icon:String,modifier:Modifier,onClick:()->Unit){Surface(onClick=onClick,color=BrandBlue,shape=RoundedCornerShape(10.dp),modifier=modifier.height(92.dp)){Column(Modifier.padding(12.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center){CompositionLocalProvider(LocalContentColor provides Color.White){AppIcon(icon)};Spacer(Modifier.height(9.dp));LocalizedText(title,fontSize=11.sp,color=Color.White,maxLines=1,overflow=TextOverflow.Ellipsis)}}}
private fun categoryIcon(category:String):String{val x=category.lowercase();return when{x.contains("հեռուստ")||x.contains("телев")->"tv";x.contains("սմարթ")||x.contains("телефон")->"phone";x.contains("համակարգ")||x.contains("компьют")->"laptop";x.contains("խոհան")||x.contains("кухон")->"kitchen";x.contains("աուդ")||x.contains("ауди")->"audio";else->"appliance"}}
@Composable internal fun RetailCatalog(model:UnifiedModel,onProduct:(Product)->Unit,onBuyer:()->Unit,favorites:Boolean=false){
 val sections=!favorites&&model.catalogSections&&model.control("category")
 val rows=if(favorites)model.products.filter{it.code in PartnerLibrary.favorites}else model.filtered
 val currentDepartment=catalogDepartments.find{it.id==model.department}
 val title=if(favorites)"Ընտրյալներ"else if(sections)"Բաժիններ"else if(model.offerCollection)"Հատուկ առաջարկներ"else currentDepartment?.title?:"Բոլոր ապրանքները"
 val grid=rememberLazyGridState()
 LaunchedEffect(model.query,model.department,sections,favorites,model.brands.toList(),model.categories.toList(),model.onlyPromo,model.onlyAvailable,model.sort,model.offerCollection){grid.scrollToItem(0)}
 LazyVerticalGrid(columns=GridCells.Adaptive(if(sections)148.dp else 158.dp),state=grid,modifier=Modifier.fillMaxSize().testTag("catalog-products-grid"),contentPadding=PaddingValues(start=14.dp,end=14.dp,top=8.dp,bottom=14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  // Context is part of the scrolling grid, never a pinned toolbar above products.
  item(key="catalog-context",span={GridItemSpan(maxLineSpan)}){
   Column(Modifier.fillMaxWidth().testTag("catalog-scroll-header"),verticalArrangement=Arrangement.spacedBy(4.dp)){
    Row(verticalAlignment=Alignment.CenterVertically){
     LocalizedText(title,fontWeight=FontWeight.Bold,fontSize=20.sp,maxLines=2,modifier=Modifier.weight(1f))
     if(!favorites&&!sections&&(model.offerCollection||model.brands.isNotEmpty()||model.categories.isNotEmpty()||model.onlyPromo||model.onlyAvailable||model.query.isNotBlank()))TextButton(onClick={model.showAllProducts()}){LocalizedText("Բոլոր ապրանքները",fontSize=10.sp)}
    }
    LocalizedText(if(sections)"${model.products.size} ապրանք"else if(favorites)"${rows.size} ապրանք"else"Ցուցադրված՝ ${rows.size} / ${model.products.size}",fontSize=11.sp,color=ShopMuted)
    if(!sections&&model.offerCollection&&model.publishedOffer?.text("title").orEmpty().let{it.isNotBlank()&&it!="Հատուկ առաջարկներ"})LocalizedText(model.publishedOffer?.text("title").orEmpty(),fontSize=13.sp,color=BrandAccent)
    if(!sections&&model.query.isNotBlank())Text(model.query,fontSize=12.sp,color=BrandAccent,maxLines=1,overflow=TextOverflow.Ellipsis)
    model.catalogBuyer?.let{customer->Surface(onClick=onBuyer,enabled=!model.busy&&!model.pendingSubmission,color=Color(0xFFEFF6FF),shape=RoundedCornerShape(8.dp),modifier=Modifier.fillMaxWidth()){
     LocalizedText("Պատվիրատու՝ "+customer.text("client"),Modifier.padding(8.dp),fontSize=12.sp,color=BrandAccent,maxLines=1,overflow=TextOverflow.Ellipsis)
    }}
   }
  }
  if(sections){
   item(key="all-products",span={GridItemSpan(maxLineSpan)}){DepartmentTile("Բոլոր ապրանքները",model.products.size,"list"){model.showAllProducts()}}
   items(model.departments,key={"department:"+it.department.id}){row->DepartmentTile(row.department.title,row.count,row.department.icon){model.showDepartment(row.department.id)}}
  }else if(rows.isEmpty())item(key="empty-products",span={GridItemSpan(maxLineSpan)}){
   Column(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=50.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(14.dp)){
    CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon(if(favorites)"heart"else"search")}
    LocalizedText(if(favorites)"Սիրելի ապրանքները կհայտնվեն այստեղ"else"Համապատասխան ապրանքներ չկան։ Փոխեք որոնումը կամ զտիչները։",fontSize=15.sp,color=ShopMuted)
   }
  }else items(rows,key={"product:"+it.code}){product->RetailProductCard(product,model,onProduct)}
 }
}
@Composable private fun DepartmentTile(title:String,count:Int,icon:String,onClick:()->Unit){
 Surface(onClick=onClick,color=Color.White,shape=RoundedCornerShape(14.dp),border=BorderStroke(1.dp,Color(0xFFE2E8F0)),modifier=Modifier.fillMaxWidth()){
 Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
 CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon(icon)}
 LocalizedText(title,fontSize=14.sp,fontWeight=FontWeight.SemiBold,maxLines=3,minLines=2,overflow=TextOverflow.Ellipsis)
 LocalizedText("$count ապրանք",fontSize=12.sp,color=ShopMuted)
 }
 }
}
@Composable private fun RetailProductCard(p:Product,model:UnifiedModel,onProduct:(Product)->Unit){
 val favorite=p.code in PartnerLibrary.favorites;val compare=p.code in PartnerLibrary.comparison;val quantity=model.cart[p.code]?:0;val price=model.unit(p);val promotion=model.promotion(p)
 ElevatedCard(onClick={onProduct(p)},shape=RoundedCornerShape(11.dp),colors=CardDefaults.elevatedCardColors(containerColor=Color.White),elevation=CardDefaults.elevatedCardElevation(1.dp),modifier=Modifier.fillMaxWidth().testTag("retail-product:${p.code}")){
 Column(Modifier.padding(11.dp)){
 Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){BrandLabel(p.brand,Modifier.weight(1f));if(promotion!=null)Surface(color=BrandAccent,shape=RoundedCornerShape(4.dp)){LocalizedText(promotion.label,Modifier.padding(horizontal=5.dp,vertical=3.dp),fontSize=8.sp,color=Color.White,fontWeight=FontWeight.Bold)}}
 Box(Modifier.fillMaxWidth().height(136.dp),contentAlignment=Alignment.Center){ProductPhoto(p.code,edge=124,onTechnical={onProduct(p)})}
 LocalizedText(p.name,fontSize=12.sp,lineHeight=16.sp,maxLines=2,minLines=2,overflow=TextOverflow.Ellipsis,color=Color(0xFF626870))
 LocalizedText(p.code,Modifier.padding(top=4.dp),fontSize=9.sp,color=ShopMuted,maxLines=1)
 model.badges(p.code).forEach{LocalizedText(it,fontSize=9.sp,color=BrandBlue)}
 if(p.retail>price&&price>0)Text(money(p.retail),fontSize=10.sp,color=Color(0xFF9DA2A8),textDecoration=TextDecoration.LineThrough)
 Text(money(price),fontWeight=FontWeight.Bold,fontSize=18.sp,color=if(promotion!=null)BrandAccent else ShopInk,maxLines=1)
 Row(Modifier.fillMaxWidth().padding(top=3.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
 IconButton(onClick={model.toggleFavorite(p.code)},modifier=Modifier.size(43.dp)){CompositionLocalProvider(LocalContentColor provides if(favorite)BrandAccent else ShopInk){AppIcon(if(favorite)"heart-filled"else"heart")}}
 IconButton(onClick={PartnerLibrary.compare(p.code)},enabled=compare||PartnerLibrary.comparison.size<3,modifier=Modifier.size(43.dp)){CompositionLocalProvider(LocalContentColor provides if(compare)BrandBlue else ShopInk){AppIcon("compare")}}
 FilledIconButton(onClick={model.setQty(p.code,quantity+1)},enabled=!model.busy&&!model.pendingSubmission&&price>0,shape=RoundedCornerShape(8.dp),colors=IconButtonDefaults.filledIconButtonColors(containerColor=if(quantity>0)BrandBlue else Color(0xFFF3F4F5),contentColor=if(quantity>0)Color.White else ShopInk),modifier=Modifier.size(43.dp)){if(quantity>0)Text("$quantity",fontWeight=FontWeight.Bold,fontSize=14.sp)else AppIcon("cart")}
 }}}}
@Composable internal fun RetailProfile(model:UnifiedModel,onLogout:()->Unit,onBuyer:()->Unit){
 val context=androidx.compose.ui.platform.LocalContext.current
 LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
 item{LocalizedText("Պրոֆիլ",fontSize=27.sp,fontWeight=FontWeight.Bold)}
 item{Surface(color=Color.White,shape=RoundedCornerShape(14.dp)){Row(Modifier.fillMaxWidth().padding(20.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(56.dp).background(Color(0xFFEFF6FF),CircleShape),contentAlignment=Alignment.Center){CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon("person")}};Column(Modifier.weight(1f).padding(start=14.dp)){LocalizedText(model.user?.text("client").orEmpty(),fontSize=18.sp,fontWeight=FontWeight.Bold);Text(model.user?.text("login").orEmpty(),fontSize=12.sp,color=ShopMuted)}}}}
 item{ProfileRow("Իմ պատվերները","orders"){model.history()}}
  if(model.user?.text("clientRole")=="manager")item{ProfileRow("Իմ աշխատակիցները","person"){model.openFeature(PartnerFeature.TEAM,context)}}
 item{ProfileRow("Ընտրյալներ","heart"){model.screen="favorites"}}
 item{ProfileRow("Ծանուցումների կարգավորումներ","notifications"){model.notifications()}}
 if(canSelectCustomer(model.user))item{ProfileRow("Ընտրել հաճախորդին","person",onBuyer)}
 if(canOpenFeature(PartnerFeature.ADMIN,model.user))item{ProfileRow("Կառավարում","catalog"){model.screen="management"}}
 item{Surface(color=Color.White,shape=RoundedCornerShape(12.dp)){Column(Modifier.padding(12.dp)){LocalizedText("Լեզու",fontWeight=FontWeight.Bold,fontSize=14.sp);LanguagePicker()}}}
 item{Surface(color=Color.White,shape=RoundedCornerShape(12.dp)){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){LocalizedText("Առաքման տվյալներ",fontWeight=FontWeight.Bold,fontSize=15.sp);model.deliveryRows.forEach{LocalizedText(it.text("organization"),fontSize=13.sp);LocalizedText(it.text("address")+" · "+it.text("contact"),fontSize=12.sp,color=ShopMuted)}}}}
 item{PartnerToolLinks(model)}
 item{TextButton(onClick=onLogout,modifier=Modifier.fillMaxWidth()){LocalizedText("Դուրս գալ",color=BrandAccent)}}
 item{LocalizedText("ZZWS · "+EndpointConfiguration.VERSION+"\nAndroid 8+",Modifier.fillMaxWidth(),fontSize=11.sp,color=ShopMuted,textAlign=androidx.compose.ui.text.style.TextAlign.Center)}
 }}
@Composable private fun ProfileRow(title:String,icon:String,onClick:()->Unit){Surface(onClick=onClick,color=Color.White,shape=RoundedCornerShape(12.dp)){Row(Modifier.fillMaxWidth().padding(17.dp),verticalAlignment=Alignment.CenterVertically){CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon(icon)};LocalizedText(title,Modifier.weight(1f).padding(start=16.dp),fontSize=15.sp);CompositionLocalProvider(LocalContentColor provides ShopMuted){AppIcon("chevron")}}}}
@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun RetailProductDetails(p:Product,model:UnifiedModel,onDismiss:()->Unit){ModalBottomSheet(onDismissRequest=onDismiss,containerColor=Color.White){Column(Modifier.fillMaxWidth().testTag("retail-product-details:${p.code}").verticalScroll(rememberScrollState()).padding(horizontal=20.dp).padding(bottom=24.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){
 model.promotion(p)?.let{LocalizedText(it.label,fontSize=12.sp,fontWeight=FontWeight.SemiBold,color=BrandAccent)}
 Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){BrandLabel(p.brand,Modifier.weight(1f));IconButton(onClick={model.toggleFavorite(p.code)}){AppIcon(if(p.code in PartnerLibrary.favorites)"heart-filled"else"heart")};IconButton(onClick=onDismiss){AppIcon("close")}}
 Box(Modifier.fillMaxWidth().height(232.dp),contentAlignment=Alignment.Center){ProductPhoto(p.code,true,220)}
 LocalizedText(p.name,fontSize=22.sp,fontWeight=FontWeight.Bold,lineHeight=28.sp)
 Row{LocalizedText(p.code,Modifier.weight(1f),fontSize=12.sp,color=ShopMuted);LocalizedText(p.stock,fontSize=12.sp,color=BrandBlue)}
 if(p.retail>model.unit(p)&&model.unit(p)>0)Text(money(p.retail),textDecoration=TextDecoration.LineThrough,color=ShopMuted,fontSize=15.sp)
 Text(money(model.unit(p)),fontSize=29.sp,fontWeight=FontWeight.Bold,color=BrandAccent)
 Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){
 if((model.cart[p.code]?:0)>0)QuantityControl(model.cart[p.code]?:0,!model.busy&&!model.pendingSubmission){model.setQty(p.code,it)}
 else Button(onClick={model.setQty(p.code,1)},enabled=!model.busy&&!model.pendingSubmission&&model.unit(p)>0,modifier=Modifier.weight(1f),shape=RoundedCornerShape(10.dp)){AppIcon("cart");Spacer(Modifier.width(10.dp));LocalizedText("Ավելացնել զամբյուղ")}
 OutlinedButton(onClick={PartnerLibrary.compare(p.code)},enabled=p.code in PartnerLibrary.comparison||PartnerLibrary.comparison.size<3,shape=RoundedCornerShape(10.dp)){AppIcon("compare")}}
 ProductTechnicalDetails(p)
}}}
@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun RetailComparison(model:UnifiedModel,onDismiss:()->Unit){
 val products=PartnerLibrary.comparison.mapNotNull{code->model.products.find{it.code==code}}
 ModalBottomSheet(onDismissRequest=onDismiss,containerColor=Color.White){Column(Modifier.fillMaxWidth().heightIn(max=620.dp).verticalScroll(rememberScrollState()).padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
 LocalizedText("Համեմատել ապրանքները",fontWeight=FontWeight.Bold,fontSize=23.sp)
 LocalizedText("Ընտրեք մինչև 3 ապրանք՝ քարտի համեմատման նշանով։",fontSize=12.sp,color=ShopMuted)
 if(products.isEmpty())LocalizedText("Համեմատման ցանկը դատարկ է",Modifier.padding(vertical=30.dp),color=ShopMuted)
 else{Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){products.forEach{p->Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(8.dp)){
 IconButton(onClick={PartnerLibrary.compare(p.code)}){AppIcon("close")};Box(Modifier.fillMaxWidth().height(100.dp),contentAlignment=Alignment.Center){ProductPhoto(p.code,edge=82)}
 LocalizedText(p.name,fontSize=11.sp,maxLines=3,minLines=3,overflow=TextOverflow.Ellipsis);Text(money(model.unit(p)),fontSize=14.sp,color=BrandAccent,fontWeight=FontWeight.Bold)
 BrandLabel(p.brand);LocalizedText(p.category,fontSize=11.sp);LocalizedText(p.stock,fontSize=11.sp,color=BrandBlue)
 }}}
 HorizontalDivider();LocalizedText("Տեխնիկական բնութագրեր",fontWeight=FontWeight.Bold)
 products.forEach{p->LocalizedText(p.name,fontWeight=FontWeight.SemiBold,fontSize=13.sp);ProductTechnicalDetails(p)}}
 TextButton(onClick={PartnerLibrary.comparison.clear()}){LocalizedText("Մաքրել ցանկը")};TextButton(onClick=onDismiss){LocalizedText("Փակել")};Spacer(Modifier.height(16.dp))
}}}

@Composable internal fun RetailCartItem(p:Product?,code:String,quantity:Int,model:UnifiedModel){
 Surface(color=Color.White,shape=RoundedCornerShape(12.dp),modifier=Modifier.fillMaxWidth()){
 Column(Modifier.padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
 Row(horizontalArrangement=Arrangement.spacedBy(12.dp),verticalAlignment=Alignment.CenterVertically){
 Checkbox(checked=model.isSelected(code),onCheckedChange={model.selectLine(code,it)},enabled=!model.busy&&!model.pendingSubmission)
 if(p!=null)Box(Modifier.size(78.dp),contentAlignment=Alignment.Center){ProductPhoto(code,edge=72)}
 Column(Modifier.weight(1f)){LocalizedText(p?.name?:code,fontSize=14.sp,fontWeight=FontWeight.SemiBold,maxLines=3,overflow=TextOverflow.Ellipsis);LocalizedText(code,fontSize=10.sp,color=ShopMuted);if(p==null)LocalizedText("Ապրանքը չկա ընթացիկ կատալոգում։",color=MaterialTheme.colorScheme.error,fontSize=11.sp)}
 }
 Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween){
 QuantityControl(quantity,!model.busy&&!model.pendingSubmission){model.setQty(code,it)}
 Column(horizontalAlignment=Alignment.End){Text(money((p?.let{model.unit(it)}?:0.0)*quantity),fontSize=20.sp,fontWeight=FontWeight.Bold,color=BrandAccent);Text(money(p?.let{model.unit(it)}?:0.0)+" / "+L10n.t("հատ"),fontSize=10.sp,color=ShopMuted)}
 }
 }}
}
@Composable internal fun RetailEmptyCart(onCatalog:()->Unit){
 Column(Modifier.fillMaxWidth().padding(vertical=48.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(18.dp)){
 Box(Modifier.size(84.dp).background(Color(0xFFEFF6FF),CircleShape),contentAlignment=Alignment.Center){CompositionLocalProvider(LocalContentColor provides BrandBlue){AppIcon("cart")}}
 LocalizedText("Զամբյուղը դատարկ է",fontSize=24.sp,fontWeight=FontWeight.Bold)
 Button(onClick=onCatalog,shape=RoundedCornerShape(10.dp)){LocalizedText("Անցնել կատալոգ")}
 }
}
