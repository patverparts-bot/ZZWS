package am.zzws.admin;

import java.math.BigInteger;

/** Endpoint/session-scoped monotonic server generations. No user data is stored. */
final class ServerDataGenerations {
 private BigInteger orders,workspace;
 private long orderRevision,workspaceRevision;
 private static BigInteger number(String value){if(value==null||!value.matches("[1-9][0-9]{0,18}"))return null;BigInteger parsed=new BigInteger(value);return parsed.compareTo(BigInteger.valueOf(Long.MAX_VALUE))<=0?parsed:null;}
 synchronized boolean observe(String orderHeader,String workspaceHeader){
  BigInteger nextOrders=number(orderHeader),nextWorkspace=number(workspaceHeader);
  if(orderHeader!=null&&nextOrders==null||workspaceHeader!=null&&nextWorkspace==null)return false;
  // A late response must never restore a dataset from before an observed reset.
  if(nextOrders!=null&&orders!=null&&nextOrders.compareTo(orders)<0||nextWorkspace!=null&&workspace!=null&&nextWorkspace.compareTo(workspace)<0)return false;
  if(nextOrders!=null){if(orders!=null&&nextOrders.compareTo(orders)>0)orderRevision++;orders=nextOrders;}
  if(nextWorkspace!=null){if(workspace!=null&&nextWorkspace.compareTo(workspace)>0)workspaceRevision++;workspace=nextWorkspace;}
  return true;
 }
 synchronized void clear(){orders=null;workspace=null;orderRevision=0;workspaceRevision=0;}
 synchronized long ordersRevision(){return orderRevision;}
 synchronized long workspaceRevision(){return workspaceRevision;}
 synchronized String workspaceGeneration(){return workspace==null?"":workspace.toString();}
 static boolean pendingOrderMatchesWorkspace(String stamp,String current,long clearedCart){return stamp!=null&&!stamp.isEmpty()?current==null||current.isEmpty()||stamp.equals(current):clearedCart==0;}
 static boolean journalWasCleared(long localVersion,long clearedVersion){return clearedVersion>localVersion;}
 static boolean checkoutDraftMatchesWorkspace(String stamp,String current,long localVersion,long clearedVersion){
  if(stamp!=null&&!stamp.isEmpty()&&current!=null&&!current.isEmpty()&&!stamp.equals(current))return false;
  // Legacy journals have no epoch. Preserve the established version fence;
  // do not infer that unrelated order-only maintenance deleted a local draft.
  return !journalWasCleared(localVersion,clearedVersion);
 }
}
