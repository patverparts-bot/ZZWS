param([switch]$PublishReport)
$ErrorActionPreference='Stop'
$opsProject=(Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$opsBackupScript=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'backup-application.ps1')).Path
$opsCheckScript=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'check-operations.ps1')).Path
$opsBackupTask=Get-ScheduledTask -TaskName 'ZZWS encrypted application backup'
$opsOriginalAction=@($opsBackupTask.Actions)[0]
if($opsOriginalAction.Arguments -notlike ('*"'+$opsBackupScript+'"*') -or $opsOriginalAction.WorkingDirectory -ne $opsProject){throw 'The existing backup task does not point to this workspace'}
if(-not (Test-Path -LiteralPath $opsOriginalAction.Execute)){throw 'The configured PowerShell executable is unavailable'}
$opsArgs='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$opsCheckScript+'"'+$(if($PublishReport){' -Report'}else{''})
$opsAction=New-ScheduledTaskAction -Execute $opsOriginalAction.Execute -Argument $opsArgs -WorkingDirectory $opsProject
$opsTrigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Hours 1)
$opsSettings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'ZZWS operations checks' -Action $opsAction -Trigger $opsTrigger -Settings $opsSettings -Principal $opsBackupTask.Principal -Description 'Hourly read-only ZZWS availability and encrypted-backup restoration checks.' -Force|Out-Null
Enable-ScheduledTask -TaskName 'ZZWS encrypted application backup'|Out-Null
Enable-ScheduledTask -TaskName 'ZZWS operations checks'|Out-Null
Write-Output 'Existing daily backup re-enabled; hourly operations checks enabled.'
