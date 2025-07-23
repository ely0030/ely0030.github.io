# Protected Mode Critical Knowledge

**Purpose**: Non-obvious implementation details for complete site protection.  
**Context**: User wanted IoT devices unable to even VIEW blog content.

## Critical Failure Point

### .env Loading in Proxy 🔥
**File**: `https-proxy-protected.cjs:1`  
**MUST HAVE**: `require('dotenv').config()` at top  
**Symptom**: Login "succeeds" but all requests still unauthorized  
**Root cause**: Proxy uses default password while API uses .env password  
**Debug pattern**:
```javascript
console.log('Token verification:', {
  received: token,        // SHA-256 of actual password
  expected: expectedToken, // SHA-256 of proxy's password
  match: token === expectedToken
});
```
**Time wasted**: 30+ min thinking cookie domain issue when it was token mismatch

## Architecture Insights

### Cookie Domain Separation
**Issue**: API server (:4322) sets cookie for its domain, proxy (:4320) can't read it  
**Solution**: Proxy intercepts `/api/login` response and sets its own cookie  
**Location**: `https-proxy-protected.cjs:284-308`  
**Pattern**: Read response body, parse JSON, set cookie with proxy's domain

### Token Generation Must Match
**API server**: `crypto.createHash('sha256').update(password).digest('hex')`  
**Proxy must use**: Same method, NOT createHmac  
**Files affected**: 
- `blog-save-server-secure.js:22`
- `https-proxy-protected.cjs:51-55`

## Debugging Workflow

1. **Verify password loading**:
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.BLOG_AUTH_PASSWORD)"
   ```

2. **Check token generation**:
   ```bash
   echo -n "your-password" | shasum -a 256
   ```

3. **Add debug headers** to proxy request handler:
   ```javascript
   console.log('Cookie header:', req.headers.cookie);
   console.log('Parsed cookies:', cookies);
   console.log('Auth token:', authToken);
   ```

## Common Pitfalls

- **Forgetting Secure flag**: Required for HTTPS but breaks localhost testing
- **SameSite=strict**: Too restrictive for cross-port cookies, use 'lax'
- **Missing path=/**: Cookie not sent for all routes without explicit path

## File Locations

- **Proxy**: `/https-proxy-protected.cjs`
- **Launch scripts**: `/start-https-server-PROTECTED.bat`, `/run-dev-protected.sh`
- **PowerShell**: `/host-network-https-protected.ps1`

## Login Page Design (2025-01-21) 🔥
**CRITICAL**: Minimal password box - NOT a component
- Location: `https-proxy-protected.cjs:80-187` (inline HTML/CSS in loginPageHTML const)
- Design evolution: Started with deep blue theme → reverted to minimal
- Final design: Just password input + login button at 40vh from top
- **Key learnings**:
  - This is NOT PasswordGate.astro or index inline form
  - Styles are embedded in the proxy file itself
  - User wanted "apache-like" but minimal, not old-school
- **Style details**:
  - Monospace font throughout
  - Blue (#0055bb) underlined "login" button
  - Vertical layout: input above, button below
  - Centered at 40vh for better visual balance
- **PITFALL**: Three different password UIs exist - know which you're editing