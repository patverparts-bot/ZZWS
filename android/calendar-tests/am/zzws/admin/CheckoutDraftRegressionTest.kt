package am.zzws.admin

import android.os.Looper
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],application=android.app.Application::class)
class CheckoutDraftRegressionTest {
 @Before fun setup(){val c=RuntimeEnvironment.getApplication();AppContext.value=c;AppSession.initialize(c);AppSession.user=null;AppSession.api.clear();AppLanguage.initialize(c)}
 private fun ready(model:UnifiedModel){val deadline=System.nanoTime()+10_000_000_000L;while(model.busy&&System.nanoTime()<deadline){shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(20));Thread.sleep(5)};shadowOf(Looper.getMainLooper()).idle();assertFalse("Model request did not complete",model.busy)}
 private fun model(backend:TrialDemoBackend):UnifiedModel{val model=UnifiedModel(backend);ready(model);model.enterDemo();return model}
 private fun remote(backend:TrialDemoBackend)=backend.call("me/state",null)
 @Test fun checkoutFieldsSurviveModelRecreationAndStaySeparateFromCart(){
  val backend=TrialDemoBackend(sample=emptyList());val first=model(backend)
  first.updateDelivery(method="Ինքնաառաքում",address="Saved address",contact="Saved recipient",date="2027-02-03",comment="Русский · հայերեն\nSecond line")
  first.saveCheckoutDraft();ready(first)
  backend.call("me/state",JSONObject().put("section","cart").put("version",0).put("value",JSONObject().put("0001",JSONObject().put("qty",3))))
  val recreated=model(backend);recreated.reloadCheckoutDraft();ready(recreated)
  assertEquals("Ինքնաառաքում",recreated.method);assertEquals("Saved address",recreated.address);assertEquals("Saved recipient",recreated.contact);assertEquals("2027-02-03",recreated.date);assertEquals("Русский · հայերեն\nSecond line",recreated.comment)
  assertEquals(3,remote(backend).getJSONObject("data").getJSONObject("cart").getJSONObject("0001").getInt("qty"));assertFalse(recreated.draftConflict)
 }
 @Test fun concurrentWebsiteEditDoesNotSilentlyOverwriteEitherDraft(){
  val backend=TrialDemoBackend(sample=emptyList());val model=model(backend)
  val website=CheckoutDraft("demo-delivery","Առաքում","Website address","Website recipient","2027-01-02","Website draft").json()
  backend.call("me/state",JSONObject().put("section","draft").put("version",0).put("value",website))
  model.updateDelivery(comment="Unsynchronized phone draft");model.saveCheckoutDraft();ready(model)
  assertTrue(model.draftConflict);assertEquals("Unsynchronized phone draft",model.comment);assertTrue(sameCheckoutDraft(website,remote(backend).getJSONObject("data").getJSONObject("draft")))
  model.keepCheckoutDraft();ready(model)
  assertFalse(model.draftConflict);assertEquals("Unsynchronized phone draft",remote(backend).getJSONObject("data").getJSONObject("draft").getString("orderCommentInput"));assertEquals(2,remote(backend).getJSONObject("versions").getInt("draft"))
 }
 @Test fun explicitWebsiteReloadResolvesConflictAndEmptyFieldsRemainEmpty(){
  val backend=TrialDemoBackend(sample=emptyList());val model=model(backend)
  val website=CheckoutDraft("demo-delivery","Ինքնաառաքում","","","","").json()
  backend.call("me/state",JSONObject().put("section","draft").put("version",0).put("value",website))
  model.updateDelivery(comment="Phone draft");model.saveCheckoutDraft();ready(model);assertTrue(model.draftConflict)
  model.reloadCheckoutDraft();ready(model)
  assertFalse(model.draftConflict);assertEquals("",model.comment);assertEquals("",model.date);assertEquals("",model.contact);assertEquals("",model.address);assertEquals("Ինքնաառաքում",model.method)
 }
}
