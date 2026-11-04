param([switch]$Apply,[string]$ReportPath,[string]$ServiceKey,[string]$PythonPath,[string]$SupabasePath)
$ErrorActionPreference='Stop'
$retentionRoot=Split-Path -Parent $PSScriptRoot
$retentionPrevious=[Environment]::GetEnvironmentVariable('ZZWS_RELEASE_SERVICE_KEY','Process')
try {
 if(-not $PythonPath){$PythonPath=$env:ZZWS_PYTHON}
 if(-not $PythonPath){
  $retentionBundled=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
  if(Test-Path -LiteralPath $retentionBundled){$PythonPath=$retentionBundled}
  else {
   $retentionPython=Get-Command python3,python -CommandType Application -ErrorAction SilentlyContinue | Where-Object Source -NotMatch 'WindowsApps' | Select-Object -First 1
   if($retentionPython){$PythonPath=$retentionPython.Source}
  }
 }
 if(-not $PythonPath){throw 'Python 3 is required. Set -PythonPath or ZZWS_PYTHON; no cleanup performed.'}
 if(-not $ServiceKey){
  if(-not $SupabasePath){
   $retentionLocalCli=Join-Path $retentionRoot 'work/stage1-tools/node_modules/.bin/supabase.cmd'
   if(Test-Path -LiteralPath $retentionLocalCli){$SupabasePath=$retentionLocalCli}
   else {$retentionCli=Get-Command supabase -ErrorAction SilentlyContinue;if($retentionCli){$SupabasePath=$retentionCli.Source}}
  }
  if(-not $SupabasePath){throw 'Authenticated Supabase CLI is required. Set -SupabasePath; no cleanup performed.'}
  $retentionRecords=& $SupabasePath projects api-keys --project-ref xufxevjdfukglplsknrp --reveal --output json --log-level error
  if($LASTEXITCODE -ne 0){throw 'Authenticated Supabase CLI failed; no cleanup performed.'}
  $retentionKeys=($retentionRecords -join "`n")|ConvertFrom-Json
  $ServiceKey=($retentionKeys|Where-Object name -eq 'service_role'|Select-Object -First 1).api_key
 }
 if(-not $ServiceKey){throw 'Deployment credential unavailable; no cleanup performed.'}
 $env:ZZWS_RELEASE_SERVICE_KEY=$ServiceKey
 $retentionArgs=@((Join-Path $PSScriptRoot 'apk_retention.py'))
 if($Apply){$retentionArgs+='--apply'}
 if($ReportPath){$retentionArgs+=@('--report',$ReportPath)}
 & $PythonPath @retentionArgs
 if($LASTEXITCODE -ne 0){throw 'APK retention did not complete. Publication may already be committed; do not republish a different APK with the same version.'}
} finally {
 [Environment]::SetEnvironmentVariable('ZZWS_RELEASE_SERVICE_KEY',$retentionPrevious,'Process')
 $ServiceKey=$null;$retentionKeys=$null;$retentionRecords=$null
}
