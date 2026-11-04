param([switch]$Report,[string]$SiteUrl='https://zzws-1z2.pages.dev/',[string]$ApiUrl='https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/')
$ErrorActionPreference='Stop'
if($Report -and (([uri]$ApiUrl).Host -ne 'xufxevjdfukglplsknrp.supabase.co' -or ([uri]$ApiUrl).Scheme -ne 'https')){throw 'Reports may only be sent to the configured ZZWS project over HTTPS'}
$opsRoot=Split-Path -Parent $PSScriptRoot
$opsChecks=[Collections.Generic.List[object]]::new()
function Add-OpsCheck([string]$Id,[bool]$Ok){$opsChecks.Add(@{id=$Id;ok=$Ok})}
try{$opsPage=Invoke-WebRequest -Uri $SiteUrl -TimeoutSec 30;Add-OpsCheck 'frontend' ($opsPage.StatusCode -eq 200 -and $opsPage.Content.Contains('id="authScreen"') -and ($opsPage.Headers['X-Frame-Options'] -join ',') -match '^DENY$' -and ($opsPage.Headers['Content-Security-Policy'] -join ';') -match "frame-ancestors\s+'none'")}catch{Add-OpsCheck 'frontend' $false}
try{$opsHealth=Invoke-RestMethod -Uri ($ApiUrl+'health') -TimeoutSec 30;Add-OpsCheck 'api' ($opsHealth.ok -eq $true)}catch{Add-OpsCheck 'api' $false}
try{$opsDenied=Invoke-WebRequest -Uri ($ApiUrl+'catalog') -SkipHttpErrorCheck -TimeoutSec 30;Add-OpsCheck 'auth' ($opsDenied.StatusCode -eq 401)}catch{Add-OpsCheck 'auth' $false}
try{
 $opsRestore=(& (Join-Path $PSScriptRoot 'verify-backup.ps1'))|ConvertFrom-Json
 Add-OpsCheck 'backupIntegrity' $true;Add-OpsCheck 'restoreRehearsal' ($opsRestore.ok -eq $true);Add-OpsCheck 'backupAge' ($opsRestore.ageHours -ge 0 -and $opsRestore.ageHours -le 30)
}catch{Add-OpsCheck 'backupIntegrity' $false;Add-OpsCheck 'restoreRehearsal' $false;Add-OpsCheck 'backupAge' $false}
try{$opsTask=Get-ScheduledTask -TaskName 'ZZWS encrypted application backup';$opsTaskInfo=$opsTask|Get-ScheduledTaskInfo;Add-OpsCheck 'scheduler' ($opsTask.State -ne 'Disabled' -and $opsTaskInfo.LastTaskResult -in @(0,267009))}catch{Add-OpsCheck 'scheduler' $false}
$opsResult=@{checkedAt=(Get-Date).ToUniversalTime().ToString('o');checks=$opsChecks.ToArray();scope='application-data-only'}
$opsResult|ConvertTo-Json -Depth 5|Set-Content -Encoding utf8 (Join-Path $opsRoot 'backups/server/operations-status.json')
if($Report){
 try{
  $opsKey=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $opsRoot 'private-data/backup-config/key.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
  Invoke-RestMethod -Uri ($ApiUrl+'maintenance/operations') -Method Post -ContentType 'application/json' -Headers @{Authorization=('Bearer '+$opsKey)} -Body ($opsResult|ConvertTo-Json -Depth 5) -TimeoutSec 30|Out-Null
 }finally{$opsKey=$null}
}
$opsResult|ConvertTo-Json -Depth 5
