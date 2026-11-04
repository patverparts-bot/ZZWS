package am.zzws.admin
private val articleParts=Regex("[0-9]+|[^0-9]+")
internal fun compareArticles(first:String,second:String):Int{
 val a=articleParts.findAll(first).map{it.value}.toList();val b=articleParts.findAll(second).map{it.value}.toList()
 for(i in 0 until minOf(a.size,b.size)){
  val left=a[i];val right=b[i];val leftNumber=left[0].isDigit();val rightNumber=right[0].isDigit()
  val compared=if(leftNumber&&rightNumber)left.toBigInteger().compareTo(right.toBigInteger()) else if(leftNumber!=rightNumber){if(leftNumber)-1 else 1}else left.compareTo(right,ignoreCase=true)
  if(compared!=0)return compared
 }
 val size=a.size.compareTo(b.size);return if(size!=0)size else first.compareTo(second)
}
internal fun nativePrice(product:Product,isAdmin:Boolean,mode:String,viewingBuyer:Boolean)=if(isAdmin&&!viewingBuyer&&mode=="KP")product.kp else product.price
internal fun canReloadCatalog(screen:String,pendingSubmission:Boolean)=screen!="cart"&&!pendingSubmission
internal fun visibleProducts(products:List<Product>,query:String,brands:Set<String>,categories:Set<String>,available:Boolean,promo:Boolean,sort:Int,price:(Product)->Double):List<Product>{
 return visibleProducts(products,query,brands,categories,available,promo,sort,price){it.promo}
}
internal fun visibleProducts(products:List<Product>,query:String,brands:Set<String>,categories:Set<String>,available:Boolean,promo:Boolean,sort:Int,price:(Product)->Double,isPromotion:(Product)->Boolean):List<Product>{
 val term=query.trim();val terms=if(term.contains(','))term.split(',').map{it.trim()}.filter{it.isNotBlank()} else if(term.split(Regex("\\s+")).all{token->token.matches(Regex("[0-9]+"))||products.any{it.code.equals(token,true)}})term.split(Regex("\\s+")) else listOf(term)
 val codes=products.map{it.code.lowercase()}.toSet();val articleTerms=terms.filter{it.matches(Regex("[0-9]+"))||it.lowercase() in codes}.toSet()
 val result=products.filter{p->(term.isBlank()||terms.any{token->if(token in articleTerms)p.code.equals(token,true) else listOf(p.name,p.brand,p.category).any{it.contains(token,true)||L10n.t(it,"ru").contains(token,true)}})&&(brands.isEmpty()||p.brand in brands)&&(categories.isEmpty()||p.category in categories)&&(!available||p.available)&&(!promo||isPromotion(p))}
 return when(sort){1->result.sortedBy(price);2->result.sortedByDescending(price);else->result.sortedWith{a,b->compareArticles(a.code,b.code)}}
}
internal fun brandChoices(products:List<Product>,categories:Set<String>,selected:Set<String> = emptySet())=(products.filter{categories.isEmpty()||it.category in categories}.map{it.brand}+selected).distinct().sorted()
internal fun categoryChoices(products:List<Product>,brands:Set<String>,selected:Set<String> = emptySet())=(products.filter{brands.isEmpty()||it.brand in brands}.map{it.category}+selected).distinct().sorted()
