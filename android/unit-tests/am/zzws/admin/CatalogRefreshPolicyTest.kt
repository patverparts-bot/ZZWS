package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*

class CatalogRefreshPolicyTest {
 @Test fun changedPriceRulesOrControlsRefreshWithoutUserInteraction(){assertTrue(catalogNeedsRefresh("price1:rules1:controls1","price2:rules1:controls1",1000,2000));assertTrue(catalogNeedsRefresh("price1:rules1:controls1","price1:rules2:controls1",1000,2000))}
 @Test fun unchangedVersionDoesNotDownloadTheWholeCatalogueEveryMinute(){assertFalse(catalogNeedsRefresh("v1","v1",1000,61000));assertFalse(catalogNeedsRefresh("v1","v1",1000,300999))}
 @Test fun periodicFullRefreshAlsoCoversAccountAccessChanges(){assertTrue(catalogNeedsRefresh("v1","v1",1000,301000));assertTrue(catalogNeedsRefresh("v1","v1",1000,600000))}
 @Test fun missingVersionNeverReplacesAValidCatalogue(){assertFalse(catalogNeedsRefresh("v1","",1000,600000));assertTrue(catalogNeedsRefresh("","v1",0,2000));assertTrue(catalogNeedsRefresh("v1","v1",2000,1000))}
}
