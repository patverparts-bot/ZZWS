param([switch]$VerifyLatest)
$ErrorActionPreference='Stop'
$backupProject=Split-Path -Parent $PSScriptRoot
$backupDirectory=Join-Path $backupProject 'backups/server'
New-Item -ItemType Directory -Force $backupDirectory | Out-Null
if($VerifyLatest){
 $backupFile=Get-ChildItem -LiteralPath $backupDirectory -Filter '*.zzwsbackup' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 if(-not $backupFile){throw 'No backup available'}
 $backupRaw=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($backupFile.FullName),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $backupData=[Text.Encoding]::UTF8.GetString($backupRaw) | ConvertFrom-Json
 if($backupData.format -ne 'zzws-application-backup-v1' -or -not $backupData.tables.PSObject.Properties['users'] -or -not $backupData.tables.PSObject.Properties['orders']){throw 'Invalid backup manifest'}
 Write-Output ('Verified: '+$backupFile.Name+'; users='+@($backupData.tables.users).Count+'; orders='+@($backupData.tables.orders).Count)
 & (Join-Path $PSScriptRoot 'verify-backup.ps1') -BackupPath $backupFile.FullName
 exit
}
try{
 $backupKey=[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $backupProject 'private-data/backup-config/key.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
 $backupResponse=Invoke-WebRequest -Uri 'https://xufxevjdfukglplsknrp.supabase.co/functions/v1/zzws-api/maintenance/backup' -Method Post -Headers @{Authorization=('Bearer '+$backupKey)} -TimeoutSec 180
 $backupText=$backupResponse.Content
 $backupData=$backupText|ConvertFrom-Json
 if($backupData.format -ne 'zzws-application-backup-v1'){throw 'Unexpected backup response'}
 $backupBytes=[Text.Encoding]::UTF8.GetBytes($backupText)
 $backupEncrypted=[Security.Cryptography.ProtectedData]::Protect($backupBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $backupName='ZZWS-'+(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')+'.zzwsbackup'
 $backupDestination=Join-Path $backupDirectory $backupName
 [IO.File]::WriteAllBytes($backupDestination,$backupEncrypted)
 $backupRehearsal=(& (Join-Path $PSScriptRoot 'verify-backup.ps1') -BackupPath $backupDestination)|ConvertFrom-Json
 if(-not $backupRehearsal.ok){throw 'Application backup restore rehearsal failed'}
 $backupMetadata=@{status='ok';created=(Get-Date).ToString('o');file=$backupName;bytes=$backupEncrypted.Length;sha256=(Get-FileHash -LiteralPath $backupDestination -Algorithm SHA256).Hash;note='Application data and private recovery archives, including credential material inside those archives. The outer file is encrypted. Live Auth credentials outside recovery archives are separate; sessions and unlock grants are never revived.'}
 $backupMetadata|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $backupDirectory 'last-status.json')
 try{& (Join-Path $PSScriptRoot 'check-operations.ps1') -Report|Out-Null}catch{Write-Warning 'Backup was saved and verified; operations report could not be uploaded'}
 Write-Output ('Saved encrypted application backup: '+$backupName)
} catch {
 @{status='error';created=(Get-Date).ToString('o');message='Backup failed; run backup-application.ps1 manually to diagnose'}|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $backupDirectory 'last-status.json')
 throw
} finally {$backupKey=$null;$backupText=$null;$backupResponse=$null;$backupData=$null;$backupBytes=$null}
