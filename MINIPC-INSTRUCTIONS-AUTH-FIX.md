# MiniPC Instructions: Fix Authentication System

**URGENT**: The authentication is NOT working. User can save without password. This is a security failure.

## Step 1: Pull Latest Code
```bash
git pull origin main
```

## Step 2: Check Current Server Status
Run this to see what's currently using ports:
```bash
check-ports.bat
```

If you see any ports in use (4320, 4321, 4322, 3001), kill all node processes:
```bash
taskkill /F /IM node.exe
```

## Step 3: Run Debug Mode
Run the debug version to see what's happening:
```bash
start-https-server-DEBUG.bat
```

This opens 3 console windows. Check each one:

### Window 1: Secure Blog Save Server
- Should say "Secure blog save API server running on port 4322"
- Should show "✓ Using authentication from .env file"
- When someone tries to save, should show "Authentication required" errors

**If you see errors about .env file missing**:
- The .env file doesn't exist
- Create it with: `echo BLOG_AUTH_PASSWORD=secure-blog-password-2025 > .env`

### Window 2: Astro Dev Server
- Should show normal Astro startup
- Should say it's running on port 4321

### Window 3: HTTPS Proxy
- Should say "HTTPS proxy server running"
- Should show it's routing /api to port 4322

## Step 4: Test Authentication

1. Open browser to: https://localhost:4320/notepad
2. Clear browser cache/localStorage:
   - Open F12 console
   - Go to Application tab
   - Clear localStorage
   - Or use Incognito/Private window
3. Try to save a note
4. **YOU MUST SEE A PASSWORD PROMPT**

If no password prompt appears, check:

### A. Is the secure server actually running?
Look at Window 1. If it shows the OLD server (without auth messages), then:
- Check `host-network-https.ps1` line 15
- Must say `blog-save-server-secure.js` NOT `blog-save-server.js`

### B. Is the proxy routing correctly?
In Window 3, when you click save, you should see:
```
Proxying /api/save-blog-post to http://localhost:4322
```

If it's going to port 3001, the proxy is wrong.

### C. Is notepad.astro updated?
Check if auth code exists:
```bash
findstr /C:"class AuthManager" src\pages\notepad.astro
```

Should return a match. If not, auth isn't integrated.

## Step 5: Nuclear Fix

If nothing above works:

1. **Stop everything**:
   ```bash
   taskkill /F /IM node.exe
   ```

2. **Check all config files**:
   ```bash
   type host-network-https.ps1 | findstr blog-save-server
   ```
   Should show: `blog-save-server-secure.js`

3. **Verify .env exists**:
   ```bash
   type .env
   ```
   Should show: `BLOG_AUTH_PASSWORD=secure-blog-password-2025`

4. **Clear EVERYTHING**:
   - Delete browser cache for localhost
   - Close all browser windows
   - Restart computer (yes, really)

5. **Start fresh**:
   ```bash
   start-https-server-DEBUG.bat
   ```

## Step 6: Report Results

After going through these steps, report:

1. **Which window showed errors?**
2. **Did you see "Using authentication from .env file"?**
3. **When clicking save, did Window 1 show any messages?**
4. **What port is the API going to in Window 3?**
5. **Did you get a password prompt?**

## Expected Working State

When everything works correctly:
1. All 3 windows open without errors
2. Window 1 shows "✓ Using authentication from .env file"
3. Going to /notepad and clicking save shows password modal
4. Entering password from .env allows saving
5. Future saves work without password (token cached)

## Critical Files to Check

1. **host-network-https.ps1** - Line 15 must use `blog-save-server-secure.js`
2. **.env** - Must exist with `BLOG_AUTH_PASSWORD=...`
3. **src/pages/notepad.astro** - Must have `class AuthManager` (line ~1133)
4. **https-proxy.js** - Must route /api to port 4322

The auth MUST work. The user's IoT devices should NOT be able to edit the blog!