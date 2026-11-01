package am.zzws.admin

import org.json.JSONObject

internal data class OrderOriginField(val label:String,val value:String,val primary:Boolean=false)

/** Display the immutable order snapshot, never the currently signed-in profile. */
internal fun orderOriginFields(order:JSONObject):List<OrderOriginField>{
 val customer=order.optJSONObject("customer")?:JSONObject()
 val author=customer.optJSONObject("author")?:JSONObject()
 val assisted=order.optJSONObject("created_by")
 val delivery=order.optJSONObject("delivery")?:JSONObject()
 fun name(person:JSONObject)=listOf(person.text("firstName").trim(),person.text("lastName").trim()).filter{it.isNotEmpty()}.joinToString(" ").ifBlank{person.text("name").trim()}.ifBlank{person.text("login").trim()}.ifBlank{person.text("label").trim()}
 return buildList{
  fun addField(label:String,value:String,primary:Boolean=false){if(value.isNotBlank())add(OrderOriginField(label,value.trim(),primary))}
  addField("Հաճախորդ՝",customer.text("client"),true)
  if(assisted!=null){
   val sender=name(assisted)
   if(sender.isNotBlank())addField("Հաճախորդի անունից լրացրել է՝",sender)
   else addField("","Պատվերը ձևակերպած անձի անունը չի պահպանվել։")
   if(assisted.text("login").trim()!=sender)addField("Լրացնողի մուտքանունը՝",assisted.text("login"))
   addField("Հաճախորդի կոնտակտ՝",name(author))
  }else{
   val sender=name(author)
   when{sender.isNotBlank()->addField("Ուղարկել է՝",sender)
    customer.text("login").isNotBlank()->addField("Ուղարկողի մուտքանունը՝",customer.text("login"))
    else->addField("","Ուղարկողի անունը չի պահպանվել։")}
  }
  addField("Հաճախորդի կոդ՝",customer.text("customerCode"))
  fun addActor(label:String,actor:JSONObject?){if(actor==null)return;addField(label,name(actor));if(actor.optBoolean("actingForAuthor"))addField("","Գործողությունը կատարել է ընկերության գլխավոր օգտատերը՝ աշխատակցի փոխարեն։")}
  addActor("Հաճախորդի պատասխանը գրանցել է՝",order.optJSONObject("approval")?.optJSONObject("response")?.optJSONObject("actor"))
  addActor("Դիտարկման ժամանակ է խնդրել՝",order.optJSONObject("approval")?.optJSONObject("deferredBy"))
  addActor("Ստացումը հաստատել է՝",order.optJSONObject("receipt")?.optJSONObject("actor"))
  addField("Կազմակերպություն՝",delivery.text("organization"))
  addField("Հեռախոս՝",author.text("phone"))
  addField("Էլ․ փոստ՝",author.text("email"))
  if(customer.text("client").isBlank()&&delivery.text("organization").isBlank())addField("","Հաճախորդի տվյալները չեն պահպանվել։")
 }
}
