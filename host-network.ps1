# Enhanced network hosting script for ely0030's blog (PowerShell version)
# This script runs both the Astro dev server and the blog save API server
# allowing full blog editing capabilities from any device on the network

Write-Host "🚀 Starting ely0030's Blog Network Server" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Get the local IP address
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"} | Select-Object -First 1).IPAddress

if (-not $LocalIP) {
    Write-Host "⚠️  Could not determine local IP address" -ForegroundColor Yellow
    Write-Host "Using localhost only..." -ForegroundColor Yellow
    $LocalIP = "localhost"
} else {
    Write-Host "📡 Network IP: $LocalIP" -ForegroundColor Cyan
}

# Set environment variables for the servers
$env:HOST = "0.0.0.0"  # Listen on all interfaces
$env:LOCAL_IP = $LocalIP
$env:ASTRO_TELEMETRY_DISABLED = "1"  # Disable Astro telemetry

# Function to cleanup on exit
function Cleanup {
    Write-Host "`n🛑 Shutting down servers..." -ForegroundColor Red
    if ($AstroProcess) { Stop-Process -Id $AstroProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($BlogApiProcess) { Stop-Process -Id $BlogApiProcess.Id -Force -ErrorAction SilentlyContinue }
    exit 0
}

# Set up cleanup trap
trap { Cleanup }

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the blog save API server in the background
Write-Host "`n📝 Starting Blog Save API Server..." -ForegroundColor Cyan
$BlogApiProcess = Start-Process -FilePath "node" -ArgumentList "blog-save-server.js" -PassThru -WindowStyle Hidden

# Give the API server a moment to start
Start-Sleep -Seconds 2

# Check if .nvmrc exists and use nvm if needed
if (Test-Path ".nvmrc") {
    Write-Host "`n📦 Loading Node version from .nvmrc..." -ForegroundColor Yellow
    $NodeVersion = Get-Content ".nvmrc"
    Write-Host "Required Node version: $NodeVersion" -ForegroundColor Yellow
    Write-Host "Current Node version:" -ForegroundColor Yellow
    node --version
}

# Start Astro dev server with host binding
Write-Host "`n🌟 Starting Astro Development Server..." -ForegroundColor Cyan
Write-Host "This will take a moment to build..." -ForegroundColor Yellow

# Run Astro with network host binding
$AstroProcess = Start-Process -FilePath "npx" -ArgumentList "astro", "dev", "--host", "0.0.0.0" -PassThru -WindowStyle Hidden

# Wait for Astro to start
Write-Host "`n⏳ Waiting for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Display access information
Write-Host "`n✅ Blog is now accessible on your network!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "📱 Access from any device on your network:" -ForegroundColor Cyan
Write-Host "   🌐 http://$LocalIP:4321" -ForegroundColor White
Write-Host ""
Write-Host "💻 Local access:" -ForegroundColor Cyan
Write-Host "   🌐 http://localhost:4321" -ForegroundColor White
Write-Host ""
Write-Host "📝 Notepad editor with save functionality:" -ForegroundColor Cyan
Write-Host "   ✏️  http://$LocalIP:4321/notepad" -ForegroundColor White
Write-Host ""
Write-Host "🔒 Security Note:" -ForegroundColor Yellow
Write-Host "   This server is accessible to all devices on your local network." -ForegroundColor Yellow
Write-Host "   Do not use on public WiFi networks." -ForegroundColor Yellow
Write-Host ""
Write-Host "🛑 Press Ctrl+C to stop the server" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Green

# Keep the script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ($AstroProcess.HasExited -or $BlogApiProcess.HasExited) {
            Write-Host "`n❌ One of the servers has stopped unexpectedly" -ForegroundColor Red
            break
        }
    }
} catch {
    Write-Host "`n🛑 Interrupted by user" -ForegroundColor Yellow
} finally {
    Cleanup
} 