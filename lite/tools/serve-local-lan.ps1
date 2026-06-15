param(
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$liteRoot = Join-Path $repoRoot "lite"

if (-not (Test-Path (Join-Path $liteRoot "index.html"))) {
  throw "No se encontro lite/index.html desde $liteRoot"
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  $proc = Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "$Port", "--bind", "0.0.0.0", "--directory", $liteRoot) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  Write-Host "EPIVIDA Lite local server started. PID: $($proc.Id)"
} else {
  Write-Host "EPIVIDA Lite local server already listening on port $Port."
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -ExpandProperty IPAddress

if (-not $ips) {
  Write-Host "No LAN IPv4 address detected. Check Wi-Fi/Ethernet connection."
  exit 0
}

Write-Host ""
Write-Host "Open from a phone on the same Wi-Fi/LAN:"
foreach ($ip in $ips) {
  Write-Host "  http://$ip`:$Port/?epividaTest=1&seedPatients=300#/monitoreo-epidemiologico"
  Write-Host "  http://$ip`:$Port/?epividaTest=1&seedPatients=300#/ronda-paquetes"
}

Write-Host ""
Write-Host "If the phone cannot connect, allow inbound TCP port $Port in Windows Firewall for Private networks."
