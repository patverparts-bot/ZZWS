package am.zzws.admin

/** Parent destinations are explicit; Back never signs a user out. */
internal fun mainBackDestination(screen:String)=when(screen){
 "management","notifications"->"profile"
 "order"->"orders"
 else->"home"
}
internal fun managerBackDestination(screen:String)=when(screen){
 "status","history"->"detail"
 "orders","login"->"parent"
 else->"orders"
}
