$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $taskRoot 'App'
$version = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$installerPath = Join-Path $taskRoot "release/MD-Hawk-$version-x64-nsis.exe"
function Get-AssociationSnapshot {
  $result = [ordered]@{}
  foreach ($extension in @('md', 'markdown', 'mdown', 'pdf', 'docx')) {
    foreach ($hive in @('HKCU', 'HKLM')) {
      $key = Get-Item -LiteralPath "${hive}:\Software\Classes\.$extension" -ErrorAction SilentlyContinue
      $result["$hive.$extension"] = if ($key) { $key.GetValue('') } else { $null }
    }
    $choice = Get-Item -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.$extension\UserChoice" -ErrorAction SilentlyContinue
    $result["UserChoice.$extension"] = if ($choice) { $choice.GetValue('ProgId') } else { $null }
  }
  return $result
}
$before = Get-AssociationSnapshot
$installedExecutable = Join-Path $installDir 'MD Hawk.exe'
$running = @(Get-Process -Name 'MD Hawk' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $installedExecutable })
foreach ($application in $running | Where-Object { $_.MainWindowHandle -ne 0 }) {
  if (-not $application.CloseMainWindow()) { throw 'Cannot close MD Hawk normally before update' }
  if (-not $application.WaitForExit(15000)) { throw 'MD Hawk did not complete normal close; update stopped' }
}
if (Get-Process -Name 'MD Hawk' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $installedExecutable }) { throw 'MD Hawk is still running; update stopped to preserve reading state' }
$arguments = '/S /currentuser /D=' + $installDir
$process = Start-Process -FilePath $installerPath -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Installer exit code: $($process.ExitCode)" }
$after = Get-AssociationSnapshot
if (($before | ConvertTo-Json -Compress) -ne ($after | ConvertTo-Json -Compress)) { throw 'Default Markdown associations changed' }
$command = (Get-Item -LiteralPath 'HKCU:\Software\Classes\MDHawk.Markdown\shell\open\command').GetValue('')
if ($command -ne ('"' + (Join-Path $installDir 'MD Hawk.exe') + '" "%1"')) { throw "Incorrect Open With command: $command" }
foreach ($extension in @('md', 'markdown', 'mdown', 'pdf', 'docx')) {
  $key = Get-Item -LiteralPath "HKCU:\Software\Classes\.$extension\OpenWithProgids"
  if ($key.GetValueNames() -notcontains 'MDHawk.Markdown') { throw "Missing Open With registration for .$extension" }
}
$executable = Join-Path $installDir 'MD Hawk.exe'
if (-not (Test-Path -LiteralPath $executable)) { throw 'Installed executable missing' }
[ordered]@{
  verifiedAt = (Get-Date).ToString('o')
  executable = $executable
  installerExitCode = $process.ExitCode
  defaultsBefore = $before
  defaultsAfter = $after
  defaultsUnchanged = $true
  openWithCommand = $command
  signatureStatus = (Get-AuthenticodeSignature -LiteralPath $executable).Status.ToString()
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskRoot '.verification/installed.json') -Encoding utf8
Write-Output "Installed and verified: $executable"
Write-Output 'Default associations unchanged; Open With registration verified.'
