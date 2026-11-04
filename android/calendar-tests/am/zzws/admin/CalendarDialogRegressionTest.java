package am.zzws.admin;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.os.Looper;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import static org.robolectric.Shadows.shadowOf;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

/** Exercise the Android dialog itself, not a mock of its callbacks. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,application=android.app.Application.class)
@GraphicsMode(GraphicsMode.Mode.LEGACY)
public class CalendarDialogRegressionTest {
 private ActivityController<Activity> screen(){ActivityController<Activity> c=Robolectric.buildActivity(Activity.class);c.get().setTheme(android.R.style.Theme_Material_Light_NoActionBar);return c.setup().visible();}
 @Test public void translatingDialogPreservesActivityWindowManager(){
  try(ActivityController<Activity> c=screen()){
   for(String language:new String[]{"hy","ru"}){
    L10n.setLanguage(c.get(),language);Context localized=L10n.context(c.get());
    assertSame("Date dialogs need the current Activity's window service",c.get().getSystemService(Context.WINDOW_SERVICE),localized.getSystemService(Context.WINDOW_SERVICE));
    assertEquals(language,localized.getResources().getConfiguration().getLocales().get(0).getLanguage());
   }
  }
 }
 private void openAndSelect(String language){
  try(ActivityController<Activity> c=screen()){
   L10n.setLanguage(c.get(),language);AtomicReference<String> selected=new AtomicReference<>("unchanged");
   DatePickerDialog dialog=new DatePickerDialog(L10n.context(c.get()),(view,year,month,day)->selected.set(CheckoutPolicyKt.checkoutDate(year,month,day)),2026,9,31);
   dialog.show();assertTrue(dialog.isShowing());assertEquals("unchanged",selected.get());
   dialog.getDatePicker().updateDate(2028,1,29);dialog.getButton(DialogInterface.BUTTON_POSITIVE).performClick();shadowOf(Looper.getMainLooper()).idle();
   assertEquals("2028-02-29",selected.get());assertFalse(dialog.isShowing());
  }
 }
 @Test public void armenianDeliveryCalendarOpensAndConfirmsLeapDay(){openAndSelect("hy");}
 @Test public void russianDeliveryCalendarOpensAndConfirmsLeapDay(){openAndSelect("ru");}
 @Test public void calendarAlsoPreservesWindowThroughComposeStyleWrappers(){
  try(ActivityController<Activity> c=screen()){
   Context parent=new android.view.ContextThemeWrapper(new android.content.ContextWrapper(c.get()),android.R.style.Theme_Material_Light_NoActionBar);
   Context localized=L10n.context(parent);
   assertSame(c.get().getSystemService(Context.WINDOW_SERVICE),localized.getSystemService(Context.WINDOW_SERVICE));
   DatePickerDialog dialog=new DatePickerDialog(localized,(view,y,m,d)->{},2026,9,31);
   dialog.show();assertTrue(dialog.isShowing());dialog.dismiss();assertFalse(dialog.isShowing());
  }
 }
 @Test public void cancellingCalendarDoesNotChangeTheDeliveryDate(){
  try(ActivityController<Activity> c=screen()){
   AtomicReference<String> selected=new AtomicReference<>("2026-10-31");
   DatePickerDialog dialog=new DatePickerDialog(L10n.context(c.get()),(view,year,month,day)->selected.set("changed"),2026,9,31);
   dialog.show();dialog.getDatePicker().updateDate(2027,0,1);dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick();shadowOf(Looper.getMainLooper()).idle();
   assertEquals("2026-10-31",selected.get());assertFalse(dialog.isShowing());
  }
 }
}
