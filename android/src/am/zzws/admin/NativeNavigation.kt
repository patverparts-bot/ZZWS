package am.zzws.admin

import android.app.Activity
import android.content.Context
import android.content.Intent
import org.json.JSONObject

internal enum class OrdersDestination { NONE,PERSONAL,NATIVE,WEB }
internal fun ordersDestination(user:JSONObject?):OrdersDestination {
 if(user==null||user.optBoolean("needsPasswordSetup")||user.optBoolean("needsProfileSetup")||user.has("active")&&!user.optBoolean("active"))return OrdersDestination.NONE
 return when(user.text("role")){
  "client"->OrdersDestination.PERSONAL
  "admin"->if(!user.permission("orders:read"))OrdersDestination.NONE else if(user.optBoolean("mobileAdminEnabled"))OrdersDestination.NATIVE else OrdersDestination.WEB
  else->OrdersDestination.NONE
 }
}
internal fun ordersLabel(user:JSONObject?)=if(user?.text("role")=="admin")"Պատվերների կառավարում"else"Իմ պատվերները"
internal fun validOrderStatus(status:String)=status in listOf("new","confirmed","in_progress","completed","rejected","received")
internal fun orderManagementIntent(context:Context,user:JSONObject?,status:String=""):Intent?=when(ordersDestination(user)){
 OrdersDestination.NATIVE->Intent(context,MainActivity::class.java).also{if(validOrderStatus(status))it.putExtra("zzws_status",status)}
 OrdersDestination.WEB->Intent(context,PartnerWebActivity::class.java).putExtra("feature",PartnerFeature.ORDERS.name).also{if(validOrderStatus(status))it.putExtra("zzws_status",status)}
 else->null
}
internal fun returnHomeIntent(context:Context)=Intent(context,UnifiedActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("zzws_home",true)
internal fun returnToNativeHome(activity:Activity){activity.startActivity(returnHomeIntent(activity));activity.finish()}
