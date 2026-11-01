package am.zzws.admin
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class) @Config(sdk=[28],application=android.app.Application::class,qualifiers="w390dp-h900dp")
class CatalogWholesaleDialogRegressionTest {
 @get:Rule val ui=createAndroidComposeRule<ComponentActivity>()
 private val label="Միայն մեծածախ գին ունեցող ապրանքները"
 private val products=listOf(Product(JSONObject().put("articul","ws").put("wholesale",10).put("kpPrice",0)),Product(JSONObject().put("articul","kp").put("wholesale",0).put("kpPrice",99)),Product(JSONObject().put("articul","unpriced").put("wholesale",0).put("kpPrice",0)),Product(JSONObject().put("articul","kp-promo-only").put("wholesale",0).put("kpPrice",56).put("kpIsPromo",true)))
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppLanguage.initialize(c);AppLanguage.select(c,"hy")}
 @Test fun adminCanSelectAnyWholesalePriceAndPreviewCountMatchesAppliedDraft(){
  var applied:CatalogFilters?=null
  ui.setContent{RetailTheme{CatalogFiltersDialog(products,"",CatalogFilters(),onApply={applied=it},onDismiss={},allowWholesale=true)}}
  ui.onNodeWithText(label).assertExists().performClick();ui.onNodeWithText("Ցույց տալ՝ 3 ապրանք").performClick();ui.runOnIdle{assertTrue(applied!!.onlyWholesale);assertEquals(1,applied!!.activeCount)}
 }
 @Test fun clientHasNoWsToggleAndCannotApplyAnInjectedAdminFilter(){
  var applied:CatalogFilters?=null
  ui.setContent{RetailTheme{CatalogFiltersDialog(products,"",CatalogFilters(onlyWholesale=true),onApply={applied=it},onDismiss={},allowWholesale=false)}}
  ui.onNodeWithText(label).assertDoesNotExist();ui.onNodeWithText("Ցույց տալ՝ 4 ապրանք").performClick();ui.runOnIdle{assertFalse(applied!!.onlyWholesale)}
 }
}
