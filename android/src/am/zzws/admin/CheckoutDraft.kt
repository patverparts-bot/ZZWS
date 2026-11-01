package am.zzws.admin

import org.json.JSONObject

/** Uses the same six field names as the website's versioned `draft` section. */
internal data class CheckoutDraft(val deliveryId:String,val method:String,val address:String,val contact:String,val date:String,val comment:String) {
 fun json()=JSONObject().put("organizationSelect",deliveryId).put("deliveryMethodInput",method).put("deliveryAddressInput",address).put("contactPersonInput",contact).put("deliveryDateInput",date).put("orderCommentInput",comment)
}
internal data class RestoredCheckoutDraft(val index:Int,val value:CheckoutDraft)
internal fun restoreCheckoutDraft(value:JSONObject?,rows:List<JSONObject>):RestoredCheckoutDraft {
 val id=if(value?.has("organizationSelect")==true)value.text("organizationSelect")else rows.firstOrNull()?.text("id").orEmpty()
 val index=rows.indexOfFirst{it.text("id")==id&&id.isNotEmpty()};val row=rows.getOrNull(index)
 fun field(name:String,fallback:String="")=if(value?.has(name)==true)value.text(name).take(3000)else fallback
 val method=field("deliveryMethodInput","Առաքում").takeIf{it in listOf("Առաքում","Ինքնաառաքում")}?:"Առաքում"
 return RestoredCheckoutDraft(index,CheckoutDraft(if(index>=0)id else "",method,field("deliveryAddressInput",row?.text("address").orEmpty()),field("contactPersonInput",row?.text("contact").orEmpty()),field("deliveryDateInput"),field("orderCommentInput")))
}
internal fun sameCheckoutDraft(a:JSONObject?,b:JSONObject?):Boolean {
 val names=listOf("organizationSelect","deliveryMethodInput","deliveryAddressInput","contactPersonInput","deliveryDateInput","orderCommentInput")
 return names.all{a?.has(it)==b?.has(it)&&a?.text(it)==b?.text(it)}
}
