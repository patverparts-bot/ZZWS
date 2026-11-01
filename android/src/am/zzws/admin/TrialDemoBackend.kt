package am.zzws.admin
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
/** Local preview only; never calls the server. */
internal class TrialDemoBackend(private val sample:List<JSONObject>?=null,private val published:List<String>?=null,initialOrders:List<JSONObject> = emptyList(),initialCustomers:List<JSONObject> = emptyList()) {
 val user=JSONObject().put("id","00000000-0000-4000-8000-000000000001").put("login","design-demo").put("client","ZZWS · Դեմո").put("role","client").put("active",true).put("profileRevision",1).put("rowsList",JSONArray().put(JSONObject().put("id","demo-delivery").put("organization","ZZWS Preview").put("address","Երևան · փորձնական հասցե").put("contact","Դեմո օգտատեր")))
 val products:List<JSONObject> by lazy{sample?:AppContext.value.assets.open("trial-products.json").bufferedReader().use{JSONArray(it.readText()).objects()}}
 val offer get()=JSONObject().put("id","demo-offer").put("title","Հատուկ առաջարկներ").put("revision",1).put("articles",JSONArray(published?:products.filter{it.optBoolean("isWholesalePromo")}.map{it.text("articul")}))
 private val memory=mutableMapOf<String,JSONObject>();private val versions=mutableMapOf<String,Int>()
 private var preferences=JSONObject().put("enabled",false)
 private val orders=initialOrders.map{JSONObject(it.toString())}.toMutableList()
 private val customers=initialCustomers.map{JSONObject(it.toString())}
 @Synchronized fun call(path:String,body:JSONObject?):JSONObject {
  return when {
   path=="me"->JSONObject(user.toString())
   path=="catalog"->JSONObject().put("products",JSONArray(products)).put("specialOffer",offer)
   path=="me/state"&&body==null->JSONObject().put("versions",JSONObject(versions.toMap())).put("data",JSONObject(memory.mapValues{JSONObject(it.value.toString())}))
   path=="me/state"->{val section=body!!.text("section");require(section in listOf("cart","draft"));val version=versions[section]?:0;if(body.optInt("version")!=version)throw ApiClient.ApiError(409,"Դեմո տվյալները փոխվել են");memory[section]=JSONObject(body.getJSONObject("value").toString());versions[section]=version+1;JSONObject().put("version",version+1)}
   path=="me/mobile/preferences"->{if(body!=null)preferences=JSONObject(body.toString());JSONObject(preferences.toString())}
   path=="orders/quote"->{val requested=body!!.getJSONArray("articuls").let{a->(0 until a.length()).map{a.getString(it)}};JSONObject().put("products",JSONArray(products.filter{it.text("articul") in requested})).put("unavailable",JSONArray(requested.filter{c->products.none{it.text("articul")==c}}))}
   path=="orders"&&body!=null->{
    orders.find{it.text("requestId")==body.text("requestId")}?.let{return JSONObject(it.toString())}
    val lines=body.getJSONArray("lines").objects().map{l->val p=products.first{it.text("articul")==l.text("articul")};require(l.optInt("qty") in 1..9999);JSONObject(l.toString()).put("name",p.text("name")).put("unitPrice",p.optDouble("wholesale"))}
    val created=JSONObject().put("id",UUID.randomUUID().toString()).put("number",90001+orders.size).put("requestId",body.text("requestId")).put("status","new").put("revision",1).put("created",java.time.Instant.now().toString()).put("total",lines.sumOf{it.optDouble("unitPrice")*it.optInt("qty")}).put("lines",JSONArray(lines)).put("original_lines",JSONArray(lines)).put("delivery",body.getJSONObject("delivery")).put("comment",body.getJSONObject("delivery").text("comment"))
    orders.add(0,created);JSONObject(created.toString())
   }
   path=="orders"||path.startsWith("orders?before=")->JSONObject().put("orders",JSONArray(orders))
   path=="admin/orders/customers"||path.startsWith("admin/orders/customers?")->JSONObject().put("customers",JSONArray(customers))
   path=="orders/receipt-state"->JSONObject().put("statement",RECEIPT_STATEMENT)
   path=="orders/detail"||path=="admin/orders/detail"->JSONObject((orders.firstOrNull{it.text("id")==body?.text("id")}?:throw IllegalArgumentException("Դեմո պատվերը չի գտնվել")).toString())
   path=="logout"||path=="me/mobile/session"->JSONObject()
   else->throw IllegalArgumentException("Այս գործողությունը հասանելի է իրական հաշիվ մուտք գործելուց հետո։")
  }
 }
}
