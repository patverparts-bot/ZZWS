package am.zzws.admin;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Field;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
public class OrderExportTransportTest {
 private static final String TOKEN=new String(new char[64]).replace('\0','a');
 private static final class Server implements AutoCloseable {
  final ServerSocket listener=new ServerSocket(0,2,InetAddress.getByName("127.0.0.1"));
  volatile String request="";volatile int requests;volatile Throwable failure;int status=200;byte[] body={80,75,3,4,1};String extra="";Runnable beforeSend=()->{};Thread worker;
  Server()throws Exception{}
  void start(){worker=new Thread(()->{while(!listener.isClosed())try(Socket socket=listener.accept()){
   InputStream in=socket.getInputStream();ByteArrayOutputStream raw=new ByteArrayOutputStream();int b,markers=0;while((b=in.read())!=-1){raw.write(b);markers=b==13||b==10?markers+1:0;if(markers==4)break;if(raw.size()>16000)throw new IOException();}
   String headers=raw.toString("UTF-8");int length=0;for(String line:headers.split("\r\n"))if(line.toLowerCase(java.util.Locale.ROOT).startsWith("content-length:"))length=Integer.parseInt(line.split(":",2)[1].trim());for(int n=0;n<length;n++){b=in.read();if(b<0)throw new EOFException();raw.write(b);}request=raw.toString("UTF-8");requests++;beforeSend.run();
   OutputStream out=socket.getOutputStream();out.write(("HTTP/1.1 "+status+" Test\r\nContent-Length: "+body.length+"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\nConnection: close\r\n"+extra+"\r\n").getBytes(StandardCharsets.US_ASCII));out.write(body);out.flush();
  }catch(Throwable e){if(!listener.isClosed())failure=e;}});worker.start();}
  public void close()throws Exception{listener.close();if(worker!=null)worker.join(2000);assertNull(failure);}
 }
 private ApiClient api(Server server)throws Exception{ApiClient api=new ApiClient();for(String name:new String[]{"base","key"}){Field f=ApiClient.class.getDeclaredField(name);f.setAccessible(true);f.set(api,name.equals("base")?"http://127.0.0.1:"+server.listener.getLocalPort()+"/functions/v1/zzws-api/":"public-key");}api.restoreToken(TOKEN);return api;}
 @Test public void authenticatedBinaryUsesOnlyTheFixedOrderExportEndpoint()throws Exception{
  try(Server server=new Server()){server.start();assertArrayEquals(new byte[]{80,75,3,4,1},api(server).orderExport(new JSONObject().put("id","order-id")));assertTrue(server.request.startsWith("POST /functions/v1/zzws-api/orders/export "));assertTrue(server.request.contains("Authorization: Bearer "+TOKEN));assertTrue(server.request.contains("apikey: public-key"));assertTrue(server.request.contains("order-id"));}
 }
 @Test public void redirectsNeverForwardTheSessionOrBecomeAWorkbook()throws Exception{
  try(Server server=new Server()){server.status=302;server.extra="Location: /trap\r\n";server.start();try{api(server).orderExport(new JSONObject());fail();}catch(ApiClient.ApiError expected){assertEquals(302,expected.status);}assertEquals(1,server.requests);}
 }
 @Test public void aSessionChangeBeforeResponseDiscardsTheDownloadedData()throws Exception{
  try(Server server=new Server()){ApiClient api=api(server);server.beforeSend=api::clear;server.start();try{api.orderExport(new JSONObject());fail();}catch(ApiClient.ApiError expected){assertEquals(409,expected.status);}}
 }
}
