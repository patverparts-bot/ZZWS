package am.zzws.admin

import kotlinx.coroutines.CancellationException
import org.json.JSONObject

internal const val RECEIPT_STATEMENT="Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։"
internal fun receiptRecorded(order:JSONObject)=order.text("received_at").isNotBlank()
internal fun clientCanConfirmReceipt(user:JSONObject?,order:JSONObject)=clientCanActOnOrder(user,order)&&canConfirmReceipt(order)

internal data class ReceiptConfirmation(val userId:String,val orderId:String,val number:Long,val revision:Int,val statement:String,val actingForAuthor:Boolean=false)
internal data class PreparedReceipt(val order:JSONObject,val confirmation:ReceiptConfirmation?,val needsReview:Boolean=false)
internal class ReceiptChanged(val current:JSONObject):Exception("Պատվերը փոխվել է։ Ստուգեք թարմացված կազմը և կրկին հաստատեք ստացումը։")
internal typealias ReceiptCall=suspend (String,JSONObject?)->JSONObject

private fun receiptOrder(response:JSONObject,id:String):JSONObject{
 val order=response.optJSONObject("order")?:response
 check(order.text("id")==id){"Սերվերը վերադարձրել է այլ պատվերի տվյալներ։ Թարմացրեք պատվերը։"}
 return order
}
private fun receiptClient(user:JSONObject?):String{
 check(user?.text("role")=="client"&&user.text("id").isNotBlank()){"Ստացումը հաստատում է պատվիրատու հաճախորդը։"}
 return user!!.text("id")
}

internal suspend fun prepareClientReceipt(user:JSONObject?,id:String,call:ReceiptCall,expectedRevision:Int?=null):PreparedReceipt{
 val who=receiptClient(user)
 check(id.matches(Regex("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"))){"Սխալ պատվերի համար։"}
 val current=receiptOrder(call("orders/detail",JSONObject().put("id",id)),id)
 check(clientCanActOnOrder(user,current)){"Սա ձեր պատվերը չէ։"}
 if(receiptRecorded(current))return PreparedReceipt(current,null)
 if(expectedRevision!=null&&current.optInt("revision")!=expectedRevision)return PreparedReceipt(current,null,needsReview=true)
 check(clientCanConfirmReceipt(user,current)){"Ստացումը հասանելի է միայն հաստատված, ընթացիկ կամ առաքված պատվերի համար։"}
 check(current.optInt("revision")>0&&current.optLong("number")>0){"Թարմացրեք պատվերի տվյալները։"}
 val state=call("orders/receipt-state",null)
 return PreparedReceipt(current,ReceiptConfirmation(who,id,current.optLong("number"),current.optInt("revision"),state.text("statement").ifBlank{RECEIPT_STATEMENT},clientActsForOrderAuthor(user,current)))
}

internal suspend fun submitClientReceipt(user:JSONObject?,target:ReceiptConfirmation,acknowledged:Boolean,call:ReceiptCall):JSONObject{
 check(receiptClient(user)==target.userId){"Աշխատաշրջանը փոխվել է։ Կրկին բացեք պատվերը։"}
 check(acknowledged){"Նշեք, որ ապրանքները ստացել եք ամբողջությամբ և անվնաս։"}
 check(target.revision>0){"Թարմացրեք պատվերի տվյալները։"}
 val payload=JSONObject().put("id",target.orderId).put("revision",target.revision).put("intact",true)
 val result=try{receiptOrder(call("orders/receipt",payload),target.orderId)}catch(error:Exception){
  if(error is CancellationException)throw error
  if(error is ApiClient.ApiError&&error.status in listOf(400,401,403,404))throw error
  // A missing response may follow a committed receipt. Re-read the same order;
  // never silently post again or acknowledge a newly edited revision.
  val current=try{receiptOrder(call("orders/detail",JSONObject().put("id",target.orderId)),target.orderId)}catch(cancel:CancellationException){throw cancel}catch(_:Exception){throw error}
  if(receiptRecorded(current))return current
  if(current.optInt("revision")!=target.revision||!canConfirmReceipt(current))throw ReceiptChanged(current)
  throw error
 }
 check(receiptRecorded(result)){"Ստացումը չի հաստատվել սերվերի կողմից։ Թարմացրեք պատվերը։"}
 return result
}
