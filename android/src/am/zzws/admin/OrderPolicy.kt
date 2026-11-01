package am.zzws.admin

import org.json.JSONObject

/** Company primary may service existing employee orders, without changing author/session. */
internal fun clientCanActOnOrder(user:JSONObject?,order:JSONObject):Boolean {
 if(user?.text("role")!="client"||user.text("id").isBlank())return false
 val who=user.text("id");val author=order.text("user_id")
 if(author.isBlank())return false
 return author==who||(user.text("clientRole")=="manager"&&order.text("customer_id")==who)
}
internal fun clientActsForOrderAuthor(user:JSONObject?,order:JSONObject)=clientCanActOnOrder(user,order)&&order.text("user_id")!=user?.text("id")
internal const val COMPANY_ORDER_ACTION_CAPTION="Դուք պատասխանում եք աշխատակցի պատվերի համար՝ որպես ընկերության գլխավոր օգտատեր։"

internal fun canConfirmReceipt(order:JSONObject)=order.optJSONObject("approval")?.text("state")!="pending"&&order.text("received_at").isBlank()&&order.text("status") in listOf("confirmed","in_progress","completed")
internal fun canEditOrderStatus(order:JSONObject)=order.optJSONObject("approval")?.text("state")!="pending"&&order.text("received_at").isBlank()&&order.text("status") !in listOf("received","completed","rejected")
internal data class OrderLineView(val code:String,val name:String,val originalQty:Int?,val qty:Int,val originalPrice:Double?,val price:Double){
 val removed get()=qty==0
}
internal fun orderLineViews(order:JSONObject):List<OrderLineView>{
 val current=order.optJSONArray("lines").objects().associateBy{it.text("articul")}
 val original=order.optJSONArray("original_lines").objects()
 val all=(original.map{it.text("articul")}+current.keys).distinct()
 return all.map{code->val before=original.find{it.text("articul")==code};val now=current[code];OrderLineView(code,(now?:before)?.text("name")?:code,before?.optInt("qty"),now?.optInt("qty")?:0,before?.optDouble("unitPrice"),now?.optDouble("unitPrice")?:before?.optDouble("unitPrice")?:0.0)}
}
internal fun cartMemory(cart:Map<String,Int>,products:List<Product>,mode:String):JSONObject=JSONObject().also{out->cart.forEach{(code,qty)->out.put(code,JSONObject().put("articul",code).put("qty",qty).put("addedPrice",products.find{it.code==code}?.price?:0).put("addedPriceMode",mode))}}
internal fun memoryQuantities(value:JSONObject?):Map<String,Int> = value?.keys()?.asSequence()?.mapNotNull{key->val qty=value.optJSONObject(key)?.optInt("qty")?:0;if(qty in 1..1000000)key to qty else null}?.toMap()?:emptyMap()
