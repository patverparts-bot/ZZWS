package am.zzws.admin

import java.util.Locale

internal data class CatalogDepartment(val id:String,val title:String,val icon:String,val pattern:Regex)
private fun department(id:String,title:String,icon:String,pattern:String)=CatalogDepartment(id,title,icon,Regex(pattern,RegexOption.IGNORE_CASE))
internal val catalogDepartments=listOf(
 department("tv","Հեռուստացույցներ","tv","^հեռուստացույց(?:\\s|$)|television|^tv(?:\\s|$)|телевизор"),
 department("fridge","Սառնարաններ և սառցարաններ","appliance","սառնարան|սառցարան|սառցախցիկ|refrigerat|fridge|freezer|холодиль|морозиль"),
 department("washer","Լվացքի մեքենաներ","appliance","լվացքի մեքենա|washing machine|\\bwashers?\\b|стиральн"),
 department("dishwasher","Սպասք լվացող մեքենաներ","appliance","սպասք.*լվացող|dishwash|посудомо"),
 department("dryer","Չորանոցներ","appliance","չորանոց|չորացնող մեքենա|tumble dryer|drying machine|сушильн"),
 department("oven","Ջեռոցներ և միկրոալիքային վառարաններ","kitchen","վառարան|ջեռոց|microwave|\\boven|духов|микроволн"),
 department("hob","Սալօջախներ և եփման վահանակներ","kitchen","գազօջախ|սալօջախ|եփման վահանակ|եփման մակերես|cooktop|\\bhobs?\\b|варочн"),
 department("hood","Օդաքաշներ","kitchen","օդաքարշ|օդաքաշ|քարշիչ|cooker hood|kitchen hood|вытяж"),
 department("vacuum","Փոշեկուլներ և մաքրում","appliance","փոշեկուլ|մաքրող սարք|մաքրող միջոց|պատուհան մաքրող|լվացող սարք|vacuum|пылесос"),
 department("climate","Կլիմատիկ տեխնիկա","appliance","օդորակ|տաքացուցիչ|օդը մաքր|օդը խոնավ|հովհար|ջրատաք|ջրի տաքացում|air condition|air purif|humidif|heater|кондицион|обогрев"),
 department("phone","Հեռախոսներ և պլանշետներ","phone","սմարթֆոն|հեռախոս|էլեկտրոնային գրքերի|պլանշետ|smartphone|tablet|телефон|планшет"),
 department("computer","Համակարգիչներ և նոթբուքներ","laptop","համակարգ|մոնոբլոկ|usb կրիչ|ցանցային|երթուղիչ|անխափան սնուց|նոթբուք|մոնիտոր|ստեղնաշար|մկնիկ|տպիչ|պրինտեր|սկաներ|հիշող|կոշտ սկավառակ|computer|laptop|notebook|monitor|printer|компьют|ноутбук"),
 department("audio","Աուդիո և ականջակալներ","audio","բարձրախոս|ականջակալ|սաունդ|աուդիո|նվագարկիչ|հզորացուցիչ|ուժեղացուցիչ|խոսափող|av ընդունիչ|միկրոֆոն|ռադիո|speaker|headphone|soundbar|audio|акустик|наушник"),
 department("photo","Ֆոտո և վիդեո","appliance","ֆոտո|տեսախցիկ|ոսպնյակ|եռոտանի|դրոն|պրոյեկտոր|camera|projector|фото|камер"),
 department("gaming","Խաղեր և ժամանց","catalog","խաղ|playstation|xbox|gaming|игров"),
 department("care","Խնամք և առողջություն","person","վարս|մազ|սափր|արդուկ.*մազ|ատամ|մերս|կշեռք|ճնշման չափ|ֆիթնես|էպիլ|սանր|շեյվեր|hair|shav|beauty|бритв|массаж"),
 department("kitchen","Խոհանոցային տեխնիկա","kitchen","սրճ|սուրճ|թեյնիկ|թոսթեր|սենդվիչ|վաֆլի|մանրացնող|պաղպաղակ պատրաստող|հաց պատրաստող|ջերմանոթ|ջրի դիսպենսեր|վակումային|շերտահատիչ|աղաց|տոստ|բլենդ|հարիչ|կոմբայն|մսաղաց|գրիլ|ճարպաջեռոց|բազմաեփ|գոլորշեփ|հյութ|թխող|էլեկտրական.*դանակ|coffee|kettle|blender|toaster|кофе|чайник"),
 department("home","Տան և խոհանոցի պարագաներ","home","ափսե|աման|թավա|կաթսա|բաժակ|դանակ|ծաղկաման|ժամացույց|թերմոս|սեղան|տան |սննդի|խոհանոց|գդալ|պատառաքաղ|շերեփ|արդուկ|լամպ|սենսոր|խելացի|տարա|կափարիչ|կաղապար|գինու|գոլորշիչ|գոլոշիչ|գոլորշու գեներատոր|գրաֆին|թիակ|տարրաներ|մոմակալ|վահանակ|խցան|բացիչ|լապտեր|քերիչ|տակդիր|լարեր|լուսավոր|անջատիչ|համեմունք|սկուտեղ|հավաքածու|սփռոց|գործիք|քամիչ|մաղեր|սնուց|աղբարկղ|տախտակ|դեկոր|tea|clock|cookware"),
 department("accessories","Աքսեսուարներ և մալուխներ","catalog","պարագա|աքսեսուար|մալուխ|կախիչ|հեռակառավարման|ալեհավաք|ադապտեր|թաղանթ|ժապավեն|հենակ|պատյան|լիցքավորիչ|մարտկոց|accessor|adapter|cable|аксессуар|кабел"),
 department("other","Այլ ապրանքներ","catalog",".*")
)
private val accessoryCategory=Regex("պարագա|աքսեսուար|մալուխ|կախիչ|հեռակառավարման|ալեհավաք|ադապտեր|accessor|adapter|cable|аксессуар|кабел",RegexOption.IGNORE_CASE)
internal fun catalogDepartmentId(category:String):String{
 if(accessoryCategory.containsMatchIn(category))return "accessories"
 return catalogDepartments.first{it.pattern.containsMatchIn(category.trim().lowercase(Locale.ROOT))}.id
}
internal data class DepartmentCount(val department:CatalogDepartment,val count:Int)
internal fun catalogDepartmentCounts(products:List<Product>):List<DepartmentCount>{
 val counts=products.groupingBy{it.department}.eachCount()
 return catalogDepartments.mapNotNull{department->counts[department.id]?.let{DepartmentCount(department,it)}}
}
