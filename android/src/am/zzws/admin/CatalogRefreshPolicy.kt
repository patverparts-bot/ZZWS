package am.zzws.admin

internal const val CATALOG_CHECK_INTERVAL_MS=60_000L
internal const val CATALOG_FULL_REFRESH_INTERVAL_MS=5*60_000L
internal fun catalogNeedsRefresh(currentVersion:String,remoteVersion:String,lastLoaded:Long,now:Long):Boolean{
 if(remoteVersion.isBlank())return false
 return currentVersion!=remoteVersion||lastLoaded<=0||now<lastLoaded||now-lastLoaded>=CATALOG_FULL_REFRESH_INTERVAL_MS
}
