$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $root '.runtime'
foreach ($name in @('frontend.pid', 'backend.pid')) {
  $file = Join-Path $runtime $name
  if (Test-Path $file) {
    $raw = (Get-Content $file -ErrorAction SilentlyContinue | Select-Object -First 1)
    $processId = 0
    if ([int]::TryParse([string]$raw, [ref]$processId)) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
      if ($process -and $process.CommandLine -and $process.CommandLine.Contains($root)) {
        & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
      }
    }
    Remove-Item $file -Force -ErrorAction SilentlyContinue
  }
}
Write-Host 'Processos do My Series encerrados.'
