$inkRoot = Split-Path -Parent $PSScriptRoot
$inkPidFile = Join-Path $inkRoot '.runtime\server.pid'
if (Test-Path -LiteralPath $inkPidFile) {
  $inkProcessId = [int](Get-Content -LiteralPath $inkPidFile)
  $inkProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $inkProcessId" -ErrorAction SilentlyContinue
  if ($inkProcess -and $inkProcess.Name -eq 'node.exe' -and $inkProcess.CommandLine -match 'server\.mjs') {
    Stop-Process -Id $inkProcessId -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $inkPidFile
    Write-Host 'The local Shanshui service has stopped.'
  }
}
