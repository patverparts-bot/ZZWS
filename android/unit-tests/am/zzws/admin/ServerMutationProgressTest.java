package am.zzws.admin;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ServerMutationProgressTest {
 private static final class Server implements AutoCloseable {
  final ServerSocket listener=new ServerSocket(0,4,InetAddress.getByName("127.0.0.1"));
  final CountDownLatch arrived=new CountDownLatch(1),release=new CountDownLatch(1);
  final List<Integer> observed=new ArrayList<>();volatile Throwable failure;volatile int status=200;volatile String type="application/json",generationHeaders="";volatile byte[] body="{\"ok\":true}".getBytes(StandardCharsets.UTF_8);Thread worker;
  Server()throws Exception{}
  void start(){worker=new Thread(()->{while(!listener.isClosed())try(Socket socket=listener.accept()){
   InputStream input=socket.getInputStream();ByteArrayOutputStream headers=new ByteArrayOutputStream();int value,markers=0;while((value=input.read())!=-1){headers.write(value);markers=value==13||value==10?markers+1:0;if(markers==4)break;}
   int length=0;for(String line:headers.toString("UTF-8").split("\r\n"))if(line.toLowerCase(Locale.ROOT).startsWith("content-length:"))length=Integer.parseInt(line.split(":",2)[1].trim());for(int i=0;i<length;i++)if(input.read()<0)throw new EOFException();
   observed.add(ServerMutationProgress.getActiveRequests());arrived.countDown();if(!release.await(5,TimeUnit.SECONDS))throw new IOException("Fixture response was not released");
   OutputStream out=socket.getOutputStream();byte[] current=body;out.write(("HTTP/1.1 "+status+" Fixture\r\nContent-Length: "+current.length+"\r\nContent-Type: "+type+"\r\n"+generationHeaders+"Connection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));out.write(current);out.flush();
  }catch(Throwable error){if(!listener.isClosed())failure=error;}});worker.start();}
  public void close()throws Exception{release.countDown();listener.close();if(worker!=null)worker.join(2000);assertNull(failure);}
 }
 private ApiClient api(Server server)throws Exception{ApiClient api=new ApiClient();for(String name:new String[]{"base","key"}){Field field=ApiClient.class.getDeclaredField(name);field.setAccessible(true);field.set(api,name.equals("base")?"http://127.0.0.1:"+server.listener.getLocalPort()+"/functions/v1/zzws-api/":"public-key");}api.restoreToken("a".repeat(64));return api;}
 @Test public void concurrentTicketsRemainActiveUntilEveryActualRequestEnds(){
  assertEquals(0,ServerMutationProgress.getActiveRequests());Runnable bad=()->{throw new IllegalStateException("Fixture listener");};ServerMutationProgress.addListener(bad);
  long first=ServerMutationProgress.begin(),second=ServerMutationProgress.begin();try{assertEquals(2,ServerMutationProgress.getActiveRequests());ServerMutationProgress.finish(first);assertEquals(1,ServerMutationProgress.getActiveRequests());ServerMutationProgress.finish(first);assertEquals(1,ServerMutationProgress.getActiveRequests());}finally{ServerMutationProgress.finish(first);ServerMutationProgress.finish(second);ServerMutationProgress.removeListener(bad);}assertEquals(0,ServerMutationProgress.getActiveRequests());
 }
 @Test public void heldPostHasRealProgressWhileBackgroundGetDoesNotCreateAnUploadBar()throws Exception{
  ExecutorService executor=Executors.newSingleThreadExecutor();try(Server server=new Server()){server.start();ApiClient api=api(server);Future<JSONObject> request=executor.submit(()->api.call("POST","me/state",new JSONObject().put("section","cart")));assertTrue(server.arrived.await(5,TimeUnit.SECONDS));assertEquals(1,ServerMutationProgress.getActiveRequests());assertFalse(request.isDone());server.release.countDown();assertTrue(request.get(5,TimeUnit.SECONDS).getBoolean("ok"));assertEquals(0,ServerMutationProgress.getActiveRequests());api.call("GET","orders",null);assertEquals(Arrays.asList(1,0),server.observed);}finally{executor.shutdownNow();}
 }
 @Test public void rejectedMalformedAndBinaryResponsesAllReleaseTheirProgressTicket()throws Exception{
  try(Server server=new Server()){server.release.countDown();server.start();ApiClient api=api(server);server.status=500;server.body="{\"error\":\"Fixture failure\"}".getBytes(StandardCharsets.UTF_8);try{api.call("POST","orders",new JSONObject());fail();}catch(ApiClient.ApiError expected){assertEquals(500,expected.status);}assertEquals(0,ServerMutationProgress.getActiveRequests());
   server.status=200;server.body="not json".getBytes(StandardCharsets.UTF_8);try{api.call("POST","me/state",new JSONObject());fail();}catch(Exception expected){assertFalse(expected.getMessage().isBlank());}assertEquals(0,ServerMutationProgress.getActiveRequests());
   server.type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";server.body=new byte[]{80,75,3,4,1};assertArrayEquals(server.body,api.orderExport(new JSONObject()));assertEquals(0,ServerMutationProgress.getActiveRequests());assertEquals(Arrays.asList(1,1,1),server.observed);
  }
 }
 @Test public void bodylessPostAndDeleteAreStillMutationsAndReleaseOnFailure()throws Exception{
  try(Server server=new Server()){server.release.countDown();server.start();ApiClient api=api(server);assertTrue(api.call("POST","fixture-post",null).getBoolean("ok"));assertEquals(0,ServerMutationProgress.getActiveRequests());server.status=500;server.body="{\"error\":\"Fixture failure\"}".getBytes(StandardCharsets.UTF_8);try{api.call("DELETE","fixture-delete",null);fail();}catch(ApiClient.ApiError expected){assertEquals(500,expected.status);}assertEquals(0,ServerMutationProgress.getActiveRequests());assertEquals(Arrays.asList(1,1),server.observed);}
 }
 @Test public void olderGenerationCannotReturnStaleJsonOrWorkbookAfterAResetWasObserved()throws Exception{
  try(Server server=new Server()){server.release.countDown();server.start();ApiClient api=api(server);server.generationHeaders="X-ZZWS-Orders-Generation: 1\r\nX-ZZWS-Workspace-Generation: 1\r\n";api.call("GET","me",null);server.generationHeaders="X-ZZWS-Orders-Generation: 2\r\nX-ZZWS-Workspace-Generation: 1\r\n";api.call("GET","me",null);assertEquals(1,api.ordersRevision());assertEquals(0,api.workspaceRevision());server.generationHeaders="X-ZZWS-Orders-Generation: 1\r\nX-ZZWS-Workspace-Generation: 1\r\n";try{api.call("GET","orders",null);fail();}catch(ApiClient.ApiError expected){assertEquals(409,expected.status);}server.type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";server.body=new byte[]{80,75,3,4,1};try{api.orderExport(new JSONObject());fail();}catch(ApiClient.ApiError expected){assertEquals(409,expected.status);}assertEquals(0,ServerMutationProgress.getActiveRequests());assertEquals(1,api.ordersRevision());assertEquals(0,api.workspaceRevision());}
 }
}
