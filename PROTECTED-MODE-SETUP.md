# Protected Mode - Complete Site Authentication

**Created**: 2025-01-20
**Purpose**: Prevent ALL access to the blog without password authentication

## Overview

Protected mode makes your ENTIRE blog require authentication, not just editing. This prevents IoT devices or anyone on your network from even viewing your blog content.

## How It Works

1. **Protected HTTPS Proxy** (`https-proxy-protected.cjs`)
   - Intercepts ALL requests before they reach your blog
   - Shows login page if no valid auth cookie
   - Only `/api/login` is accessible without auth
   - Uses httpOnly cookies for security

2. **Cookie-Based Auth**
   - Login sets a secure httpOnly cookie
   - Cookie lasts 24 hours
   - Works automatically with all page requests
   - Same password as notepad editing

## Setup

### Windows (MiniPC)

1. **Quick Start**:
   ```batch
   start-https-server-PROTECTED.bat
   ```

2. **Manual Start** (to see all output):
   ```powershell
   powershell -File host-network-https-protected.ps1
   ```

### Mac/Unix

```bash
./run-dev-protected.sh
```

## First Time Use

1. Start the protected server
2. Navigate to https://localhost:4320 (or your network IP)
3. You'll see a login page immediately
4. Enter password from `.env` file
5. After login, browse normally for 24 hours

## Differences from Normal Mode

| Feature | Normal Mode | Protected Mode |
|---------|------------|----------------|
| View blog posts | ✅ Anyone | 🔒 Password required |
| View any page | ✅ Anyone | 🔒 Password required |
| Edit/save posts | 🔒 Password | 🔒 Password required |
| Login required | Only for editing | For EVERYTHING |
| Login method | Modal popup | Full page login |

## Security Notes

- Uses httpOnly cookies (can't be accessed by JavaScript)
- Cookies are secure (HTTPS only)
- Same password as editing (from `.env`)
- 24-hour expiration
- No way to bypass - proxy blocks all unauthenticated requests

## Switching Modes

### To Protected Mode
- Windows: Run `start-https-server-PROTECTED.bat`
- Mac/Unix: Run `./run-dev-protected.sh`

### To Normal Mode
- Windows: Run `start-https-server.bat`
- Mac/Unix: Run `./run-dev.sh`

## Troubleshooting

### "Cannot connect to server"
- Make sure you killed all node processes first
- Check if ports 4320, 4321, 4322 are free

### Login page not showing
- Clear browser cache/cookies
- Try incognito window
- Check console for errors

### Wrong password error
- Check `.env` file for correct password
- Password is case-sensitive
- No quotes needed in `.env`

### Still seeing content without login
- You might be running normal mode
- Check which proxy is running (should be `https-proxy-protected.cjs`)
- Clear all browser data for localhost

## Testing Protection

1. Open incognito/private window
2. Go to https://localhost:4320
3. Should see login page immediately
4. Try any URL - all should require login:
   - `/` - homepage
   - `/notepad` - editor
   - `/any-blog-post` - all posts

## For Production

This setup is designed for home network protection. For production:
- Consider using Netlify password protection
- Or implement Astro middleware for SSR
- Or use a proper auth service

The current solution is perfect for keeping IoT devices and unauthorized users from accessing your blog on your home network!