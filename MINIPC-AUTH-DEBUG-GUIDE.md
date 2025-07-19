# MiniPC Authentication Debug Guide

**IMPORTANT**: The user connected from their Mac to the Windows server and was able to save WITHOUT entering a password. This is a security failure that needs to be fixed.

## Step 1: Verify Which Server is Running

Check the command window that opened when you ran `start-https-server.bat`. Look for which server is running:

**EXPECTED** ✅:
```
Starting blog save server...
node blog-save-server-secure.js
```

**PROBLEM** ❌:
```
Starting blog save server...
node blog-save-server.js
```

If you see the non-secure version, the script is using the wrong server.

## Step 2: Check the PowerShell Script

Open `host-network-https.ps1` and verify line 15:

**EXPECTED** ✅:
```powershell
Start-Process -FilePath "node" -ArgumentList "blog-save-server-secure.js" -WorkingDirectory $projectRoot -NoNewWindow
```

**PROBLEM** ❌:
```powershell
Start-Process -FilePath "node" -ArgumentList "blog-save-server.js" -WorkingDirectory $projectRoot -NoNewWindow
```

## Step 3: Verify .env File Exists

Check if `.env` file exists in the root directory:
```powershell
dir .env
```

Should contain:
```
BLOG_AUTH_PASSWORD=secure-blog-password-2025
```

If missing, create it.

## Step 4: Test the Secure Server Directly

Stop all servers (Ctrl+C) and test the secure server alone:

```powershell
node blog-save-server-secure.js
```

Then in a new PowerShell window, test if auth is required:
```powershell
curl -X POST http://localhost:4322/api/save-blog-post -H "Content-Type: application/json" -d '{"filename":"test.md","content":"test"}'
```

**EXPECTED** response:
```json
{"error":"Authentication required"}
```

**PROBLEM** if you get:
```json
{"success":true,...}
```

## Step 5: Check if Old Server is Still Running

Check if both servers are running on different ports:
```powershell
netstat -an | findstr "4322"
netstat -an | findstr "3001"
```

If BOTH ports are active, you have both secure and insecure servers running!

## Step 6: Kill All Node Processes and Restart

```powershell
# Stop everything
taskkill /F /IM node.exe

# Wait 5 seconds
Start-Sleep -Seconds 5

# Start fresh
./start-https-server.bat
```

## Step 7: Verify Notepad Has Auth Integration

After pulling latest from git, check if `src/pages/notepad.astro` has the auth code:

```powershell
findstr /C:"class AuthManager" src\pages\notepad.astro
```

Should return a match. If not, the auth integration is missing.

## Step 8: Browser Cache Check

The user's browser might have a cached auth token. Have them:
1. Open browser console (F12)
2. Go to Application/Storage tab
3. Check localStorage for `blog_auth_token`
4. If it exists, that's why no password prompt

To test properly:
1. Clear the token
2. Try to save a post
3. Should see password prompt

## Step 9: Check HTTPS Proxy Configuration

Open `https-proxy.js` and verify it routes `/api` to port 4322:

```javascript
if (url.pathname.startsWith('/api')) {
  // Should proxy to 'http://localhost:4322'
}
```

## Step 10: Complete Fix Checklist

If auth is NOT working, here's the fix sequence:

1. **Stop everything**: `taskkill /F /IM node.exe`
2. **Pull latest**: `git pull origin main`
3. **Verify files**:
   - `.env` exists with password
   - `host-network-https.ps1` uses `blog-save-server-secure.js`
   - `src/pages/notepad.astro` has `class AuthManager`
4. **Clear browser data**: 
   - Clear cache and localStorage
   - Use incognito/private window for testing
5. **Start fresh**: `start-https-server.bat`
6. **Test**: 
   - Go to https://localhost:4321/notepad
   - Try to save
   - MUST see password prompt

## Expected Behavior When Working

1. User goes to `/notepad`
2. User types content
3. User clicks save
4. **Password modal appears** ← This is what's missing!
5. User enters password from `.env`
6. Save succeeds
7. Future saves work without password (token cached)

## If Still Not Working

The problem might be:
- Old `blog-save-server.js` is hardcoded somewhere
- Port conflict (something else on 4322)
- Notepad isn't actually calling the secure API
- Browser is caching old JavaScript

Nuclear option:
1. Delete `node_modules`
2. Clear ALL browser data for localhost
3. Reboot
4. `npm install`
5. `start-https-server.bat`

## Report Back

After checking all these steps, report which step revealed the problem so we can fix it properly.