# HTTPS hosting script for Windows
Write-Host "Starting HTTPS Blog Server" -ForegroundColor Green

# Check certificates
if (-not (Test-Path "certs/cert.pem") -or -not (Test-Path "certs/key.pem")) {
    Write-Host "❌ Certificates not found! Run certificate generation first." -ForegroundColor Red
    exit
}

# Set environment
$env:ASTRO_TELEMETRY_DISABLED = "1"

# Start blog save API
Write-Host "Starting Blog Save API (Secure)..." -ForegroundColor Cyan
# Run blog save server WITHOUT -WindowStyle Minimized so logs appear in console
$blogApi = Start-Process -FilePath "node" -ArgumentList "blog-save-server-secure.js" -PassThru -NoNewWindow

# Start Astro on different port
Write-Host "Starting Astro Dev Server..." -ForegroundColor Cyan
# Use npx.cmd for Windows
$astro = Start-Process -FilePath "npx.cmd" -ArgumentList "astro dev --host 0.0.0.0 --port 4320" -PassThru -NoNewWindow

Write-Host "Waiting for Astro to start..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Start the dedicated HTTPS proxy
Write-Host "Starting HTTPS Proxy..." -ForegroundColor Cyan
$env:LISTEN_PORT = "4321"
$env:ASTRO_PORT = "4320"
$env:API_PORT = "4322"
# Also run proxy in same console window to see all logs
$proxy = Start-Process -FilePath "node" -ArgumentList "https-proxy.cjs" -PassThru -NoNewWindow

Write-Host "`n✅ HTTPS Blog Server Running!" -ForegroundColor Green
Write-Host "Access at: https://192.168.0.160:4321" -ForegroundColor Yellow
Write-Host "Note: Accept the certificate warning in your browser" -ForegroundColor Yellow
Write-Host "`nClose this window to stop all servers" -ForegroundColor Gray

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 60
} 