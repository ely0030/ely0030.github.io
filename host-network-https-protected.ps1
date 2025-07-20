# HTTPS hosting script for Windows - PROTECTED MODE
Write-Host "Starting HTTPS Blog Server (PROTECTED MODE)" -ForegroundColor Green
Write-Host "🔒 Authentication required to view ANY page" -ForegroundColor Yellow

# Check certificates
if (-not (Test-Path "certs/cert.pem") -or -not (Test-Path "certs/key.pem")) {
    Write-Host "❌ Certificates not found! Run certificate generation first." -ForegroundColor Red
    exit
}

# Check .env file
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found! Create it with BLOG_AUTH_PASSWORD=your-password" -ForegroundColor Red
    exit
}

# Set environment
$env:ASTRO_TELEMETRY_DISABLED = "1"

# Start blog save API
Write-Host "Starting Blog Save API (Secure)..." -ForegroundColor Cyan
$blogApi = Start-Process -FilePath "node" -ArgumentList "blog-save-server-secure.js" -PassThru -WindowStyle Minimized

# Start Astro on different port
Write-Host "Starting Astro Dev Server..." -ForegroundColor Cyan
$astro = Start-Process -FilePath "npx" -ArgumentList "astro dev --host 0.0.0.0 --port 4320" -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 5

# Start the PROTECTED HTTPS proxy
Write-Host "Starting HTTPS Proxy (PROTECTED)..." -ForegroundColor Cyan
$env:LISTEN_PORT = "4321"
$env:ASTRO_PORT = "4320"
$env:API_PORT = "4322"
$proxy = Start-Process -FilePath "node" -ArgumentList "https-proxy-protected.cjs" -PassThru

Write-Host "`n✅ PROTECTED HTTPS Blog Server Running!" -ForegroundColor Green
Write-Host "Access at: https://192.168.0.160:4321" -ForegroundColor Yellow
Write-Host "`n⚠️  IMPORTANT: You will need to login to view ANY page" -ForegroundColor Yellow
Write-Host "Password is in your .env file" -ForegroundColor Yellow
Write-Host "`nPress any key to stop all servers..."

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Stop-Process -Id $blogApi.Id -Force
Stop-Process -Id $astro.Id -Force  
Stop-Process -Id $proxy.Id -Force