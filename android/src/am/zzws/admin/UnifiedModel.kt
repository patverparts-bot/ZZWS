package am.zzws.admin

import androidx.compose.runtime.*
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

internal fun JSONArray?.objects(): List<JSONObject> = if(this==null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }
internal fun JSONObject.text(key:String)=optString(key, "").takeUnless { it=="null" } ?: ""
internal fun JSONObject.permission(value:String)=optJSONArray("permissions")?.let { (0 until it.length()).any { n->it.optString(n)==value } } == true
internal fun money(value:Double)=String.format(L10n.locale(),if(value%1.0==0.0)"%,.0f ֏"else"%,.2f ֏",value)
internal data class Product(val data:JSONObject) {
 val code=data.text("articul");val name=data.text("name");val brand=data.text("brand");val category=data.text("category")
 val department=catalogDepartmentId(category)
 val price=data.optDouble("wholesale",0.0);val kp=data.optDouble("kpPrice",0.0);val retail=data.optDouble("retail",0.0)
 val stock=data.text("stockStatus");val available=if(data.has("stockAvailable"))data.optBoolean("stockAvailable") else stock.trim()=="Առկա է";val promo=data.optBoolean("isPromo")||data.optBoolean("isWholesalePromo")||data.optBoolean("kpIsPromo")
}

internal class UnifiedModel(private val trialBackend:TrialDemoBackend=TrialDemoBackend()):ViewModel() {
 var user by mutableStateOf(AppSession.user);private set
 var products by mutableStateOf<List<Product>>(emptyList());private set
 var orders by mutableStateOf<List<JSONObject>>(emptyList());private set
 var order by mutableStateOf<JSONObject?>(null);private set
 var customers by mutableStateOf<List<JSONObject>>(emptyList());private set
 var buyer by mutableStateOf<JSONObject?>(null);private set
 var catalogBuyer by mutableStateOf<JSONObject?>(null);private set
 val buyerView get()=catalogBuyer!=null
 private var quotedProducts by mutableStateOf<Map<String,Product>>(emptyMap())
 var notice by mutableStateOf("");private set
 var errorDialog by mutableStateOf("")
 var receiptConfirmation by mutableStateOf<ReceiptConfirmation?>(null);private set
 var successOrder by mutableStateOf<Long?>(null)
 var busy by mutableStateOf(false);private set
 var challenge by mutableStateOf("");private set
 var screen by mutableStateOf("home")
 var orderSearch by mutableStateOf("");var orderFrom by mutableStateOf("");var orderTo by mutableStateOf("")
 private var appliedOrderFilter=Triple("","","")
 var demo by mutableStateOf(false);private set
 fun enterDemo(){if(busy)return;reset();AppSession.clear();demo=true;user=trialBackend.user;onlyWholesale=CatalogWholesalePreference.read(AppContext.value,EndpointConfiguration.API,user);products=trialBackend.products.map(::Product);publishedOffer=trialBackend.offer;subscriptions=JSONObject().put("enabled",false);setDelivery(0,false);date=java.time.LocalDate.now(java.time.ZoneId.of("Asia/Yerevan")).toString();draftReady=true;screen="home";cartSync="Դեմո · փոփոխությունները միայն այս սարքում են"}
 var catalogControls by mutableStateOf(JSONObject());private set
 var popularity by mutableStateOf(JSONObject());private set
 private var catalogVersion=""
 private var catalogLoadedAt=0L
 private var catalogPollRunning=false
 fun control(key:String)=catalogControls.optBoolean(key,true)
 fun badges(code:String):List<String>{val row=popularity.optJSONObject(code)?:return emptyList();return listOfNotNull(if(control("popular")&&row.optBoolean("popular"))"Հաճախ են գնում"else null,if(control("personalPopular")&&row.optBoolean("personalPopular"))"Դուք հաճախ եք գնում"else null)}
 var query by mutableStateOf("");var brands=mutableStateListOf<String>();var categories=mutableStateListOf<String>()
 var department by mutableStateOf("");private set
 var catalogSections by mutableStateOf(true);private set
 var offerCollection by mutableStateOf(false);private set
 var publishedOffer by mutableStateOf<JSONObject?>(null);private set
 val departments by derivedStateOf{catalogDepartmentCounts(products)}
 val departmentProducts by derivedStateOf{if(department.isEmpty()||!control("category"))products else products.filter{it.department==department}}
 private fun clearCatalogFilters(){brands.clear();categories.clear();query="";onlyAvailable=false;onlyPromo=false;sort=0;offerCollection=false}
 fun showDepartments(){clearCatalogFilters();department="";catalogSections=control("category");screen="catalog"}
 fun showAllProducts(){clearCatalogFilters();department="";catalogSections=false;screen="catalog"}
 fun showDepartment(id:String){showAllProducts();department=id}
 fun showBrand(brand:String){showAllProducts();brands.add(brand)}
 fun showPromotions(){showAllProducts();offerCollection=true}
 fun searchCatalog(text:String){if(screen!="catalog"||query.isBlank()&&text.isNotBlank())showAllProducts();query=text;catalogSections=false;screen="catalog"}
 fun applyCatalogFilters(){catalogSections=false;screen="catalog"}
 var onlyAvailable by mutableStateOf(false);var onlyPromo by mutableStateOf(false);var sort by mutableStateOf(0)
 var onlyWholesale by mutableStateOf(false);private set
 fun changeOnlyWholesale(value:Boolean){onlyWholesale=CatalogWholesalePreference.save(AppContext.value,EndpointConfiguration.API,user,value)}
 val cart=mutableStateMapOf<String,Int>()
 val cartSelection=mutableStateMapOf<String,Boolean>()
 var checkoutStep by mutableStateOf(1)
 private var checkoutProof=""
 private var webHandoff=false
 val selectedLines get()=selectedCart(cart.toMap(),cartSelection.toMap())
 fun isSelected(code:String)=cartSelection[code]!=false
 fun selectLine(code:String,value:Boolean){if(!busy&&!pendingSubmission){cartSelection[code]=value;checkoutReady=false;checkoutProof="";checkoutStep=1}}
 val selectedCount get()=selectedLines.values.sum()
 var priceMode by mutableStateOf("WS")
 var deliveryIndex by mutableStateOf(0);private set
 var method by mutableStateOf("Առաքում");private set
 var address by mutableStateOf("");private set
 var contact by mutableStateOf("");private set
 var date by mutableStateOf("");private set
 var comment by mutableStateOf("");private set
 var draftSync by mutableStateOf("");private set
 var draftConflict by mutableStateOf(false);private set
 private var draftVersion=0;private var draftDirty=false;private var draftEpoch=0;private var draftReady=false
 var checkoutReady by mutableStateOf(false);private set
 var cartSync by mutableStateOf("");private set
 var cartConflict by mutableStateOf(false);private set
 private var cartVersion=0;private var cartDirty=false;private var cartEpoch=0
 private val memoryGate=Mutex()
 var subscriptions by mutableStateOf<JSONObject?>(null);private set
 var management by mutableStateOf<JSONObject?>(null);private set
 fun loadManagement()=run{check(canOpenFeature(PartnerFeature.ADMIN,user));management=call("admin/dashboard")}
 private var requestId:String?=null;private var frozenRequest:JSONObject?=null
 val pendingSubmission get()=frozenRequest!=null
 private val gate=Mutex()
 val admin get()=user?.let { it.text("role")=="admin"&&it.optBoolean("mobileAdminEnabled") }==true
 val target get()=buyer?:user
 val deliveryRows get()=target?.optJSONArray("rowsList").objects()
 fun promotion(p:Product)=promotionKind(p,user?.text("role")=="admin",priceMode,buyerView)
 val specialOffers by derivedStateOf{if(control("promo"))publishedOfferProducts(products,publishedOffer,user?.text("role")=="admin",priceMode,buyerView)else emptyList()}
 val catalogProducts get()=if(offerCollection)specialOffers else departmentProducts
 val filtered by derivedStateOf{if(onlyPromo&&!control("promo"))emptyList()else visibleProducts(wholesalePricedProducts(catalogProducts,onlyWholesale&&control("wholesale"),user?.text("role")=="admin"),if(control("search"))query else "",if(control("brand"))brands.toSet()else emptySet(),if(control("category"))categories.toSet()else emptySet(),control("stock")&&onlyAvailable,onlyPromo,if(control("sorting"))sort else 0,::unit){promotion(it)!=null}}
 val brandOptions get()=brandChoices(departmentProducts,categories.toSet(),brands.toSet())
 val categoryOptions get()=categoryChoices(departmentProducts,brands.toSet(),categories.toSet())
 fun unit(p:Product)=if(screen=="cart")quotedProducts[p.code]?.let{nativePrice(it,user?.text("role")=="admin",priceMode,buyer!=null)}?:if(buyer!=null)0.0 else nativePrice(p,user?.text("role")=="admin",priceMode,false) else nativePrice(p,user?.text("role")=="admin",priceMode,buyerView)
 val total get()=selectedLines.entries.sumOf{(code,qty)->products.find{it.code==code}?.let{unit(it)*qty}?:0.0}
 init { if(user==null) restoreSession() else run{completeLogin()} }
 private fun restoreSession()=run{val restored=withContext(Dispatchers.IO){AppSession.restore()};if(restored)completeLogin()}
 private fun run(work:suspend ()->Unit){if(busy)return;busy=true;notice="";errorDialog="";viewModelScope.launch{try{work()}catch(e:Exception){if(e is CancellationException)throw e;if(e is ApiClient.ApiError&&e.status==401){reset();AppSession.clear()};notice=e.message?:"Գործողությունը չի կատարվել";errorDialog=notice}finally{busy=false}}}
 private suspend fun call(path:String,body:JSONObject?=null):JSONObject=withContext(Dispatchers.IO){gate.withLock{if(demo)trialBackend.call(path,body)else AppSession.api.call(if(body==null)"GET" else "POST",path,body)}}
 private fun reset(){++draftEpoch;draftReady=false;draftDirty=false;draftVersion=0;draftConflict=false;draftSync="";deliveryIndex=0;method="Առաքում";approvalRequests.clear();approvalDefers.clear();approvalReminder=null;approvalLastShown=null;approvalPolling=false;catalogVersion="";catalogLoadedAt=0;department="";catalogSections=true;offerCollection=false;publishedOffer=null;demo=false;orderSearch="";orderFrom="";orderTo="";appliedOrderFilter=Triple("","","");cartSelection.clear();checkoutStep=1;checkoutProof="";webHandoff=false;PartnerLibrary.clear();catalogControls=JSONObject();popularity=JSONObject();++cartEpoch;cartDirty=false;cartVersion=0;cartConflict=false;cartSync="";PushHooks.detach(AppContext.value,AppSession.api);NotificationBridge.clear(AppContext.value);user=null;products=emptyList();orders=emptyList();order=null;buyer=null;catalogBuyer=null;quotedProducts=emptyMap();customers=emptyList();cart.clear();brands.clear();categories.clear();query="";onlyAvailable=false;onlyPromo=false;onlyWholesale=false;sort=0;challenge="";screen="home";frozenRequest=null;requestId=null;checkoutReady=false;address="";contact="";date="";comment="";priceMode="WS";subscriptions=null;management=null;successOrder=null;receiptConfirmation=null;errorDialog=""}
 fun login(login:String,password:String)=run{
  reset();AppSession.clear()
  withContext(Dispatchers.IO){AppSession.api.configure(EndpointConfiguration.API,EndpointConfiguration.PUBLIC_KEY)}
  val response=call("login",JSONObject().put("login",login.trim()).put("password",password))
  if(response.optBoolean("mfaRequired"))challenge=response.text("challengeToken") else completeLogin()
 }
 fun mfa(code:String)=run{call("login/mfa",JSONObject().put("challengeToken",challenge).put("code",code));completeLogin()}
 fun cancelAccountProfile()=run{try{call("logout",JSONObject())}finally{AppSession.clear();reset()}}
 fun saveAccountPerson(firstName:String,lastName:String,phone:String,email:String)=run{call("account/profile",JSONObject().put("firstName",firstName).put("lastName",lastName).put("phone",phone).put("email",email));completeLogin()}
 private suspend fun completeLogin(){val me=call("me");if(me.optBoolean("needsProfileSetup")&&!me.optBoolean("needsPasswordSetup")){user=me;AppSession.user=me;return};if(me.optBoolean("needsPasswordSetup")){AppSession.clear();throw Exception("Նախ կայքում բացեք հրավերի հղումը և սահմանեք նոր գաղտնաբառը։")};try{call("me/mobile/session",JSONObject())}catch(e:ApiClient.ApiError){if(e.status!=404)throw e};withContext(Dispatchers.IO){AppSession.remember()};user=me;AppSession.user=me;onlyWholesale=CatalogWholesalePreference.read(AppContext.value,EndpointConfiguration.API,user);challenge="";loadCatalog();setDelivery(0,false);loadServerCart(true);frozenRequest=withContext(Dispatchers.IO){SecurePendingOrder.read(AppContext.value,me.text("id"))};if(frozenRequest!=null){screen="cart";notice="Նախորդ ուղարկումը պետք է ստուգել։ Նույն ուղարկումը կրկնօրինակ չի ստեղծի։"};subscriptions=call("me/mobile/preferences")}
 private suspend fun loadServerCart(includeDraft:Boolean=false){val state=call("me/state");cartVersion=state.optJSONObject("versions")?.optInt("cart")?:0;cart.clear();cart.putAll(memoryQuantities(state.optJSONObject("data")?.optJSONObject("cart")));cartDirty=false;cartConflict=false;PartnerLibrary.load(user?.text("id").orEmpty());PartnerLibrary.accept(favoriteList(state.optJSONObject("data")?.optJSONArray("favorites")));cartSync="Զամբյուղը համաժամացված է սերվերի հետ";if(includeDraft)loadCheckoutDraft(state)}
 private fun checkoutDraft()=CheckoutDraft(deliveryRows.getOrNull(deliveryIndex)?.text("id").orEmpty(),method,address,contact,date,comment)
 private fun applyCheckoutDraft(value:JSONObject?){val restored=restoreCheckoutDraft(value,deliveryRows);deliveryIndex=restored.index;method=restored.value.method;address=restored.value.address;contact=restored.value.contact;date=restored.value.date;comment=restored.value.comment;checkoutReady=false;checkoutProof=""}
 private suspend fun loadCheckoutDraft(state:JSONObject){
  val who=user?.text("id")?:return;val remote=state.optJSONObject("data")?.optJSONObject("draft");val remoteVersion=state.optJSONObject("versions")?.optInt("draft")?:0
  var localError:String?=null
  val local=try{if(demo)null else withContext(Dispatchers.IO){SecureCheckoutDraft.read(AppContext.value,who)}}catch(e:Exception){if(e is CancellationException)throw e;localError=e.message;null}
  if(user?.text("id")!=who)return
  if(localError!=null){draftVersion=remoteVersion;draftDirty=true;draftConflict=true;applyCheckoutDraft(remote);draftReady=true;draftSync=localError;return}
  draftVersion=local?.optInt("version")?:remoteVersion;val pending=local?.optJSONObject("value")
  draftDirty=pending!=null&&!sameCheckoutDraft(pending,remote);draftConflict=draftDirty&&draftVersion!=remoteVersion
  applyCheckoutDraft(if(draftDirty)pending else remote);draftReady=true
  if(!draftDirty){draftVersion=remoteVersion;if(!demo)SecureCheckoutDraft.clear(AppContext.value,who)}
  draftSync=if(draftConflict)"Պատվերի տվյալները փոխվել են այլ սարքում։ Տեղական տարբերակը պահպանված է։"else if(draftDirty)"Պատվերի տվյալները սպասում են համաժամացման։"else"Պատվերի տվյալները պահպանված են սերվերում։"
  if(draftDirty&&!draftConflict)viewModelScope.launch{try{persistDraft()}catch(e:Exception){if(e is CancellationException)throw e;draftSync=e.message?:"Պատվերի տվյալները սպասում են համաժամացման։"}}
 }
 private fun journalDraft(){if(!demo&&draftReady&&user!=null&&buyer==null&&catalogBuyer==null)SecureCheckoutDraft.save(AppContext.value,user!!.text("id"),JSONObject().put("version",draftVersion).put("value",checkoutDraft().json()))}
 private fun draftChanged(){
  checkoutReady=false;checkoutProof=""
  if(!draftReady||user==null||buyer!=null||catalogBuyer!=null)return
  draftDirty=true;val epoch=++draftEpoch;draftSync=if(draftConflict)"Պատվերի տվյալները փոխվել են այլ սարքում։ Տեղական տարբերակը պահպանված է։"else"Պատվերի տվյալները սպասում են համաժամացման։"
  try{journalDraft()}catch(e:Exception){draftSync=e.message?:"Չհաջողվեց պահպանել պատվերի տվյալների տեղական պատճենը։"}
  viewModelScope.launch{delay(600);if(epoch==draftEpoch)try{persistDraft()}catch(e:Exception){if(e is CancellationException)throw e;draftSync=e.message?:"Պատվերի տվյալները սպասում են համաժամացման։"}}
 }
 private suspend fun persistDraft(){memoryGate.withLock{
  if(!draftDirty||draftConflict||!draftReady||buyer!=null||catalogBuyer!=null||user==null)return@withLock
  val who=user!!.text("id");val snapshot=checkoutDraft().json();val fingerprint=snapshot.toString()
  try{
   val saved=call("me/state",JSONObject().put("section","draft").put("version",draftVersion).put("value",snapshot))
   if(user?.text("id")!=who)return@withLock
   draftVersion=saved.getInt("version");draftDirty=checkoutDraft().json().toString()!=fingerprint
   if(draftDirty)journalDraft()else if(!demo)SecureCheckoutDraft.clear(AppContext.value,who)
   draftSync=if(draftDirty)"Պատվերի տվյալները սպասում են համաժամացման։"else"Պատվերի տվյալները պահպանված են սերվերում։"
  }catch(e:ApiClient.ApiError){
   if(e.status!=409||user?.text("id")!=who)throw e
   val state=call("me/state");val remote=state.optJSONObject("data")?.optJSONObject("draft")
   if(user?.text("id")!=who)return@withLock
   if(sameCheckoutDraft(remote,snapshot)){draftVersion=state.optJSONObject("versions")?.optInt("draft")?:0;draftDirty=checkoutDraft().json().toString()!=fingerprint;if(draftDirty)journalDraft()else if(!demo)SecureCheckoutDraft.clear(AppContext.value,who);draftSync=if(draftDirty)"Պատվերի տվյալները սպասում են համաժամացման։"else"Պատվերի տվյալները պահպանված են սերվերում։"}
   else{draftConflict=true;draftSync="Պատվերի տվյալները փոխվել են այլ սարքում։ Տեղական տարբերակը պահպանված է։"}
  }
 }}
 fun updateDelivery(method:String=this.method,address:String=this.address,contact:String=this.contact,date:String=this.date,comment:String=this.comment){if(busy||pendingSubmission)return;this.method=method;this.address=address.take(3000);this.contact=contact.take(3000);this.date=date.take(3000);this.comment=comment.take(3000);draftChanged()}
 fun saveCheckoutDraft()=run{persistDraft()}
 fun reloadCheckoutDraft()=run{check(buyer==null&&catalogBuyer==null&&!pendingSubmission);++draftEpoch;memoryGate.withLock{val state=call("me/state");if(!demo)SecureCheckoutDraft.clear(AppContext.value,user!!.text("id"));loadCheckoutDraft(state)}}
 fun keepCheckoutDraft()=run{check(buyer==null&&catalogBuyer==null&&!pendingSubmission);memoryGate.withLock{val state=call("me/state");draftVersion=state.optJSONObject("versions")?.optInt("draft")?:0;draftConflict=false;draftDirty=true;journalDraft()};persistDraft()}
 fun reloadServerCart()=run{check(buyer==null&&catalogBuyer==null&&frozenRequest==null);memoryGate.withLock{loadServerCart()};checkoutReady=false}
 private fun cartChanged(){cartDirty=true;val epoch=++cartEpoch;cartSync="Զամբյուղը պահպանվում է…";viewModelScope.launch{delay(600);if(epoch==cartEpoch)try{persistCart()}catch(e:Exception){if(e is CancellationException)throw e;cartSync=e.message?:"Զամբյուղը դեռ չի համաժամացվել։ Կրկին փորձեք։"}}}
 private suspend fun persistCart(){memoryGate.withLock{
  if(!cartDirty||cartConflict||buyer!=null||catalogBuyer!=null||user==null)return@withLock
  val who=user!!.text("id");val snapshot=cart.toMap();val payload=cartMemory(snapshot,products,priceMode)
  try{val saved=call("me/state",JSONObject().put("section","cart").put("version",cartVersion).put("value",payload));if(user?.text("id")!=who)return@withLock;cartVersion=saved.getInt("version");cartDirty=cart.toMap()!=snapshot;cartSync=if(cartDirty)"Զամբյուղը պահպանվում է…"else"Զամբյուղը համաժամացված է սերվերի հետ"}
  catch(e:ApiClient.ApiError){if(e.status==409&&user?.text("id")==who){val state=call("me/state");val remote=memoryQuantities(state.optJSONObject("data")?.optJSONObject("cart"));if(remote==snapshot){cartVersion=state.optJSONObject("versions")?.optInt("cart")?:0;cartDirty=cart.toMap()!=snapshot}else{cartConflict=true;cartSync="Զամբյուղը փոխվել է այլ սարքում։ Տեղական տարբերակը չի վերագրվել։"}}else throw e}
 }}
 fun saveServerCart()=run{persistCart()}
 private fun catalogPath(customerId:String?)=if(customerId==null)"catalog"else"admin/orders/customer-catalog?customerId="+URLEncoder.encode(customerId,"UTF-8")
 private fun acceptCatalog(response:JSONObject){response.optJSONObject("account")?.let{user=it;AppSession.user=it};products=response.getJSONArray("products").objects().map(::Product);publishedOffer=response.optJSONObject("specialOffer");catalogControls=response.optJSONObject("controls")?:JSONObject();popularity=response.optJSONObject("popularity")?:JSONObject();response.optJSONObject("customer")?.let{catalogBuyer=it;if(buyer?.text("id")==it.text("id"))buyer=it};catalogVersion=response.text("version");catalogLoadedAt=android.os.SystemClock.elapsedRealtime();checkoutReady=false;quotedProducts=emptyMap()}
 suspend fun loadCatalog(){acceptCatalog(call(catalogPath(catalogBuyer?.text("id"))))}
 /** Version polling is silent and does not block catalogue interaction or touch the basket. */
 fun pollCatalog(){
  if(user==null||demo||busy||catalogPollRunning||!canReloadCatalog(screen,pendingSubmission))return
  val account=user!!.text("id");val customer=catalogBuyer?.text("id")
  fun stillCurrent()=user?.text("id")==account&&catalogBuyer?.text("id")==customer&&!busy&&canReloadCatalog(screen,pendingSubmission)
  catalogPollRunning=true
  viewModelScope.launch{try{
   val version=call("catalog/version").text("version")
   if(stillCurrent()&&catalogNeedsRefresh(catalogVersion,version,catalogLoadedAt,android.os.SystemClock.elapsedRealtime())){
    val response=call(catalogPath(customer))
    if(stillCurrent()){acceptCatalog(response);catalogVersion=version}
   }
  }catch(error:CancellationException){throw error}catch(error:Exception){
   if(error is ApiClient.ApiError&&error.status==401&&user?.text("id")==account){reset();AppSession.clear()}
   // Offline/interrupted refresh keeps the last complete catalogue; the next tick retries.
  }finally{catalogPollRunning=false}}
 }
 fun refresh()=run{check(canReloadCatalog(screen,pendingSubmission));val me=call("me");if(me.text("id")!=user?.text("id")){reset();throw Exception("Կրկին մուտք գործեք")};user=me;AppSession.user=me;loadCatalog()}
 fun resume() {if(user?.optBoolean("needsProfileSetup")==true)return;if(user==null){if(!busy)restoreSession();return};run{val me=call("me");try{call("me/mobile/session",JSONObject())}catch(e:ApiClient.ApiError){if(e.status!=404)throw e};user=me;AppSession.user=me;subscriptions=call("me/mobile/preferences");val reload=canReloadCatalog(screen,pendingSubmission);if(reload)loadCatalog();if(webHandoff&&buyer==null&&catalogBuyer==null&&!pendingSubmission){if(!reload)loadCatalog();loadServerCart(true);webHandoff=false}}}
 fun logout()=run{if(demo){reset();return@run};persistDraft();check(!draftDirty||buyer!=null||catalogBuyer!=null){"Նախ պահպանեք կամ բեռնեք պատվերի տվյալները։"};persistCart();check(!cartDirty||buyer!=null){"Զամբյուղը դեռ չի համաժամացվել։ Նախ պահպանեք կամ բեռնեք սերվերի տարբերակը։"};withContext(Dispatchers.IO){PushHooks.revoke(AppContext.value,AppSession.api)};try{call("logout",JSONObject())}finally{AppSession.clear();reset()}}
 fun setQty(code:String,qty:Int){if(busy||frozenRequest!=null)return;if(qty>9999){notice="Քանակը՝ 1-ից 9999";return};if(qty<=0)cart.remove(code) else cart[code]=qty;checkoutReady=false;requestId=null;if(buyer==null&&catalogBuyer==null)cartChanged()}
 fun clearCart(){if(!busy&&frozenRequest==null){cart.clear();checkoutReady=false;requestId=null;if(buyer==null&&catalogBuyer==null)cartChanged()}}
 fun changePriceMode(mode:String){if(busy||frozenRequest!=null)return;priceMode=if(mode=="KP")"KP"else"WS";checkoutReady=false}
 fun searchCustomers(text:String)=run{check(canSelectCustomer(user));customers=call("admin/orders/customers?search="+URLEncoder.encode(text,"UTF-8")).optJSONArray("customers").objects()}
 fun chooseBuyer(value:JSONObject?,preview:Boolean=true,onSelected:()->Unit={})=run{
  check(canSelectCustomer(user));check(frozenRequest==null){"Նախ ստուգեք նախորդ ուղարկումը"}
  persistDraft();check(!draftDirty||buyer!=null||catalogBuyer!=null){"Նախ պահպանեք կամ բեռնեք պատվերի տվյալները։"};persistCart();check(!cartDirty||buyer!=null){"Նախ համաժամացրեք ձեր զամբյուղը"}
  var selectedQuotes=emptyMap<String,Product>()
  if(preview){
   val response=call(if(value==null)"catalog" else "admin/orders/customer-catalog?customerId="+URLEncoder.encode(value.text("id"),"UTF-8"))
   val selected=response.optJSONObject("customer")?:value
   val selectedProducts=response.optJSONArray("products").objects().map(::Product)
   buyer=selected;catalogBuyer=selected;department="";catalogSections=false;products=selectedProducts;cart.clear();brands.clear();categories.clear();query=""
  }else{
   val response=if(value==null)null else call("admin/orders/customer-quote",JSONObject().put("customerId",value.text("id")).put("articuls",JSONArray(cart.keys.toList())))
   val selected=response?.getJSONObject("customer")
   selectedQuotes=response?.optJSONArray("products").objects().map(::Product).associateBy{it.code}
   buyer=selected
  }
  quotedProducts=selectedQuotes;requestId=null;checkoutReady=false
  setDelivery(0,false)
  if(value==null){if(preview)loadServerCart(true)else loadCheckoutDraft(call("me/state"))}
  onSelected()
 }
 fun setDelivery(index:Int,persist:Boolean=true){deliveryIndex=index.coerceAtLeast(0);val row=deliveryRows.getOrNull(deliveryIndex);address=row?.text("address")?:"";contact=row?.text("contact")?:"";if(persist)draftChanged()else{checkoutReady=false;checkoutProof=""}}
 fun quote()=run{refreshQuote()}
 fun nextCheckout(onReady:()->Unit)=prepareCheckout(onReady)
 private fun checkoutSnapshot()=JSONObject().put("cart",JSONObject(selectedLines.toSortedMap())).put("prices",JSONArray(selectedLines.keys.sorted().map{code->JSONObject().put("code",code).put("price",products.find{it.code==code}?.let{unit(it)}?:0)})).put("buyer",target?.text("id")).put("revision",target?.optInt("profileRevision")).put("delivery",deliveryRows.getOrNull(deliveryIndex)?.text("id")).put("method",method).put("address",address).put("contact",contact).put("date",date).put("comment",comment).put("mode",priceMode).toString()
 fun prepareCheckout(onReady:()->Unit)=run{validateCheckout(selectedLines.isNotEmpty(),deliveryRows.getOrNull(deliveryIndex)!=null,method,address,contact,date);refreshQuote();screen="cart";checkoutProof=checkoutSnapshot();onReady()}
 private suspend fun refreshQuote(){
  if(frozenRequest!=null)throw Exception("Նախ ստուգեք նախորդ ուղարկման արդյունքը։")
  if(buyer==null){val latest=call("me");val selected=deliveryRows.getOrNull(deliveryIndex)?.text("id");user=latest;AppSession.user=latest;if(selected!=deliveryRows.getOrNull(deliveryIndex)?.text("id")){checkoutReady=false;throw Exception("Առաքման տարբերակները փոխվել են։ Կրկին ընտրեք տարբերակը։")}}
  check(selectedLines.isNotEmpty()){ "Ընտրեք ուղարկվող ապրանքները" };val codes=JSONArray(selectedLines.keys.toList());val payload=JSONObject().put("articuls",codes)
  buyer?.let{payload.put("customerId",it.text("id"))}
  val result=call(if(buyer==null)"orders/quote" else "admin/orders/customer-quote",payload)
  val missing=result.optJSONArray("unavailable");if(missing!=null&&missing.length()>0)throw Exception("Անհասանելի արտիկուլներ՝ $missing")
  val fresh=result.optJSONArray("products").objects().map(::Product).associateBy{it.code}
  quotedProducts=fresh;result.optJSONObject("customer")?.let{latest->val selected=deliveryRows.getOrNull(deliveryIndex)?.text("id");buyer=latest;if(selected!=deliveryRows.getOrNull(deliveryIndex)?.text("id")){checkoutReady=false;throw Exception("Առաքման տարբերակները փոխվել են։ Կրկին ընտրեք տարբերակը։")}};checkoutReady=true
  notice="Գները թարմացված են։ Ստուգեք կազմն ու գումարը մինչև ուղարկելը։"
 }
 fun submit()=run{
  val payload=frozenRequest?:kotlin.run{
   check(checkoutReady&&checkoutProof==checkoutSnapshot()){ "Կրկին ստուգեք կազմն ու գները" };validateCheckout(selectedLines.isNotEmpty(),deliveryRows.getOrNull(deliveryIndex)!=null,method,address,contact,date)
   val row=deliveryRows.getOrNull(deliveryIndex)?:throw Exception("Ընտրեք առաքման տարբերակը")
   val lines=JSONArray();for((code,qty)in selectedLines){val p=products.find{it.code==code}?:throw Exception("Թարմացրեք գները");check(unit(p)>0){"Ապրանքի գինը բացակայում է"};lines.put(JSONObject().put("articul",code).put("qty",qty).put("unitPrice",unit(p)))}
   requestId=requestId?:UUID.randomUUID().toString()
   JSONObject().put("requestId",requestId).put("deliveryVariantId",row.text("id")).put("profileRevision",target!!.optInt("profileRevision")).put("priceMode",priceMode).put("lines",lines).put("delivery",JSONObject().put("method",method).put("address",address).put("contact",contact).put("date",date).put("comment",comment)).also{buyer?.let{b->it.put("customerId",b.text("id"))};frozenRequest=it}
  }
  withContext(Dispatchers.IO){SecurePendingOrder.save(AppContext.value,user!!.text("id"),payload)}
  val result=try{call(if(payload.has("customerId"))"admin/orders/create" else "orders",payload)}catch(e:ApiClient.ApiError){if(e.status in listOf(400,403,409)){SecurePendingOrder.clear(AppContext.value,user!!.text("id"));frozenRequest=null;requestId=null;checkoutReady=false};throw e}
  check(result.text("id").matches(Regex("[a-fA-F0-9-]{36}"))&&result.optLong("number")>0){"Սերվերի հաստատումը չի ստացվել։ Ստուգեք պատվերի պատմությունը և կրկնեք նույն ուղարկումը։"}
  SecurePendingOrder.clear(AppContext.value,user!!.text("id"));if(!payload.has("customerId")||buyer!=null)payload.optJSONArray("lines").objects().forEach{line->if(cart[line.text("articul")]==line.optInt("qty"))cart.remove(line.text("articul"))};frozenRequest=null;requestId=null;checkoutReady=false;order=result;screen="order";successOrder=result.optLong("number");notice="Պատվերն ուղարկված է։ №"+result.optLong("number");if(!payload.has("customerId")){cartChanged()}
 }
 fun history()=run{val filters=Triple(orderSearch,orderFrom,orderTo);orders=call(orderHistoryPath(filters.first,filters.second,filters.third)).optJSONArray("orders").objects();appliedOrderFilter=filters;screen="orders"}
 fun olderOrders()=run{val before=orders.lastOrNull()?.optLong("number")?:return@run;val next=call(orderHistoryPath(appliedOrderFilter.first,appliedOrderFilter.second,appliedOrderFilter.third,before)).optJSONArray("orders").objects();orders=(orders+next).distinctBy{it.text("id")}}
 var approvalReminder by mutableStateOf<JSONObject?>(null);private set
 private var approvalLastShown:Long?=null
 private var approvalPolling=false
 private val approvalDefers=mutableMapOf<String,Pair<String,String>>()
 fun dismissApprovalReminder(){approvalReminder=null;approvalLastShown=android.os.SystemClock.elapsedRealtime()}
 fun openApprovalReminder(){if(busy)return;val id=approvalReminder?.text("id")?:return;dismissApprovalReminder();openOrder(id)}
 fun pollApprovalReminder(canShow:Boolean){
  if(demo||user?.text("role")!="client"||approvalPolling||busy)return
  val account=user?.text("id");approvalPolling=true
  viewModelScope.launch{try{
   val due=call("orders/approval-pending").optJSONArray("orders").objects().filter{it.optBoolean("reminderDue",true)}
   if(user?.text("id")!=account)return@launch
   if(due.isEmpty()){approvalReminder=null;approvalLastShown=null;return@launch}
   if(approvalReminder!=null&&due.none{it.text("proposalId")==approvalReminder?.text("proposalId")})approvalReminder=null
   val reviewing=screen=="order"&&order?.optJSONObject("approval")?.text("state")=="pending"
   if(approvalReminder==null&&approvalReminderDue(android.os.SystemClock.elapsedRealtime(),approvalLastShown,true,canShow&&!busy&&!pendingSubmission&&!reviewing&&screen!="cart"&&receiptConfirmation==null&&errorDialog.isBlank())){approvalReminder=due.first();approvalLastShown=android.os.SystemClock.elapsedRealtime()}
  }catch(error:CancellationException){throw error}catch(error:Exception){if(error is ApiClient.ApiError&&error.status==401&&user?.text("id")==account){reset();AppSession.clear()}}
  finally{approvalPolling=false}}
 }
 fun deferApprovalReminder(minutes:Int)=run{
  val target=approvalReminder?:return@run;deferApproval(target,minutes)
 }
 fun deferCurrentApproval(minutes:Int)=run{
  val current=order?:return@run;check(clientCanReviewApproval(user,current)){"Միայն հաճախորդը կարող է հաստատել փոփոխությունները"}
  val target=JSONObject().put("id",current.text("id")).put("revision",current.optInt("revision")).put("proposalId",current.getJSONObject("approval").text("id"))
  deferApproval(target,minutes)
 }
 private suspend fun deferApproval(target:JSONObject,minutes:Int){
  require(minutes in 1..60){"Ընտրեք 1-ից 60 րոպե"}
  val body=JSONObject().put("orderId",target.text("id")).put("revision",target.optInt("revision")).put("proposalId",target.text("proposalId")).put("minutes",minutes)
  val key=target.text("proposalId");val fingerprint=body.toString();val prior=approvalDefers[key]
  check(prior==null||prior.first==fingerprint){"Նախորդ պատասխանի արդյունքը դեռ անհայտ է։ Թարմացրեք պատվերը։"}
  val request=prior?.second?:UUID.randomUUID().toString();approvalDefers[key]=fingerprint to request;body.put("requestId",request)
  try{val result=call("orders/approval-defer",body);approvalDefers.remove(key);updateReceiptOrder(result);dismissApprovalReminder();notice="Ադմինիստրատորը ծանուցված է Ձեր խնդրած ժամանակի մասին։"}
  catch(error:ApiClient.ApiError){if(error.status in listOf(400,403,404,409)){approvalDefers.remove(key);if(error.status==409)dismissApprovalReminder()};throw error}
 }
 private val approvalRequests=mutableMapOf<String,Pair<String,String>>()
 fun respondToApproval(decision:String,declined:List<String>)=run{
  val current=order?:return@run;val offer=current.optJSONObject("approval")?:return@run
  val base=approvalResponsePayload(user,current,decision,declined,"pending")
  val key=offer.text("id");val fingerprint=base.toString();val prior=approvalRequests[key]
  check(prior==null||prior.first==fingerprint){"Նախորդ պատասխանի արդյունքը դեռ անհայտ է։ Թարմացրեք պատվերը։"}
  val request=prior?.second?:java.util.UUID.randomUUID().toString();approvalRequests[key]=fingerprint to request;base.put("requestId",request)
  try{val result=call("orders/approval",base);approvalRequests.remove(key);updateReceiptOrder(result);approvalReminder=null;notice="Համաձայնության պատասխանը պահպանված է։"}
  catch(e:ApiClient.ApiError){if(e.status in listOf(400,403,404,409))approvalRequests.remove(key);throw e}
 }
 fun openOrder(id:String)=run{val response=call(if(admin&&user?.permission("orders:read")==true)"admin/orders/detail"else"orders/detail",JSONObject().put("id",id));order=response.optJSONObject("order")?:response;screen="order"}
 private fun updateReceiptOrder(value:JSONObject){
  val id=value.text("id");orders=orders.map{if(it.text("id")==id)value else it};if(order?.text("id")==id)order=value
 }
 fun prepareReceipt(id:String,revision:Int)=run{
  val result=prepareClientReceipt(user,id,::call,revision);updateReceiptOrder(result.order);receiptConfirmation=result.confirmation
  if(result.needsReview){order=result.order;screen="order";notice="Պատվերը փոխվել է։ Ստուգեք թարմացված կազմը, ապա հաստատեք ստացումը։"}
  else if(result.confirmation==null)notice="Պատվեր №"+result.order.optLong("number")+"-ի ստացումն արդեն հաստատված է։"
 }
 fun cancelReceipt(){if(!busy)receiptConfirmation=null}
 fun receipt(acknowledged:Boolean)=run{
  val target=receiptConfirmation?:return@run
  try{
   val result=submitClientReceipt(user,target,acknowledged,::call);updateReceiptOrder(result)
   notice="Պատվեր №"+result.optLong("number")+"-ի ստացումը հաստատված է։ Պատվերը փակված է։"
  }catch(error:ReceiptChanged){updateReceiptOrder(error.current);order=error.current;screen="order";throw error}
  finally{receiptConfirmation=null}
 }

 fun toggleFavorite(code:String)=run{
  val wanted=code !in PartnerLibrary.favorites
  if(demo){PartnerLibrary.favorite(code);return@run}
  val state=call("me/state");val favorites=favoriteChange(favoriteList(state.optJSONObject("data")?.optJSONArray("favorites")),code,wanted)
  call("me/state",JSONObject().put("section","favorites").put("version",state.optJSONObject("versions")?.optInt("favorites")?:0).put("value",JSONArray(favorites.toList())))
  PartnerLibrary.accept(favorites)
 }
 fun openFeature(feature:PartnerFeature,context:android.content.Context)=run{
  check(!demo){"Այս գործիքը հասանելի է իրական հաշիվ մուտք գործելուց հետո։"}
  check(canOpenFeature(feature,user));check(!pendingSubmission){"Նախ ստուգեք նախորդ ուղարկումը"}
  check(buyer==null&&catalogBuyer==null){"Նախ վերադարձեք ձեր կատալոգին"}
  persistDraft();check(!draftDirty&&!draftConflict){"Նախ պահպանեք կամ բեռնեք պատվերի տվյալները։"};persistCart();check(!cartDirty&&!cartConflict){"Նախ համաժամացրեք ձեր զամբյուղը"}
  webHandoff=true
  context.startActivity(android.content.Intent(context,PartnerWebActivity::class.java).putExtra("feature",feature.name))
 }
 fun notifications()=run{subscriptions=call("me/mobile/preferences");screen="notifications"}
 fun subscribe(key:String,value:Boolean,context:android.content.Context)=run{
  val previous=subscriptions?:call("me/mobile/preferences");val changed=JSONObject(previous.toString()).put(key,value)
  subscriptions=call("me/mobile/preferences",changed)
  if(demo)return@run; if(subscriptions?.optBoolean("enabled")==true)PushHooks.attach(context,AppSession.api) else withContext(Dispatchers.IO){PushHooks.revoke(context,AppSession.api)}
 }
 fun notification(kind:String,id:String)=run{
  if(kind.startsWith("order.")&&id.matches(Regex("[a-fA-F0-9-]{36}"))){val response=call(if(admin&&user?.permission("orders:read")==true)"admin/orders/detail" else "orders/detail",JSONObject().put("id",id));order=response.optJSONObject("order")?:response;screen="order"}
  else{loadCatalog();if(kind=="catalog.offers")showPromotions()else showAllProducts()}
 }
}
