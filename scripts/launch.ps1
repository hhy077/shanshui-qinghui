$ErrorActionPreference = 'Stop'
$inkRoot = Split-Path -Parent $PSScriptRoot
$inkNode = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $inkNode) {
  Write-Host 'Node.js 18 or newer is required. Install Node.js, then start again.' -ForegroundColor Yellow
  Start-Process 'https://nodejs.org/'
  exit 1
}
$inkRuntime = Join-Path $inkRoot '.runtime'
New-Item -ItemType Directory -Path $inkRuntime -Force | Out-Null
$inkPort = 5178
for ($inkTry=0; $inkTry -lt 10; $inkTry++) {
  try {
    $inkExisting = Invoke-RestMethod -Uri "http://localhost:$inkPort/__health" -TimeoutSec 1
    if ($inkExisting.app -eq 'shanshui-qinghui') {
      Start-Process "http://localhost:$inkPort"
      exit 0
    }
    $inkPort++
  } catch {
    $inkConnection = Get-NetTCPConnection -LocalPort $inkPort -State Listen -ErrorAction SilentlyContinue
    if (-not $inkConnection) { break }
    $inkPort++
  }
}
$env:PORT = [string]$inkPort
$inkProcess = Start-Process -FilePath $inkNode.Source -ArgumentList 'server.mjs' -WorkingDirectory $inkRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $inkRuntime 'server.log') -RedirectStandardError (Join-Path $inkRuntime 'server-error.log') -PassThru
$inkProcess.Id | Set-Content -LiteralPath (Join-Path $inkRuntime 'server.pid')
for ($inkWait=0; $inkWait -lt 40; $inkWait++) {
  try {
    $inkHealth = Invoke-RestMethod -Uri "http://localhost:$inkPort/__health" -TimeoutSec 1
    if ($inkHealth.app -eq 'shanshui-qinghui') {
      Start-Process "http://localhost:$inkPort"
      Write-Host "山水清晖已展开：http://localhost:$inkPort"
      exit 0
    }
  } catch { Start-Sleep -Milliseconds 200 }
}
Write-Host 'Startup did not complete. Review the logs in .runtime.' -ForegroundColor Yellow
exit 1
