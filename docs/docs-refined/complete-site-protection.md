# Complete Site Protection

**Feature**: Password-protect entire blog from viewing (not just editing)  
**Added**: 2025-07-20  
**Use case**: Prevent IoT devices and unauthorized users from accessing ANY content

## Overview

Standard authentication only protects editing. Complete site protection requires password to VIEW any page, providing total privacy for your blog content on local networks.

## Architecture

```
User → HTTPS Proxy (:4320) → [Auth Check] → Astro (:4321) / API (:4322)
           ↓ (if no auth)
      Login Page
```

The proxy intercepts ALL requests and shows login page if no valid auth cookie exists.

## Implementation

### Core Components

1. **https-proxy-protected.cjs**
   - Serves login page for unauthenticated requests
   - Validates auth cookies before proxying
   - Sets httpOnly secure cookies after login

2. **Launch Scripts**
   - Windows: `start-https-server-PROTECTED.bat`
   - Unix/Mac: `./run-dev-protected.sh`
   - PowerShell: `host-network-https-protected.ps1`

### Authentication Flow

1. User visits any URL → Proxy checks for `blog_auth` cookie
2. No cookie → Show login page (served directly from proxy)
3. User enters password → POST to `/api/login`
4. API validates → Returns token
5. Proxy intercepts response → Sets cookie for proxy domain
6. Subsequent requests include cookie → Proxy allows access

### Critical Implementation Detail

**The proxy MUST load .env file**:
```javascript
require('dotenv').config();  // Line 1 of https-proxy-protected.cjs
```

Without this, proxy uses default password while API uses .env password, causing token mismatch.

## Configuration

### Environment Variable
```bash
# .env file
BLOG_AUTH_PASSWORD=your-secure-password
```

### Cookie Settings
```javascript
// Proxy sets cookie with these options:
httpOnly: true    // No JS access
Secure: true      // HTTPS only
Path: /           // All routes
Max-Age: 86400    // 24 hours
SameSite: Lax     // Cross-port compatibility
```

## Usage

### Start Protected Server
```bash
# Windows
start-https-server-PROTECTED.bat

# Mac/Linux
./run-dev-protected.sh
```

### Access Site
1. Navigate to `https://localhost:4320`
2. Enter password from .env
3. Browse normally for 24 hours

## Security Benefits

- **Complete Privacy**: No content accessible without password
- **IoT Protection**: Devices can't scrape or access your blog
- **Network Security**: Even on compromised networks, content is safe
- **No Client Bypass**: Protection at proxy level, not JavaScript

## Differences from Standard Auth

| Feature | Standard Auth | Protected Mode |
|---------|--------------|----------------|
| View posts | Anyone | Password required |
| Edit posts | Password | Password required |
| Protection level | API only | Entire site |
| Implementation | Client-side modal | Server-side proxy |

## Troubleshooting

### "Unauthorized" After Login
- Check proxy loads .env: `require('dotenv').config()`
- Verify tokens match between proxy and API
- Add debug logging to see token comparison

### Cookie Not Persisting
- Ensure Secure flag matches HTTPS usage
- Check cookie domain matches proxy port
- Verify SameSite isn't too strict

## Technical Notes

- Uses SHA-256 hashing for token generation
- Cookies set by proxy, not API (domain isolation)
- Public paths: `/api/login` and `/favicon.ico` only
- All other paths require valid auth token