param([ValidatePattern('^build(?:-[A-Za-z0-9-]+)?$')][string]$BuildDirectory='build',[string]$FrontendDirectory='')
$ErrorActionPreference='Stop'
$photoTask=Split-Path -Parent $PSScriptRoot
$photoOriginal=$photoTask
$photoAndroid=Join-Path $photoTask 'android'
$photoFrontend=if($FrontendDirectory){(Resolve-Path -LiteralPath $FrontendDirectory).Path}else{$photoTask}
if(-not ($photoFrontend.Equals($photoTask,[StringComparison]::OrdinalIgnoreCase) -or $photoFrontend.StartsWith($photoTask+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))){throw 'Frontend source must stay within the workspace.'}
foreach($photoAsset in @('dealer-tools.js','bundle-policy.js')){Copy-Item -LiteralPath (Join-Path $photoFrontend ('js/'+$photoAsset)) -Destination (Join-Path $photoAndroid ('assets/'+$photoAsset)) -Force}
$photoTools=if($env:ZZWS_ANDROID_TOOLCHAIN){$env:ZZWS_ANDROID_TOOLCHAIN}else{Join-Path $photoOriginal 'work/admin-notifications-stage1/android/.toolchain'}
$photoConfiguration=Get-Content -LiteralPath (Join-Path $photoOriginal 'private-data/android-release.json') -Raw|ConvertFrom-Json
$photoSaved=@{}
foreach($name in @('ZZWS_ANDROID_KEYSTORE','ZZWS_ANDROID_KEY_ALIAS','ZZWS_ANDROID_STORE_PASSWORD','ZZWS_ANDROID_KEY_PASSWORD','JAVA_HOME','GRADLE_USER_HOME','ANDROID_HOME','ANDROID_SDK_ROOT','ANDROID_USER_HOME')){$photoSaved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try{
 $env:JAVA_HOME=Join-Path $photoTools 'jdk-21.0.12.1+1'
 $env:GRADLE_USER_HOME=Join-Path $photoTools 'gradle-home'
 $env:ANDROID_HOME=Join-Path $photoTools 'sdk';$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
 $env:ANDROID_USER_HOME=Join-Path $photoAndroid '.android-user'
 $photoSigning=Join-Path $photoOriginal 'private-data/android-signing'
 $photoBytes=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $photoSigning 'password.dpapi')),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $photoPassword=[Text.Encoding]::UTF8.GetString($photoBytes)
 $env:ZZWS_ANDROID_KEYSTORE=Join-Path $photoSigning 'zzws-admin-release.jks';$env:ZZWS_ANDROID_KEY_ALIAS='zzws-admin-release';$env:ZZWS_ANDROID_STORE_PASSWORD=$photoPassword;$env:ZZWS_ANDROID_KEY_PASSWORD=$photoPassword
 Push-Location -LiteralPath $photoAndroid
 try{
  $photoBuildFlags=@()
  if($BuildDirectory -ne 'build'){$photoBuildFlags=@(('-PzzwsBuildDirectory='+$BuildDirectory),'--project-cache-dir',(Join-Path $photoAndroid ('.gradle-'+$BuildDirectory)))}
  & (Join-Path $photoTools 'gradle-8.13/bin/gradle.bat') assembleRelease testReleaseUnitTest '--no-daemon' '--offline' '--console=plain' '--max-workers=1' '-Dorg.gradle.jvmargs=-Xmx512m -Xms64m -XX:ActiveProcessorCount=2 -XX:+UseSerialGC -Dfile.encoding=UTF-8' '-Pkotlin.compiler.execution.strategy=in-process' '-I' (Join-Path $photoOriginal 'private-data/android-test-low-memory.gradle') ('-PzzwsApiUrl='+$photoConfiguration.api) ('-PzzwsPublicKey='+$photoConfiguration.publishableKey) '-PzzwsEnvironment=production' @photoBuildFlags
  if($LASTEXITCODE -ne 0){throw 'Photo technical Android build failed; nothing published.'}
 }finally{Pop-Location}
}finally{foreach($name in $photoSaved.Keys){[Environment]::SetEnvironmentVariable($name,$photoSaved[$name],'Process')};if($photoBytes){[Array]::Clear($photoBytes,0,$photoBytes.Length)};$photoPassword=$null}
