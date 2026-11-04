package am.zzws.admin

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

internal const val PARTNER_SITE="https://zzws-1z2.pages.dev/"
internal const val LEGACY_PARTNER_SITE="https://patverparts-bot.github.io/ZZWS/"
internal enum class PartnerFeature(val title:String,val path:String,val permission:String?=null){
 ASSISTANT("ԶիգԶագն AI", "?partner=assistant"),
 SAVED_CARTS("Պահպանված զամբյուղներ", "?partner=saved-carts"),
 TEAM("Իմ աշխատակիցները", "?partner=team"),
 SELLER("Վաճառողի գործիքներ", "?partner=seller"),
 TECHNICAL("Տեխնիկական զտիչներ", "?partner=technical"),
 ADMIN("Կառավարման բաժիններ", "admin/", "admin"),
 ORDERS("Պատվերների կառավարում", "admin/#tab=manager", "orders:read"),
 CLIENTS("Հաճախորդներ", "admin/#tab=users", "users"),
 PRICES("Գնացուցակի կառավարում", "admin/#tab=price", "price:read"),
 DASHBOARD("Աշխատանքային սեղան", "admin/#tab=dashboard", "admin")
}
internal fun canOpenFeature(feature:PartnerFeature,user:JSONObject?):Boolean{
 if(user==null||user.optBoolean("needsPasswordSetup")||user.optBoolean("needsProfileSetup")||user.has("active")&&!user.optBoolean("active"))return false
 if(feature==PartnerFeature.TEAM)return user.text("role")=="client"&&user.text("clientRole")=="manager"
 if(feature.permission==null)return user.text("role") in listOf("client","admin")
 if(user.text("role")!="admin")return false
 return if(feature.permission=="admin")user.optJSONArray("permissions").objectsOrStrings().isNotEmpty()else user.permission(feature.permission)
}
private fun JSONArray?.objectsOrStrings()=if(this==null)emptyList()else(0 until length()).map{optString(it)}.filter{it.isNotBlank()}
internal fun trustedPartnerPage(url:String?):Boolean=try{
 val uri=URI(url?:"")
 val path=uri.rawPath.orEmpty()
 uri.scheme=="https"&&(uri.port==-1||uri.port==443)&&uri.userInfo==null&&path.startsWith("/")&&!path.contains("..")&&!path.contains('%')&&
  (uri.host=="zzws-1z2.pages.dev"||uri.host=="patverparts-bot.github.io"&&path.startsWith("/ZZWS/"))
}catch(_:Exception){false}
// Legacy URLs remain narrowly pinned for an intentional transition; all new
// bootstrap/external/facts URLs use the canonical Cloudflare origin.
internal fun partnerPagePath(url:String?):String?=try{
 if(!trustedPartnerPage(url))null else URI(url).let{if(it.host=="patverparts-bot.github.io")it.path.removePrefix("/ZZWS")else it.path}
}catch(_:Exception){null}
internal fun partnerAdminPage(url:String?):Boolean=partnerPagePath(url)?.let{it=="/admin"||it.startsWith("/admin/")}?:false
internal fun partnerBundledAsset(url:String?):String?=when(partnerPagePath(url)){
 "/js/dealer-tools.js"->"dealer-tools.js"
 "/js/bundle-policy.js"->"bundle-policy.js"
 else->null
}
internal fun trustedPartnerBlob(url:String):Boolean=try{
 if(!url.startsWith("blob:"))false else URI(url.removePrefix("blob:")).let{
  it.scheme=="https"&&(it.port==-1||it.port==443)&&it.userInfo==null&&it.host in listOf("zzws-1z2.pages.dev","patverparts-bot.github.io")&&it.path.startsWith("/")
 }
}catch(_:Exception){false}
// Only the documented share action; it never selects a personal recipient.
internal fun viberShareLink(url:String):Boolean=try{
 if(url.length>25000)false else{
  val uri=URI(url)
  val query=uri.rawQuery.orEmpty()
  val exact=query.startsWith("text=")&&!query.contains('&')
  val encoded=if(exact)query.substring(5)else ""
  val alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.!~*'()-%"
  val text=java.net.URLDecoder.decode(encoded,"UTF-8")
  uri.scheme=="viber"&&uri.host=="forward"&&uri.userInfo==null&&uri.port==-1&&uri.rawPath.orEmpty().isEmpty()&&uri.rawFragment==null&&exact&&encoded.all{it in alphabet}&&text.isNotBlank()&&text.length<=2000&&text.none{(it<' '&&it!='\n'&&it!='\r'&&it!='\t')||it=='\u007f'}
 }
}catch(_:Exception){false}
internal fun selectedCart(cart:Map<String,Int>,selection:Map<String,Boolean>)=cart.filter{(code,qty)->qty in 1..9999&&selection[code]!=false}
internal fun favoriteList(value:JSONArray?):Set<String> = if(value==null)emptySet()else (0 until value.length()).map{value.optString(it)}.filter{it.isNotBlank()&&it.length<=100}.toSet()
internal fun favoriteChange(remote:Set<String>,code:String,wanted:Boolean):Set<String>{
 require(code.isNotBlank()&&code.length<=100)
 return if(wanted)remote+code else remote-code
}
internal fun orderHistoryPath(search:String,from:String,to:String,before:Long?=null):String{
 require(search.length<=100)
 for(date in listOf(from,to))if(date.isNotBlank())java.time.LocalDate.parse(date)
 require(from.isBlank()||to.isBlank()||from<=to){"Սկզբի ամսաթիվը պետք է լինի ավարտից առաջ։"}
 val params=linkedMapOf<String,String>()
 if(search.isNotBlank())params["search"]=search.trim()
 if(from.isNotBlank())params["from"]=from
 if(to.isNotBlank())params["to"]=to
 if(before!=null){require(before>0);params["before"]=before.toString()}
 return "orders"+if(params.isEmpty())""else"?"+params.entries.joinToString("&"){it.key+"="+java.net.URLEncoder.encode(it.value,"UTF-8")}
}
