# Windows PC Setup Guide

Complete guide for setting up the ely0030 blog on Windows with HTTPS and authentication.

## Prerequisites

- Node.js installed (v18+ recommended)
- Git installed (includes Git Bash with OpenSSL)
- Windows 10/11
- Administrator access (for firewall prompts)

## Step 1: Initial Setup

### 1.1 Clone and Install Dependencies
```batch
git clone [repository-url]
cd ely0030.github.io
npm install
```

### 1.2 Create Environment File
Create `.env` in the project root:
```
BLOG_AUTH_PASSWORD=your-secure-password-here
```

**Important**: Use a strong password (12+ characters with mixed case, numbers, symbols)

## Step 2: Generate SSL Certificates

### 2.1 Create Certificate Directory
```batch
mkdir certs
```

### 2.2 Generate Self-Signed Certificate

#### Option A: Using OpenSSL directly (if in PATH)
```batch
openssl req -x509 -newkey rsa:4096 -keyout certs\key.pem -out certs\cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Home/CN=localhost" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"
```

#### Option B: Using config file (recommended for Windows)
Create `generate-cert.conf`:
```ini
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=US
ST=State
L=City
O=Home
OU=Personal
CN=localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
```

Then run:
```batch
openssl req -x509 -newkey rsa:4096 -keyout certs\key.pem -out certs\cert.pem -days 365 -nodes -config generate-cert.conf
```

## Step 3: Start the Servers

### 3.1 Using DEBUG Mode (Recommended)
This opens separate console windows for each server, making troubleshooting easier:

```batch
start-https-server-DEBUG.bat
```

This will:
1. Kill any existing Node processes (WARNING!)
2. Start Secure Blog API (port 4322)
3. Start Astro Dev Server (port 4321)
4. Start HTTPS Proxy (port 4320)

### 3.2 Manual Start (Alternative)
If you prefer to start servers individually:

```batch
# Terminal 1: Secure API Server
node blog-save-server-secure.js

# Terminal 2: Astro Dev Server
npx astro dev --port 4321 --host

# Terminal 3: HTTPS Proxy (set environment variables first)
set LISTEN_PORT=4320
set ASTRO_PORT=4321
set API_PORT=4322
node https-proxy.cjs
```

## Step 4: Access the Site

1. Open browser to: https://localhost:4320
2. Accept the certificate warning (it's self-signed)
   - Chrome: Click "Advanced" → "Proceed to localhost (unsafe)"
   - Firefox: Click "Advanced" → "Accept the Risk and Continue"
3. Navigate to `/notepad` for blog editing

## Common Issues & Solutions

### Issue 1: HTTPS Proxy Crashes with Header Error
**Error**: `TypeError [ERR_HTTP_INVALID_HEADER_VALUE]: Invalid value "undefined"`

**Solution**: Update `https-proxy.cjs` to properly delete headers:
```javascript
// Wrong:
headers: { ...req.headers, 'accept-encoding': undefined }

// Correct:
const proxyHeaders = { ...req.headers };
delete proxyHeaders['accept-encoding'];
```

### Issue 2: Notepad Shows No Blog Posts
**Symptoms**: 
- Empty blog post list
- Can't create new posts
- Console error about `handleLogout`

**Solutions**:
1. Check browser console for errors
2. Ensure `window.BLOG_POSTS` is defined
3. Add missing `handleLogout` function if needed
4. Implement initialization wrapper to wait for BLOG_POSTS

### Issue 3: Socket Hang Up Errors
**Error**: Proxy health checks pass but requests fail with "socket hang up"

**Common Causes**:
- Wrong port configuration
- Missing environment variables
- Connection pooling issues

**Solution**: Ensure environment variables are set before starting proxy

### Issue 4: Authentication Errors
**Symptom**: 403 errors when saving, unwanted error alerts

**Normal Flow**:
1. First save attempt → 403 (expected)
2. Login modal appears
3. Enter password from `.env`
4. Operations continue

**Fix**: The authentication error handling has been improved to not show alerts for expected auth flows.

### Issue 5: Port Already in Use
**Error**: `EADDRINUSE` 

**Solution**:
```batch
# Find and kill processes on ports
netstat -ano | findstr :4320
netstat -ano | findstr :4321
netstat -ano | findstr :4322

# Kill process by PID
taskkill /F /PID [process-id]

# Or kill all Node processes (careful!)
taskkill /F /IM node.exe
```

## Quick Restart Scripts

### Restart HTTPS Proxy Only
Create `restart-https-proxy.bat`:
```batch
@echo off
echo Restarting HTTPS Proxy Server...
set LISTEN_PORT=4320
set ASTRO_PORT=4321
set API_PORT=4322
node https-proxy.cjs
pause
```

## Security Notes

1. **Self-Signed Certificate**: Browser warnings are normal. The certificate is only for local development.

2. **Authentication**: 
   - Password stored in `.env` (excluded from git)
   - Tokens stored in browser localStorage
   - Rate limiting: 5 attempts per 15 minutes

3. **Network Access**: 
   - By default, servers bind to all interfaces (0.0.0.0)
   - Windows Firewall may prompt for access
   - Only allow access on trusted networks

## Port Reference

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| HTTPS Proxy | 4320 | HTTPS | Main access point, proxies to others |
| Astro Dev | 4321 | HTTP | Development server |
| Secure API | 4322 | HTTP | Blog save/delete operations |

## Testing Checklist

- [ ] Can access https://localhost:4320
- [ ] Certificate warning can be bypassed
- [ ] Homepage loads with blog posts
- [ ] `/notepad` page loads
- [ ] Can create new blog post
- [ ] Authentication prompt appears on save
- [ ] Save completes successfully
- [ ] Page reloads with saved content

## Troubleshooting Commands

```batch
# Check what's running on ports
netstat -an | findstr "4320 4321 4322"

# Test Astro directly (bypass proxy)
curl http://localhost:4321

# Test HTTPS proxy
curl -k https://localhost:4320

# Check API authentication
curl -X POST http://localhost:4322/api/save-blog-post -H "Content-Type: application/json" -d "{}"
```

## Related Documentation

- `SECURITY-SETUP.md` - Authentication setup details
- `https-setup.md` - General HTTPS setup guide
- `minipc-https-setup-log-2025-07-19.md` - Another Windows setup example
- `_temp/windows-setup-session-2025-01-20.md` - Detailed troubleshooting session