package am.zzws.admin;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Reconciles only the download previously requested by this application's user. */
public final class UserUpdateDownloadReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction()))return;
  long id=intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1);
  if(!UserUpdateDownload.owns(context,id))return;
  PendingResult pending=goAsync();UserUpdateDownload.complete(context.getApplicationContext(),id,pending::finish);
 }
}
