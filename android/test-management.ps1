param([switch]$Offline)
$ErrorActionPreference='Stop'
$managementRoot=Split-Path -Parent $PSScriptRoot
$managementTools=if($env:ZZWS_ANDROID_TOOLCHAIN){$env:ZZWS_ANDROID_TOOLCHAIN}else{Join-Path $managementRoot 'work/admin-notifications-stage1/android/.toolchain'}
$managementSaved=@{}
foreach($name in @('JAVA_HOME','GRADLE_USER_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_USER_HOME')){$managementSaved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
 $env:JAVA_HOME=Join-Path $managementTools 'jdk-21.0.12.1+1';$env:GRADLE_USER_HOME=Join-Path $managementTools 'gradle-home';$env:ANDROID_HOME=Join-Path $managementTools 'sdk';$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME;$env:ANDROID_USER_HOME=Join-Path $PSScriptRoot '.android-user'
 $managementFlags=@('testDebugUnitTest','--tests','am.zzws.admin.ManagementNavigationRegressionTest','--tests','am.zzws.admin.PartnerPolicyTest','-PzzwsCalendarRegression=true','--no-daemon','--console=plain','--max-workers=1','-Dorg.gradle.jvmargs=-Xmx512m -Xms64m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -Dfile.encoding=UTF-8','-Pkotlin.compiler.execution.strategy=in-process')
 if($Offline){$managementFlags+='--offline'}
 Push-Location -LiteralPath $PSScriptRoot
 try{& (Join-Path $managementTools 'gradle-8.13/bin/gradle.bat') @managementFlags;if($LASTEXITCODE -ne 0){throw 'Android management navigation regression tests failed'}}finally{Pop-Location}
}finally{foreach($name in $managementSaved.Keys){[Environment]::SetEnvironmentVariable($name,$managementSaved[$name],'Process')}}
