# Mini PC Setup Guide for AI Assistant

This guide is for the AI assistant on the Minisforum PC to implement the network hosting setup.

## Current Status Check

First, verify what's already set up:
```bash
# Check if Node.js is installed and version
node --version  # Should be 18.17.1 or higher

# Check current directory
pwd  # Should be in the blog directory

# Check if dependencies are installed
ls node_modules/  # Should exist with many packages
```

## Required Setup Steps

### 1. Install Dependencies (if needed)
```bash
# If node_modules doesn't exist:
npm install
```

### 2. Fix Windows-Specific Issues

The API server binding needs to be verified for Windows:
```bash
# Check if blog-save-server.js has correct HOST binding
grep "HOST = '0.0.0.0'" blog-save-server.js
# If not found, the server might only bind to localhost
```

### 3. Update IP Address in Scripts

The hardcoded IP `192.168.0.160` should match the actual Minisforum IP:
```bash
# Get current IP on Windows
ipconfig | findstr "IPv4"

# Update start-servers.bat with correct IP
# Line 15 should show your actual IP address
```

### 4. Verify Proxy Configuration

Check that `astro.config.mjs` has the proxy setup:
```javascript
// Should contain:
server: {
    proxy: {
        '/api': {
            target: 'http://127.0.0.1:4322',
            changeOrigin: true
        }
    }
}
```

### 5. Test Basic Functionality

Run a test to ensure both servers start:
```bash
# Test the blog save server
node blog-save-server.js
# Should see: "📝 Blog save API running on http://0.0.0.0:4322"
# Press Ctrl+C to stop

# Test Astro server
set ASTRO_TELEMETRY_DISABLED=1 && npx astro dev --host 0.0.0.0
# Should see: "Local: http://localhost:4321/"
# Press Ctrl+C to stop
```

### 6. Set Up HTTPS (Optional but Recommended)

Generate self-signed certificates:
```bash
# Windows PowerShell version:
mkdir certs
cd certs

# You'll need OpenSSL for Windows or use PowerShell:
# If OpenSSL is installed:
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Home/CN=192.168.0.160" -addext "subjectAltName=IP:192.168.0.160,IP:127.0.0.1,DNS:localhost"

# Return to main directory
cd ..
```

### 7. Create Windows HTTPS Script

Create `host-network-https.ps1`:
```powershell
# HTTPS hosting script for Windows
Write-Host "🔒 Starting HTTPS Blog Server" -ForegroundColor Green

# Check certificates
if (-not (Test-Path "certs/cert.pem") -or -not (Test-Path "certs/key.pem")) {
    Write-Host "❌ Certificates not found! Run certificate generation first." -ForegroundColor Red
    exit
}

# Set environment
$env:ASTRO_TELEMETRY_DISABLED = "1"

# Start blog save API
Write-Host "Starting Blog Save API..." -ForegroundColor Cyan
$blogApi = Start-Process -FilePath "node" -ArgumentList "blog-save-server.js" -PassThru -WindowStyle Minimized

# Start Astro on different port
Write-Host "Starting Astro Dev Server..." -ForegroundColor Cyan
$astro = Start-Process -FilePath "npx" -ArgumentList "astro dev --host 0.0.0.0 --port 4320" -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 5

# Create HTTPS proxy
$proxyScript = @'
const https = require('https');
const http = require('http');
const fs = require('fs');

const options = {
  key: fs.readFileSync('certs/key.pem'),
  cert: fs.readFileSync('certs/cert.pem')
};

https.createServer(options, (req, res) => {
  const targetPort = req.url.startsWith('/api') ? 4322 : 4320;
  
  const proxy = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  req.pipe(proxy);
}).listen(4321, '0.0.0.0', () => {
  console.log('HTTPS proxy running on https://0.0.0.0:4321');
});
'@

$proxyScript | Out-File -FilePath "https-proxy-temp.js" -Encoding UTF8

Write-Host "Starting HTTPS Proxy..." -ForegroundColor Cyan
$proxy = Start-Process -FilePath "node" -ArgumentList "https-proxy-temp.js" -PassThru

Write-Host "`n✅ HTTPS Blog Server Running!" -ForegroundColor Green
Write-Host "Access at: https://192.168.0.160:4321" -ForegroundColor Yellow
Write-Host "Note: Accept the certificate warning in your browser" -ForegroundColor Yellow
Write-Host "`nPress any key to stop all servers..."

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Stop-Process -Id $blogApi.Id -Force
Stop-Process -Id $astro.Id -Force  
Stop-Process -Id $proxy.Id -Force
Remove-Item "https-proxy-temp.js"
```

### 8. Test Full Setup

Run the complete setup:
```bash
# For HTTP:
./start-servers.bat

# For HTTPS (after generating certificates):
powershell -ExecutionPolicy Bypass -File host-network-https.ps1
```

### 9. Verify Network Access

From another device on the network:
1. Open browser to `http://192.168.0.160:4321` (or https://)
2. Navigate to `/notepad`
3. Try creating a test post
4. Verify it saves correctly

## Troubleshooting Commands

```bash
# Check if ports are in use
netstat -an | findstr :4321
netstat -an | findstr :4322

# Check Node processes
tasklist | findstr node

# Kill stuck Node processes
taskkill /f /im node.exe

# Check firewall rules
netsh advfirewall firewall show rule name=all | findstr 4321
```

## Important File Locations

- Main hosting script: `start-servers.bat`
- Blog save API: `blog-save-server.js`
- Astro config: `astro.config.mjs`
- Network docs: `docs/network-hosting-setup.md`
- HTTPS docs: `docs/https-setup.md`

## Final Checklist

- [ ] Node.js 18.17.1+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] IP address updated in scripts
- [ ] Both servers start without errors
- [ ] Can access from other devices
- [ ] Notepad save functionality works
- [ ] (Optional) HTTPS certificates generated
- [ ] (Optional) HTTPS server tested

## Need Help?

Check these files for more details:
- `minipc-server-info.md` - Windows-specific setup info
- `NETWORK-HOSTING.md` - General network hosting guide
- `docs/troubleshooting.md` - Common issues