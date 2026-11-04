package am.zzws.admin

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.Alignment
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.repeatOnLifecycle
import org.json.JSONObject

internal object AppContext {lateinit var value:Context}
class UnifiedActivity:ComponentActivity(){
 internal var destination by mutableStateOf<Pair<String,String>?>(null)
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);AppContext.value=applicationContext;AppLanguage.initialize(applicationContext);AppSession.initialize(applicationContext);setContent{RetailTheme{UnifiedApp()}}}
 override fun onNewIntent(intent:Intent){super.onNewIntent(intent);setIntent(intent);readDestination()}
 override fun onStart(){super.onStart();readDestination()}
 override fun onResume(){super.onResume();AppLanguage.current.value=L10n.language();VersionReminder.resume(this)}
 override fun onPause(){VersionReminder.pause(this);super.onPause()}
 override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){super.onActivityResult(requestCode,resultCode,data);UserUpdateInstaller.activityResult(this,requestCode,resultCode)}
 private fun readDestination(){if(intent.getBooleanExtra("zzws_home",false)){destination=Pair("home","");intent.removeExtra("zzws_home");return};val kind=intent.getStringExtra("zzws_kind");if(kind in listOf("order.created","order.status","order.changed","order.comment","catalog.prices","catalog.offers","system")){destination=Pair(kind!!,intent.getStringExtra("zzws_order")?:"");intent.removeExtra("zzws_kind");intent.removeExtra("zzws_order")}}
}
@OptIn(ExperimentalMaterial3Api::class)
@Composable internal fun UnifiedApp(model:UnifiedModel=viewModel()){
 val context=androidx.compose.ui.platform.LocalContext.current
 val language=AppLanguage.current.value
 val activity=context as? UnifiedActivity
 val lifecycle=androidx.lifecycle.compose.LocalLifecycleOwner.current
 DisposableEffect(lifecycle,model){val observer=SessionResumeObserver{if(model.user!=null)model.resume()};lifecycle.lifecycle.addObserver(observer);onDispose{lifecycle.lifecycle.removeObserver(observer)}}
 if(model.restoringSession){SessionRestoringScreen();return}
 val messages=remember{SnackbarHostState()}
 LaunchedEffect(model.user?.text("id")){if(model.user!=null&&activity!=null)VersionReminder.check(activity)}
 LaunchedEffect(model.notice,model.user){if(model.user!=null&&model.notice.isNotBlank()&&model.screen!="catalog")messages.showSnackbar(L10n.t(model.notice),duration=SnackbarDuration.Short)}
 LaunchedEffect(model.user?.text("id"),model.subscriptions?.optBoolean("enabled")){if(model.user!=null&&!model.demo&&model.subscriptions?.optBoolean("enabled")==true)PushHooks.attach(context,AppSession.api)else PushHooks.detach(context,AppSession.api)}
 LaunchedEffect(model.user,model.busy,activity?.destination){if(model.user!=null&&!model.busy){activity?.destination?.let{(kind,id)->activity.destination=null;if(kind=="home")model.screen="home"else model.notification(kind,id)}}}
 var compareDialog by remember{mutableStateOf(false)}
 LaunchedEffect(model.user?.text("id")){PartnerLibrary.load(model.user?.text("id").orEmpty())}
 LaunchedEffect(Unit){if(BuildConfig.DEBUG&&activity?.intent?.getBooleanExtra("trial_demo",false)==true){while(model.busy)kotlinx.coroutines.delay(50);model.enterDemo()}}
 var appMenu by remember{mutableStateOf(false)};var confirmLogout by remember{mutableStateOf(false)};var filters by rememberSaveable(model.user?.text("id")){mutableStateOf(false)};var product by remember(model.user?.text("id")){mutableStateOf<Product?>(null)}
 var catalogSearch by rememberSaveable(model.user?.text("id")){mutableStateOf(false)}
 var buyerDialog by remember{mutableStateOf(false)};var confirmSend by remember{mutableStateOf(false)};var confirmReloadCart by remember{mutableStateOf(false)}
 LaunchedEffect(model.user){if(!canSelectCustomer(model.user))buyerDialog=false}
 LaunchedEffect(lifecycle,model.user?.text("id")){
  if(model.user!=null)lifecycle.lifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.RESUMED){
   while(true){kotlinx.coroutines.delay(CATALOG_CHECK_INTERVAL_MS);model.pollCatalog()}
  }
 }
 LaunchedEffect(lifecycle,model.user?.text("id")){
  if(model.user?.text("role")=="client")lifecycle.lifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.RESUMED){
   while(true){model.pollApprovalReminder(!appMenu&&!confirmLogout&&!filters&&!catalogSearch&&product==null&&!buyerDialog&&!confirmSend&&!confirmReloadCart&&!compareDialog&&model.successOrder==null);kotlinx.coroutines.delay(15000)}
  }
 }
 BackHandler(model.user!=null&&model.screen!="home"){if(model.screen=="order"&&model.user?.text("role")=="admin"){model.screen="home";model.openOrders(context)}else if(model.screen=="catalog"&&!model.catalogSections&&model.control("category"))model.showDepartments()else model.screen=mainBackDestination(model.screen)}
 val catalogue=model.user!=null&&usesCatalogChrome(model.screen)
 Scaffold(topBar={if(model.user!=null&&!catalogue)RetailHeader(model)},bottomBar={if(model.user!=null){
  CatalogBottomBar(CatalogDockState(searchEnabled=model.control("search"),ordersEnabled=ordersDestination(model.user)!=OrdersDestination.NONE&&!model.busy,searchActive=catalogSearch,cartQuantity=model.cart.values.sum(),screen=model.screen),onHome={model.screen="home"},onCatalog={model.showDepartments()},onOrders={model.openOrders(context)},onSearch={catalogSearch=true},onCart={model.screen="cart"},onMenu={appMenu=true})
 }},snackbarHost={SnackbarHost(messages)}){padding->Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)){
 Column(Modifier.fillMaxSize()){

  if(model.user==null){Login(model);return@Column}
  if(model.user?.optBoolean("needsProfileSetup")==true){AccountDetails(model);return@Column}
  if(!catalogue)model.catalogBuyer?.let{customer->Surface(onClick={buyerDialog=true},enabled=!model.busy&&!model.pendingSubmission,color=Color(0xFFEFF6FF),modifier=Modifier.fillMaxWidth()){
   Row(Modifier.padding(horizontal=16.dp,vertical=6.dp),verticalAlignment=Alignment.CenterVertically){LocalizedText("Պատվիրատու՝ "+customer.text("client"),fontSize=12.sp,color=BrandAccent,modifier=Modifier.weight(1f),maxLines=1,overflow=androidx.compose.ui.text.style.TextOverflow.Ellipsis);LocalizedText("Փոխել",fontSize=12.sp,color=BrandAccent)}
  }}
  when(model.screen){
   "notifications"->Column(Modifier.padding(16.dp).verticalScroll(rememberScrollState())){
    OneLineLabel("Ծանուցումների կարգավորումներ",22,androidx.compose.ui.text.font.FontWeight.Bold)
    LocalizedText(if(model.demo)"Դեմո ռեժիմում ծանուցումներ չեն ուղարկվում։"else"Ծանուցումները կապված են այս հաշվի և այս սարքի հետ։",Modifier.padding(vertical=12.dp),fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
    notificationOptions(model.user).forEach{(key,label)->Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){LocalizedText(label,Modifier.weight(1f).padding(top=12.dp));Switch(checked=model.subscriptions?.optBoolean(key)==true,onCheckedChange={model.subscribe(key,it,context)},enabled=!model.busy)}}
   }
   "home"->RetailHome(model,{filters=true},{product=it},{compareDialog=true},{catalogSearch=true})
   "catalog"->RetailCatalog(model,{product=it},{buyerDialog=true},onFilters={filters=true})
   "favorites"->RetailCatalog(model,{product=it},{buyerDialog=true},favorites=true,onFilters={filters=true})
   "profile"->RetailProfile(model,{confirmLogout=true},{buyerDialog=true})
   "management"->PartnerManagement(model){model.showAllProducts();buyerDialog=true}
   "cart"->PartnerCheckout(model,{buyerDialog=true})
   "orders"->LazyColumn(contentPadding=PaddingValues(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
    item{LocalizedText("Իմ պատվերները",style=MaterialTheme.typography.headlineSmall);OrderDataExportButton(model);LocalizedText("Բոլոր պատվերները՝ բոլոր կարգավիճակներով",style=MaterialTheme.typography.bodySmall);PartnerOrderSearch(model);if(model.hasOrderExportFilter())OrderDataExportButton(model,filtered=true)}
    items(model.orders,key={it.text("id")}){o->
     Card(Modifier.fillMaxWidth().clickable{model.openOrder(o.text("id"))}){
      Column(Modifier.padding(16.dp)){
       LocalizedText("№"+o.optLong("number"),style=MaterialTheme.typography.titleLarge)
       LocalizedText(approvalStatusLabel(o).ifBlank{statusLabel(o.text("status"))});OrderTotal(o);LocalizedText(yerevanTime(o.text("created")))
       Spacer(Modifier.height(12.dp))
       ReceiptPanel(model.user,o,model.busy,compact=true){model.prepareReceipt(o.text("id"),o.optInt("revision"))}
      }
     }
    }
    if(model.orders.isNotEmpty())item{TextButton(onClick={model.olderOrders()},enabled=!model.busy){LocalizedText("Բեռնել ավելի հին պատվերները")}}
   }
   "order"->model.order?.let{o->Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
    LocalizedText("Պատվեր №"+o.optLong("number"),style=MaterialTheme.typography.headlineMedium);LocalizedText(statusLabel(o.text("status")))
    OrderOriginCard(o)
    if(o.text("created").isNotBlank())LocalizedText(yerevanTime(o.text("created")),style=MaterialTheme.typography.bodySmall)
    OrderDataExportButton(model,o.text("id"),o.optLong("number"))
    ReceiptPanel(model.user,o,model.busy){model.prepareReceipt(o.text("id"),o.optInt("revision"))}
    OrderApprovalPanel(model,o)
    OrderLines(o)
    OrderTotal(o)
    OrderHistoryPanel(o)
    OutlinedButton(onClick={model.openOrder(o.text("id"))},enabled=!model.busy){LocalizedText("Թարմացնել պատվերը")}
    if(o.text("status")=="new"&&model.user?.text("role")!="admin")LocalizedText("Պատվերը փոխանցված է սերվեր։ Սպասեք պատասխանատուի հաստատմանը։")
    if(o.text("comment").isNotBlank())LocalizedText(o.text("comment"))

   }}
  }
 }
 if(!model.authorizationLoading)ServerOperationProgress(model.busy,Modifier.align(Alignment.TopCenter))
 }}
 if(catalogSearch)CatalogSearchSheet(model.query,onSearch={query->model.showAllProducts();model.searchCatalog(query);catalogSearch=false},onDismiss={catalogSearch=false})
 if(!appMenu&&!confirmLogout&&!filters&&!catalogSearch&&product==null&&!buyerDialog&&!confirmSend&&!confirmReloadCart&&!compareDialog&&model.successOrder==null&&model.errorDialog.isBlank()&&model.receiptConfirmation==null&&model.screen!="cart"&&!(model.screen=="order"&&model.order?.optJSONObject("approval")?.text("state")=="pending"))model.approvalReminder?.let{ApprovalReminderDialog(model,it)}
 if(appMenu)ModalBottomSheet(onDismissRequest={appMenu=false}){
  Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal=20.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
   LocalizedText("ZZWS",style=MaterialTheme.typography.titleLarge)
   LocalizedText(model.user?.text("client").orEmpty(),style=MaterialTheme.typography.bodyMedium)
   fun closeMenu(action:()->Unit){appMenu=false;action()}
   LocalizedText("Կատալոգ և գնումներ",style=MaterialTheme.typography.titleMedium)
   if(ordersDestination(model.user)==OrdersDestination.PERSONAL)TextButton(onClick={closeMenu{model.openOrders(context)}},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText(ordersLabel(model.user))}
   TextButton(onClick={closeMenu{model.showDepartments()}},modifier=Modifier.fillMaxWidth()){LocalizedText("Բաժիններ")}
   TextButton(onClick={closeMenu{if(!usesCatalogChrome(model.screen))model.showAllProducts();filters=true}},modifier=Modifier.fillMaxWidth().testTag("menu-filters")){LocalizedText("Զտիչներ")}
   TextButton(onClick={closeMenu{compareDialog=true}},modifier=Modifier.fillMaxWidth().testTag("menu-compare")){LocalizedText("Համեմատել")}
   TextButton(onClick={closeMenu{model.screen="favorites"}},modifier=Modifier.fillMaxWidth()){LocalizedText("Ընտրյալներ")}
   if(canOpenFeature(PartnerFeature.SAVED_CARTS,model.user))TextButton(onClick={closeMenu{model.openFeature(PartnerFeature.SAVED_CARTS,context)}},enabled=!model.busy&&!model.pendingSubmission,modifier=Modifier.fillMaxWidth()){LocalizedText(PartnerFeature.SAVED_CARTS.title)}
   TextButton(onClick={closeMenu{model.refresh()}},enabled=!model.busy&&canReloadCatalog(model.screen,model.pendingSubmission),modifier=Modifier.fillMaxWidth()){LocalizedText("Թարմացնել կատալոգը")}
   if(model.user?.text("role")=="admin"&&canOpenFeature(PartnerFeature.ADMIN,model.user)){
    HorizontalDivider();LocalizedText("Կառավարում",style=MaterialTheme.typography.titleMedium)
    if(ordersDestination(model.user) in listOf(OrdersDestination.NATIVE,OrdersDestination.WEB))TextButton(onClick={closeMenu{model.openOrders(context)}},enabled=!model.busy,modifier=Modifier.fillMaxWidth().testTag("menu-admin-orders")){LocalizedText(ordersLabel(model.user))}
    for(feature in listOf(PartnerFeature.CLIENTS,PartnerFeature.PRICES,PartnerFeature.DASHBOARD,PartnerFeature.ADMIN).filter{canOpenFeature(it,model.user)})TextButton(onClick={closeMenu{model.openFeature(feature,context)}},enabled=!model.busy&&!model.pendingSubmission,modifier=Modifier.fillMaxWidth()){LocalizedText(feature.title)}
    if(canSelectCustomer(model.user))OutlinedButton(onClick={closeMenu{buyerDialog=true}},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Ընտրել հաճախորդին")}
   }
   HorizontalDivider();LocalizedText("Աշխատանքային գործիքներ",style=MaterialTheme.typography.titleMedium)
   for(feature in listOf(PartnerFeature.SELLER,PartnerFeature.TECHNICAL,PartnerFeature.ASSISTANT).filter{canOpenFeature(it,model.user)})TextButton(onClick={closeMenu{model.openFeature(feature,context)}},enabled=!model.busy&&!model.pendingSubmission,modifier=Modifier.fillMaxWidth()){LocalizedText(feature.title)}
   TextButton(onClick={closeMenu{openWebsite(context,false)}},modifier=Modifier.fillMaxWidth()){LocalizedText("Բացել ZZWS կայքը")}
   HorizontalDivider();LocalizedText("Հաշիվ և կարգավորումներ",style=MaterialTheme.typography.titleMedium)
   TextButton(onClick={closeMenu{model.screen="profile"}},modifier=Modifier.fillMaxWidth()){LocalizedText("Պրոֆիլ")}
   if(canOpenFeature(PartnerFeature.TEAM,model.user))TextButton(onClick={closeMenu{model.openFeature(PartnerFeature.TEAM,context)}},enabled=!model.busy&&!model.pendingSubmission,modifier=Modifier.fillMaxWidth()){LocalizedText(PartnerFeature.TEAM.title)}
   TextButton(onClick={closeMenu{model.notifications()}},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Ծանուցումների կարգավորումներ")}
   LanguagePicker()
   TextButton(onClick={closeMenu{confirmLogout=true}},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Դուրս գալ")}
   Spacer(Modifier.height(16.dp))
  }
 }
 if(confirmLogout)AlertDialog(onDismissRequest={confirmLogout=false},title={LocalizedText("Դուրս գա՞լ ZZWS-ից")},text={LocalizedText("Ձեր զամբյուղը կհամաժամացվի սերվերի հետ։ Այլ հաճախորդի անունից չուղարկված զամբյուղը կմնա միայն այս ընթացիկ աշխատաշրջանում։")},confirmButton={Button(onClick={confirmLogout=false;model.logout()}){LocalizedText("Դուրս գալ")}},dismissButton={TextButton(onClick={confirmLogout=false}){LocalizedText("Մնալ")}})
 model.receiptConfirmation?.let{target->
  var acknowledged by rememberSaveable(target.userId,target.orderId,target.revision){mutableStateOf(false)}
  AlertDialog(onDismissRequest={model.cancelReceipt()},title={Column{LocalizedText("Հաստատել ստացումը · №${target.number}");ServerOperationProgress(model.busy)}},
   text={Column(Modifier.heightIn(max=360.dp).verticalScroll(rememberScrollState()),verticalArrangement=Arrangement.spacedBy(12.dp)){
    if(target.actingForAuthor)LocalizedText(COMPANY_ORDER_ACTION_CAPTION)
    LocalizedText("Վստա՞հ եք, որ այս պատվերի բոլոր ապրանքները ստացել եք ամբողջությամբ և առանց վնասվածքների։")
    Row(Modifier.fillMaxWidth().toggleable(value=acknowledged,enabled=!model.busy,role=androidx.compose.ui.semantics.Role.Checkbox,onValueChange={acknowledged=it}).heightIn(min=48.dp),verticalAlignment=Alignment.CenterVertically){
     Checkbox(checked=acknowledged,onCheckedChange=null,enabled=!model.busy)
     LocalizedText(target.statement,Modifier.weight(1f).padding(start=8.dp))
    }
    LocalizedText("Վնասվածքի կամ պակասի դեպքում մի հաստատեք․ կապվեք ձեր մենեջերի հետ։",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
   }},
   confirmButton={Button(onClick={model.receipt(acknowledged)},enabled=acknowledged&&!model.busy){LocalizedText(if(model.busy)"Հաստատվում է…"else"Այո, հաստատում եմ")}},
   dismissButton={TextButton(onClick={model.cancelReceipt()},enabled=!model.busy){LocalizedText("Չեղարկել")}})
 }

 if(confirmReloadCart)AlertDialog(onDismissRequest={confirmReloadCart=false},title={LocalizedText("Բեռնե՞լ սերվերի զամբյուղը")},text={LocalizedText("Այս սարքի զամբյուղը կփոխարինվի կայքում պահպանված տարբերակով։")},confirmButton={Button(onClick={confirmReloadCart=false;model.reloadServerCart()}){LocalizedText("Բեռնել")}},dismissButton={TextButton(onClick={confirmReloadCart=false}){LocalizedText("Չեղարկել")}})
 if(model.errorDialog.isNotBlank())AlertDialog(onDismissRequest={model.errorDialog=""},title={LocalizedText("Գործողությունը չի ավարտվել")},text={Column(Modifier.heightIn(max=360.dp).verticalScroll(rememberScrollState()).testTag("error-dialog-content")){LocalizedText(model.errorDialog)}},confirmButton={TextButton(onClick={model.errorDialog=""}){LocalizedText("Փակել")}})
 model.successOrder?.let{number->
  var sceneCompleted by rememberSaveable(model.user?.text("id"),number){mutableStateOf(model.demo)}
  if(!sceneCompleted)OrderPreparationScene(onComplete={sceneCompleted=true})
  else AlertDialog(onDismissRequest={model.successOrder=null},title={LocalizedText(if(model.demo)"Դեմո պատվեր №$number"else"Պատվեր №$number ուղարկված է")},text={LocalizedText(if(model.demo)"Դեմո պատվերը պահպանվել է միայն հավելվածի ընթացիկ ցուցադրման մեջ։ Իրական պատվեր չի ուղարկվել։"else"Պատվերը պահպանվել է սերվերում և հասանելի է ադմինիստրատորին։ Սպասեք պատասխանատուի հաստատմանը։")},confirmButton={TextButton(onClick={model.successOrder=null}){LocalizedText("Դիտել պատվերը")}})}
 if(filters)CatalogFiltersDialog(allowWholesale=model.user?.text("role")=="admin"&&model.control("wholesale"),enabled={model.control(it)},isPromotion={model.promotion(it)!=null},products=model.catalogProducts,query=model.query,initial=CatalogFilters(model.brands.toSet(),model.categories.toSet(),model.onlyAvailable,model.onlyPromo,model.sort,model.onlyWholesale&&model.user?.text("role")=="admin"&&model.control("wholesale")),onDismiss={filters=false},onApply={draft->
  model.brands.clear();model.brands.addAll(draft.brands);model.categories.clear();model.categories.addAll(draft.categories)
  model.onlyAvailable=draft.onlyAvailable;model.onlyPromo=draft.onlyPromo;model.changeOnlyWholesale(draft.onlyWholesale);model.sort=draft.sort;model.applyCatalogFilters();filters=false
 })
 product?.let{p->RetailProductDetails(p,model){product=null}}
 if(compareDialog)RetailComparison(model){compareDialog=false}
 if(buyerDialog)BuyerDialog(model,{buyerDialog=false})
 if(confirmSend)AlertDialog(onDismissRequest={confirmSend=false},title={LocalizedText("Ուղարկե՞լ պատվերը")},text={LocalizedText("Ընդամենը՝ "+money(model.total)+"։ Ստուգեք կազմն ու առաքման տվյալները։")},confirmButton={Button(onClick={confirmSend=false;model.submit()}){LocalizedText("Ուղարկել")}},dismissButton={TextButton(onClick={confirmSend=false}){LocalizedText("Հետ")}})
 // The full-screen data scene belongs only to authorization. Other work keeps the original progress UI.
 if(model.authorizationLoading)androidx.compose.ui.window.Dialog(onDismissRequest={},properties=androidx.compose.ui.window.DialogProperties(dismissOnBackPress=false,dismissOnClickOutside=false,usePlatformDefaultWidth=false,decorFitsSystemWindows=false)){
  SessionRestoringScreen()
 }
}
@Composable private fun Login(model:UnifiedModel){
 var login by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var otp by remember{mutableStateOf("")}
 val context=androidx.compose.ui.platform.LocalContext.current
 Box(Modifier.fillMaxSize()){
  Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color(0xFFEFF6FF),Color.White))))
  Box(Modifier.fillMaxWidth().height(230.dp).background(BrandBlue))
  Box(Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),contentAlignment=Alignment.Center){
   Surface(modifier=Modifier.widthIn(max=440.dp).fillMaxWidth(),shape=androidx.compose.foundation.shape.RoundedCornerShape(24.dp),color=Color.White.copy(alpha=0.94f),shadowElevation=12.dp){
    Column(Modifier.padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
  PartnerLogo(Modifier.fillMaxWidth().height(70.dp))
  LocalizedText("Ձեր տեխնիկայի աշխարհը",fontSize=14.sp,color=ShopMuted)
  LanguagePicker()
  LocalizedText("Մուտք ZZWS",style=MaterialTheme.typography.headlineMedium)
  if(model.busy)LinearProgressIndicator(Modifier.fillMaxWidth())
  if(model.notice.isNotBlank())LocalizedText(model.notice,color=MaterialTheme.colorScheme.error)
  if(model.challenge.isNotBlank()){Field(otp,{otp=it},"Հավելվածի վեցանիշ կոդ",true);Button(onClick={model.mfa(otp);otp=""},enabled=!model.busy){LocalizedText("Հաստատել")}}
  else{Field(login,{login=it},"Մուտքանուն");Field(password,{password=it},"Գաղտնաբառ",true);Button(onClick={model.login(login,password);password=""},enabled=!model.busy&&login.isNotBlank()&&password.isNotBlank(),modifier=Modifier.fillMaxWidth()){LocalizedText("Մուտք գործել")}}
  TextButton(onClick={openWebsite(context,false)}){LocalizedText("Մուտքի օգնություն՝ ZZWS կայքում")}
  OutlinedButton(onClick={model.enterDemo()},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){LocalizedText("Դիտել դեմո տարբերակը")}
  LocalizedText("ZZWS · "+EndpointConfiguration.VERSION,style=MaterialTheme.typography.labelSmall)
  if(EndpointConfiguration.API.contains("kadycemsqtndyprchjrr"))LocalizedText("ՓՈՐՁՆԱԿԱՆ ՄԻՋԱՎԱՅՐ · միայն փորձնական պատվերներ",color=MaterialTheme.colorScheme.error)
    }
   }
  }
 }
}
@Composable private fun Field(value:String,change:(String)->Unit,label:String,password:Boolean=false){OutlinedTextField(value,change,label={LocalizedText(label)},singleLine=true,modifier=Modifier.fillMaxWidth(),keyboardOptions=KeyboardOptions(keyboardType=if(password)KeyboardType.Password else KeyboardType.Text),visualTransformation=if(password)PasswordVisualTransformation()else androidx.compose.ui.text.input.VisualTransformation.None)}
@Composable private fun BuyerDialog(model:UnifiedModel,close:()->Unit){
 var search by remember{mutableStateOf("")};var requested by remember{mutableStateOf(false)}
 LaunchedEffect(model.busy){if(!requested&&!model.busy){requested=true;model.searchCustomers("")}}
 val preview=remember{model.screen!="cart"};val choices=customerChoices(model.customers,search)
 var switchBuyer by remember{mutableStateOf<(() -> Unit)?>(null)}
 fun choose(value:JSONObject?){val action={model.chooseBuyer(value,preview,close)};if(preview&&model.buyerView&&model.cart.isNotEmpty()&&value?.text("id")!=model.catalogBuyer?.text("id"))switchBuyer=action else action()}
 AlertDialog(onDismissRequest={if(!model.busy)close()},title={OneLineLabel("Ընտրել հաճախորդին",20)},text={Column(Modifier.fillMaxWidth().heightIn(max=480.dp)){
  Field(search,{search=it},"Հաճախորդի անուն կամ կոդ")
  if(model.busy)LinearProgressIndicator(Modifier.fillMaxWidth().padding(vertical=8.dp))
  Row{TextButton(onClick={model.searchCustomers(search)},enabled=!model.busy){OneLineLabel("Որոնել",13)};TextButton(onClick={choose(null)},enabled=!model.busy){OneLineLabel(if(preview)"Իմ կատալոգը"else"Պատվիրատուն՝ ես",13)}}
  if(!model.busy&&requested&&choices.isEmpty())LocalizedText("Հաճախորդ չի գտնվել։ Փոխեք որոնումը կամ կրկին բեռնեք ցանկը։",Modifier.padding(12.dp))
  androidx.compose.foundation.lazy.LazyColumn(Modifier.weight(1f,false),verticalArrangement=Arrangement.spacedBy(8.dp)){
   items(choices,key={it.text("id")}){buyer->OutlinedCard(onClick={choose(buyer)},enabled=!model.busy,modifier=Modifier.fillMaxWidth()){
    Column(Modifier.padding(14.dp)){LocalizedText(buyer.text("client"),style=MaterialTheme.typography.titleSmall);LocalizedText(buyer.text("customerCode"),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)}
   }}
  }
 }},confirmButton={TextButton(onClick=close,enabled=!model.busy){OneLineLabel("Փակել",13)}})
 switchBuyer?.let{action->AlertDialog(onDismissRequest={switchBuyer=null},title={LocalizedText("Փոխե՞լ պատվիրատուին")},text={LocalizedText("Ընթացիկ հաճախորդի զամբյուղը կմաքրվի։ Չուղարկված պատվեր չի ստեղծվի։")},confirmButton={TextButton(onClick={switchBuyer=null;action()}){LocalizedText("Փոխել")}},dismissButton={TextButton(onClick={switchBuyer=null}){LocalizedText("Չեղարկել")}})}
}
internal fun statusLabel(value:String)=mapOf("new" to "Նոր","confirmed" to "Հաստատված","in_progress" to "Ձևակերպված է","completed" to "Առաքված է","rejected" to "Մերժված","received" to "Ստացված է")[value]?:"Փոփոխված"
internal fun notificationOptions(user:JSONObject?):List<Pair<String,String>>{
 val options=mutableListOf("enabled" to "Միացնել ծանուցումները")
 val orderAdmin=user?.text("role")=="admin"&&user.optBoolean("mobileAdminEnabled")&&user.permission("orders:read")
 if(orderAdmin){options.add("admin_new_orders" to "Նոր պատվերներ");options.add("admin_status_changes" to "Հաճախորդների պատվերների կարգավիճակի փոփոխություններ")}
 if(orderAdmin||user?.text("role")=="client"){options.add("orders" to if(orderAdmin)"Պատվերների այլ փոփոխություններ" else "Իմ պատվերների փոփոխություններ");options.add("comments" to "Պատվերի մեկնաբանություններ")}
 options.addAll(listOf("prices" to "Գների փոփոխություններ","offers" to "Հատուկ առաջարկներ","system" to "Համակարգային ծանուցումներ"));return options
}
@Composable private fun OrderTotal(order:JSONObject){val initial=order.optJSONArray("original_lines").objects().sumOf{it.optDouble("unitPrice")*it.optInt("qty")};val total=order.optDouble("total");if(initial>0&&kotlin.math.abs(initial-total)>.005)LocalizedText(money(initial),textDecoration=TextDecoration.LineThrough,color=MaterialTheme.colorScheme.outline);LocalizedText(money(total),style=MaterialTheme.typography.headlineSmall)}
private fun yerevanTime(value:String)=try{java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(java.time.ZoneId.of("Asia/Yerevan")).format(java.time.Instant.parse(value))+" · Երևան"}catch(_:Exception){value}

internal fun openWebsite(context:Context,admin:Boolean){context.startActivity(Intent(Intent.ACTION_VIEW,android.net.Uri.parse(PARTNER_SITE+if(admin)"admin/" else "")))}
@Composable private fun OrderLines(order:JSONObject){
 orderLineViews(order).forEach{line->Card(Modifier.fillMaxWidth()){Column(Modifier.padding(12.dp)){
  LocalizedText(line.name,textDecoration=if(line.removed)TextDecoration.LineThrough else null);LocalizedText(line.code)
  Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){if(line.originalQty!=null&&line.originalQty!=line.qty)LocalizedText(line.originalQty.toString(),textDecoration=TextDecoration.LineThrough,color=MaterialTheme.colorScheme.error);LocalizedText(if(line.removed)"Հեռացված է" else "${line.qty} հատ")}
  if(line.originalPrice!=null&&line.originalPrice!=line.price)LocalizedText(money(line.originalPrice),textDecoration=TextDecoration.LineThrough,color=MaterialTheme.colorScheme.outline)
  LocalizedText(money(line.price))
 }}}
}
