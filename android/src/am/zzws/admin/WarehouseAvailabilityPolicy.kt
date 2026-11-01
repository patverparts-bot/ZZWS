package am.zzws.admin

/** Parse only an unambiguous server-provided warehouse list; never infer stock. */
internal data class WarehouseCount(val code:String,val quantity:String)
private val warehouseCountPattern=Regex("^\\s*([0-9]{1,8})\\s*:\\s*([+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+))\\s*$")
internal fun warehouseCounts(stock:String):List<WarehouseCount>? {
 if(stock.isBlank())return null
 val result=mutableListOf<WarehouseCount>()
 for(value in stock.split(',')){
  val match=warehouseCountPattern.matchEntire(value)?:return null
  result.add(WarehouseCount(match.groupValues[1],match.groupValues[2]))
 }
 return result
}
