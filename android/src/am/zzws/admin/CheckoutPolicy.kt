package am.zzws.admin

internal fun checkoutDate(year:Int,zeroBasedMonth:Int,day:Int)=java.time.LocalDate.of(year,zeroBasedMonth+1,day).toString()
internal fun validateCheckout(hasItems:Boolean,hasDelivery:Boolean,method:String,address:String,contact:String,date:String){
 require(hasItems){"Զամբյուղը դատարկ է"}
 require(hasDelivery){"Ընտրեք առաքման տարբերակը"}
 require(contact.isNotBlank()){ "Նշեք կոնտակտային անձին" }
 require(method!="Առաքում"||address.isNotBlank()){ "Նշեք առաքման հասցեն" }
 require(date.isNotBlank()){ "Ընտրեք ամսաթիվը օրացույցից" }
 require(runCatching{java.time.LocalDate.parse(date)}.isSuccess){"Կրկին ընտրեք ամսաթիվը օրացույցից"}
}
