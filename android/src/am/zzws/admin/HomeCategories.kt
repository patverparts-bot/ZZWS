package am.zzws.admin

import java.util.Locale

internal data class MajorHomeCategory(val id:String,val title:String,val icon:String)
internal val majorHomeCategories=listOf(
 MajorHomeCategory("tv","Հեռուստացույցներ","tv"),
 MajorHomeCategory("washer","Լվացքի մեքենաներ","appliance"),
 MajorHomeCategory("dishwasher","Սպասք լվացող մեքենաներ","appliance"),
 MajorHomeCategory("hob","Եփման վահանակներ","kitchen"),
 MajorHomeCategory("oven","Ջեռոցներ","kitchen"),
 MajorHomeCategory("fridge","Սառնարաններ","appliance")
)
internal fun majorHomeCategoryId(category:String):String?{
 val value=category.lowercase(Locale.ROOT)
 val department=catalogDepartmentId(category)
 if(department in listOf("tv","washer","dishwasher","fridge"))return department
 val builtIn=value.contains("ներկառուց")||value.contains("built-in")||value.contains("built in")||value.contains("встраива")
 if(builtIn&&department=="hob")return "hob"
 if(builtIn&&department=="oven"&&!value.contains("միկրո")&&!value.contains("microwave")&&!value.contains("микроволн")&&!value.contains("ճարպաջեռոց"))return "oven"
 return null
}
internal data class MajorHomeGroup(val category:MajorHomeCategory,val count:Int,val categories:List<String>)
internal fun majorHomeGroups(products:List<Product>):List<MajorHomeGroup> = majorHomeCategories.map{category->
 val rows=products.filter{majorHomeCategoryId(it.category)==category.id}
 MajorHomeGroup(category,rows.size,rows.map{it.category}.distinct())
}
internal fun majorHomeSelectionTitle(categories:List<String>):String?{
 if(categories.isEmpty())return null
 val ids=categories.map{majorHomeCategoryId(it)}.distinct()
 return if(ids.size==1&&ids[0]!=null)majorHomeCategories.find{it.id==ids[0]}?.title else null
}
internal fun productAvailabilityLabel(product:Product)=product.stock.ifBlank{if(product.available)"Առկա է"else"Ճշտել"}
