package am.zzws.admin
import org.json.JSONObject
internal fun canSelectCustomer(user:JSONObject?)=user?.text("role")=="admin"&&user.optBoolean("mobileAdminEnabled")&&user.permission("orders:write")
internal fun customerChoices(customers:List<JSONObject>,search:String):List<JSONObject>{val query=search.trim();return customers.filter{query.isEmpty()||it.text("client").contains(query,true)||it.text("customerCode").contains(query,true)}}
