# Windows Setup Session - January 20, 2025

## Session Overview
Successfully set up the ely0030.github.io blog on a Windows PC with full HTTPS support and authentication. Resolved multiple critical issues with the notepad editor and HTTPS proxy.

## Initial State
- Fresh Windows PC without the blog installed
- Previous setup existed on a miniPC
- Blog codebase cloned but not configured

## Problems Encountered & Solutions

### 1. Notepad Not Loading Blog Posts
**Issue**: Notepad showed no blog posts and couldn't create new ones
**Root Cause**: `handleLogout` function was not defined, causing script execution to stop
**Solution**: Added missing `handleLogout` function in notepad.astro
```javascript
function handleLogout() {
    authManager.logout();
    hideLoginModal();
    console.log('Logged out successfully');
}
```

### 2. BLOG_POSTS Timing Issue
**Issue**: `window.BLOG_POSTS` not available when app initialized
**Root Cause**: Race condition between script execution
**Solution**: Added initialization wrapper that waits for BLOG_POSTS
```javascript
function initializeApp() {
    if (typeof window.BLOG_POSTS === 'undefined') {
        console.error('BLOG_POSTS not defined, waiting...');
        setTimeout(initializeApp, 100);
        return;
    }
    const app = new NotepadApp();
    app.init();
}
```

### 3. HTTPS Proxy Socket Hang Up
**Issue**: Proxy health checks passed but actual requests failed with "socket hang up"
**Root Cause**: Wrong default port configuration in proxy
**Initial Fix**: Corrected port defaults from:
```javascript
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4321", 10);
const ASTRO_PORT = parseInt(process.env.ASTRO_PORT || "4320", 10);
```
To:
```javascript
const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || "4320", 10);
const ASTRO_PORT = parseInt(process.env.ASTRO_PORT || "4321", 10);
```

### 4. HTTPS Proxy Header Error
**Issue**: `TypeError [ERR_HTTP_INVALID_HEADER_VALUE]: Invalid value "undefined" for header "accept-encoding"`
**Root Cause**: Setting headers to `undefined` doesn't remove them in Node.js
**Solution**: Properly delete headers instead of setting to undefined
```javascript
// Before (causes error):
headers: {
    ...req.headers,
    'accept-encoding': undefined
}

// After (correct):
const proxyHeaders = { ...req.headers };
delete proxyHeaders['accept-encoding'];
```

### 5. Authentication Error Alert
**Issue**: "Failed to load resource: 403 Forbidden" alert shown even when auth succeeds
**Root Cause**: Error alert triggered for auth interruptions
**Solution**: Modified error handling to exclude auth-related failures
```javascript
const stoppedForAuth = results.length < this.operationQueue.getCount();
if (failures.length > 0 && !stoppedForAuth) {
    alert(`${failures.length} operation(s) failed. Check console for details.`);
}
```

## Files Modified

### 1. `src/pages/notepad.astro`
- Added missing `handleLogout` function (lines 4955-4961)
- Added initialization wrapper for BLOG_POSTS (lines 4959-4976)
- Improved debug logging in `populateBlogPosts` (lines 2027-2032)
- Fixed authentication error alerts (lines 4121-4128)
- Added forced page reload after save (lines 4144-4147)

### 2. `https-proxy.cjs`
- Complete rewrite for better error handling
- Fixed port configuration defaults
- Proper header deletion instead of undefined assignment
- Added request logging with timestamps
- Improved error responses with helpful HTML pages

### 3. `.env` (created)
```
BLOG_AUTH_PASSWORD=MySecureBlog2025!
```

### 4. `certs/` directory (created)
- Generated self-signed SSL certificates
- `cert.pem` and `key.pem` files

### 5. Created support files:
- `restart-https-proxy.bat` - Quick proxy restart script
- `generate-cert.bat` and `generate-cert.conf` - Certificate generation helpers (deleted after use)
- `_OPS/TICKETS/_open/https-proxy-header-error.md` - Issue ticket

## Key Learnings

### 1. Script Execution Order
- Astro's `define:vars` creates a separate script block
- Must ensure dependencies are available before initialization
- Race conditions can occur between script blocks

### 2. HTTPS Proxy Pitfalls
- Node.js doesn't remove headers when set to `undefined`
- Must use `delete` operator to properly remove headers
- Connection pooling can cause "socket hang up" errors
- Host header must match backend expectations

### 3. Windows-Specific Issues
- Environment variables in batch files need explicit setting
- DEBUG batch file kills all node processes first
- PowerShell execution requires bypass policy

### 4. Authentication Flow
- 403 errors before auth are normal and expected
- Must handle auth interruptions gracefully in UI
- Auth tokens persist across page reloads

## Setup Summary

### What's Running Now:
1. **Astro Dev Server** - Port 4321 (HTTP)
2. **Secure Blog API** - Port 4322 (HTTP with auth)
3. **HTTPS Proxy** - Port 4320 (HTTPS, proxies to above)

### Access URLs:
- **HTTPS (recommended)**: https://localhost:4320
- **HTTP (direct)**: http://localhost:4321

### Authentication:
- Password stored in `.env` file
- Required for all blog save/delete operations
- Login persists in browser session

## Testing Checklist
✅ Notepad loads blog posts
✅ Can create new blog posts
✅ Can edit existing posts
✅ Authentication prompts on save
✅ Save operations complete successfully
✅ Page reloads after save
✅ No error alerts for auth issues
✅ HTTPS proxy remains stable

## Future Considerations

1. **Hot Reload**: Disabled due to HTTPS proxy, page manually reloads after save
2. **Certificate Warning**: Browser shows warning for self-signed cert (normal)
3. **WebSocket Errors**: Vite hot reload errors in console are expected and harmless
4. **Port Conflicts**: Ensure ports 4320, 4321, 4322 are free before starting

## Commands Reference

### Start Everything (Debug Mode):
```batch
start-https-server-DEBUG.bat
```

### Start Individual Components:
```batch
# Secure API Server
node blog-save-server-secure.js

# Astro Dev Server
npx astro dev --port 4321 --host

# HTTPS Proxy (with env vars)
set LISTEN_PORT=4320 && set ASTRO_PORT=4321 && set API_PORT=4322 && node https-proxy.cjs
```

### Quick Restart HTTPS Proxy:
```batch
restart-https-proxy.bat
```

## Session Duration
Approximately 2 hours, involving deep debugging of proxy issues and systematic resolution of each problem.