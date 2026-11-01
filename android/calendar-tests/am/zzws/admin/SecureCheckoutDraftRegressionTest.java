package am.zzws.admin;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28)
public class SecureCheckoutDraftRegressionTest {
 private final SecretKeySpec key=new SecretKeySpec(new byte[32],"AES");
 @Test public void pendingDraftIsEncryptedAndBoundToEndpointAndAccount()throws Exception{
  String api="https://example.invalid/functions/v1/zzws-api/";
  JSONObject draft=new JSONObject().put("version",7).put("value",new JSONObject().put("orderCommentInput","Private · հայերեն"));
  String ciphertext=SecureCheckoutDraft.encrypt(api,"account-a",draft,key);
  assertFalse(ciphertext.contains("Private"));assertEquals(draft.toString(),SecureCheckoutDraft.decrypt(api,"account-a",ciphertext,key).toString());
  for(String[] identity:new String[][]{{api,"account-b"},{"https://other.invalid/functions/v1/zzws-api/","account-a"}}){try{SecureCheckoutDraft.decrypt(identity[0],identity[1],ciphertext,key);fail("Draft crossed its account/API boundary");}catch(Exception expected){}}
  String second=SecureCheckoutDraft.encrypt(api,"account-a",draft,key);assertNotEquals(ciphertext,second);
 }
 @Test public void tamperedOrMalformedJournalCannotBecomeAnEmptySuccessfulDraft()throws Exception{
  for(String invalid:new String[]{"",":","not:base64","a:b:c"}){try{SecureCheckoutDraft.decrypt("api","owner",invalid,key);fail("Malformed encrypted draft accepted");}catch(Exception expected){}}
 }
}
