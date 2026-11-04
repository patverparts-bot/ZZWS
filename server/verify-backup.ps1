param([string]$BackupPath,[string]$PythonPath)
$ErrorActionPreference='Stop'
$verifyRoot=Split-Path -Parent $PSScriptRoot
$verifyDirectory=Join-Path $verifyRoot 'backups/server'
if(-not $BackupPath){$verifyLatest=Get-ChildItem -LiteralPath $verifyDirectory -Filter '*.zzwsbackup'|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1;if(-not $verifyLatest){throw 'No application backup available'};$BackupPath=$verifyLatest.FullName}
if(-not $PythonPath){$PythonPath=$env:ZZWS_PYTHON}
if(-not $PythonPath){$PythonPath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
if(-not (Test-Path -LiteralPath $PythonPath)){throw 'Set ZZWS_PYTHON to a Python 3 executable'}
$verifyProcess=$null
try{
 $verifyFile=Get-Item -LiteralPath $BackupPath
 $verifyEncrypted=[IO.File]::ReadAllBytes($verifyFile.FullName)
 $verifyStatusPath=Join-Path $verifyDirectory 'last-status.json'
 if(Test-Path -LiteralPath $verifyStatusPath){$verifyMetadata=Get-Content -LiteralPath $verifyStatusPath -Raw|ConvertFrom-Json;if($verifyMetadata.file -eq $verifyFile.Name -and $verifyMetadata.sha256 -and $verifyMetadata.sha256 -ne (Get-FileHash -LiteralPath $verifyFile.FullName -Algorithm SHA256).Hash){throw 'Backup checksum mismatch'}}
 $verifyRaw=[Security.Cryptography.ProtectedData]::Unprotect($verifyEncrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $verifyText=[Text.Encoding]::UTF8.GetString($verifyRaw)
 $verifyStart=[Diagnostics.ProcessStartInfo]::new();$verifyStart.FileName=$PythonPath;$verifyStart.ArgumentList.Add((Join-Path $PSScriptRoot 'verify_snapshot.py'));$verifyStart.RedirectStandardInput=$true;$verifyStart.RedirectStandardOutput=$true;$verifyStart.RedirectStandardError=$true;$verifyStart.UseShellExecute=$false;$verifyStart.CreateNoWindow=$true;$verifyStart.Environment['PYTHONIOENCODING']='utf-8'
 $verifyStart.StandardInputEncoding=[Text.UTF8Encoding]::new($false);$verifyStart.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
 $verifyProcess=[Diagnostics.Process]::Start($verifyStart);$verifyProcess.StandardInput.Write($verifyText);$verifyProcess.StandardInput.Close();$verifyOutput=$verifyProcess.StandardOutput.ReadToEnd();$verifyProcess.WaitForExit()
 if($verifyProcess.ExitCode -ne 0){$verifyFailure=$verifyOutput|ConvertFrom-Json;throw ('Application-data restore rehearsal failed: '+$verifyFailure.error+' ('+$verifyFailure.errorType+')')}
 $verifyResult=$verifyOutput|ConvertFrom-Json
 if(-not $verifyResult.ok){throw 'Application-data restore rehearsal failed'}
 $verifyResult|Add-Member -NotePropertyName ageHours -NotePropertyValue ([Math]::Round(((Get-Date).ToUniversalTime()-$verifyFile.LastWriteTimeUtc).TotalHours,2))
 $verifyResult|Add-Member -NotePropertyName sha256 -NotePropertyValue (Get-FileHash -LiteralPath $verifyFile.FullName -Algorithm SHA256).Hash
 $verifyResult|ConvertTo-Json -Compress
}finally{$verifyRaw=$null;$verifyText=$null;$verifyEncrypted=$null;if($verifyProcess){$verifyProcess.Dispose()}}
