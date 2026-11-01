package am.zzws.admin

import android.content.Context
import org.json.JSONObject

/** Either current WS or KP price qualifies, independently of the displayed mode. */
internal fun wholesalePricedProducts(products:List<Product>,enabled:Boolean,isAdmin:Boolean)=
 if(enabled&&isAdmin)products.filter{it.price.isFinite()&&it.price>0.0||it.kp.isFinite()&&it.kp>0.0}else products

internal object CatalogWholesalePreference {
 private fun key(endpoint:String,user:JSONObject)=endpoint+"|"+user.text("id")
 fun read(context:Context,endpoint:String,user:JSONObject?):Boolean {
  if(user?.text("role")!="admin"||user.text("id").isBlank())return false
  return context.getSharedPreferences("zzws_catalog_preferences",Context.MODE_PRIVATE).getBoolean(key(endpoint,user),false)
 }
 fun save(context:Context,endpoint:String,user:JSONObject?,value:Boolean):Boolean {
  if(user?.text("role")!="admin"||user.text("id").isBlank())return false
  context.getSharedPreferences("zzws_catalog_preferences",Context.MODE_PRIVATE).edit().putBoolean(key(endpoint,user),value).apply()
  return value
 }
}
