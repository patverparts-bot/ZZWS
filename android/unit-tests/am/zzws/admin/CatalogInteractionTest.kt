package am.zzws.admin
import org.junit.Test
import org.junit.Assert.*
class CatalogInteractionTest{
 @Test fun searchCollapsesOnDownScrollAndReturnsOnUpScroll(){assertFalse(catalogSearchVisible(CatalogPosition(0,0),CatalogPosition(0,80),true));assertFalse(catalogSearchVisible(CatalogPosition(0,80),CatalogPosition(1,0),true));assertTrue(catalogSearchVisible(CatalogPosition(4,120),CatalogPosition(4,30),false));assertTrue(catalogSearchVisible(CatalogPosition(4,0),CatalogPosition(3,100),false))}
 @Test fun searchIsVisibleAtTopAndStableOnSmallLayoutChanges(){assertTrue(catalogSearchVisible(CatalogPosition(1,0),CatalogPosition(0,0),false));assertTrue(catalogSearchVisible(CatalogPosition(2,50),CatalogPosition(2,54),true));assertFalse(catalogSearchVisible(CatalogPosition(2,50),CatalogPosition(2,48),false))}
 @Test fun typedQuantitiesPreserveCartLimitsAndAllowRemoval(){assertEquals(1,cardQuantity("1"));assertEquals(9999,cardQuantity("9999"));assertEquals(0,cardQuantity("0"));assertNull(cardQuantity(""));assertNull(cardQuantity("-1"));assertNull(cardQuantity("10000"));assertNull(cardQuantity("1.5"));assertNull(cardQuantity("abc"))}
}
