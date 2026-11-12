$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
foreach ($log in @('backend.log', 'backend-error.log', 'frontend.log', 'frontend-error.log')) { Remove-Item (Join-Path $runtime $log) -Force -ErrorAction SilentlyContinue }
$backendPidFile = Join-Path $runtime 'backend.pid'
$frontendPidFile = Join-Path $runtime 'frontend.pid'

foreach ($port in @(5000, 5173)) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    Write-Host "A porta $port ja esta em uso. Feche outra instancia do My Series ou o programa que usa essa porta."
    exit 1
  }
}

$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$backendWork = Join-Path $root 'backend'
$backend = Start-Process -FilePath $python -ArgumentList 'run.py' -WorkingDirectory $backendWork -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'backend.log') -RedirectStandardError (Join-Path $runtime 'backend-error.log')
$backend.Id | Set-Content -Encoding ascii $backendPidFile

$frontendWork = Join-Path $root 'frontend'
$frontendCommand = '/c cd /d "' + $frontendWork + '" && npm.cmd run dev'
$frontend = Start-Process -FilePath $env:ComSpec -ArgumentList $frontendCommand -WorkingDirectory $frontendWork -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'frontend.log') -RedirectStandardError (Join-Path $runtime 'frontend-error.log')
$frontend.Id | Set-Content -Encoding ascii $frontendPidFile

Start-Sleep -Seconds 2
if ($backend.HasExited -or $frontend.HasExited) {
  Write-Host 'Um dos processos nao iniciou corretamente. Consulte os arquivos de log na pasta .runtime.'
  & (Join-Path $PSScriptRoot 'parar.ps1')
  exit 1
}
$ready = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) {
  Write-Host 'O backend nao respondeu. Consulte .runtime\backend-error.log.'
  & (Join-Path $PSScriptRoot 'parar.ps1')
  exit 1
}
$frontReady = $false
for ($attempt = 0; $attempt -lt 15; $attempt++) {
  try {
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2
    $frontReady = $true; break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $frontReady) {
  Write-Host 'A interface nao respondeu. Consulte .runtime\frontend-error.log.'
  & (Join-Path $PSScriptRoot 'parar.ps1')
  exit 1
}
Write-Host 'Backend e interface iniciados em segundo plano.'
