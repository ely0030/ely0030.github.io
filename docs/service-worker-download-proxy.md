# Service Worker Download Proxy

**Last Updated:** 12.11.25 1:22 PM

## The Problem

External file hosts (Catbox, etc.) don't send `Content-Disposition: attachment` headers, so browsers treat links as navigation instead of downloads. Cross-origin security prevents adding these headers client-side.

**Failed approaches:**
1. **Netlify Functions** - 6MB response limit, files are 8-12MB
2. **Client-side fetch + blob** - Works but buffers entire file into memory first = 20-30 second wait with no feedback
3. **Direct links with `download` attribute** - Browser ignores for cross-origin URLs

## The Solution: Service Workers

Service workers run in a different security context and can modify response headers for same-origin requests before the browser processes them.

**Key insight:** Service worker intercepts a same-origin URL (`/download-proxy/`), fetches from external host, returns response with modified headers. Browser sees same-origin response with download headers → instant download with streaming.

## How It Works

```
User clicks /download-proxy/?url=https://files.catbox.moe/abc.mp3&filename=Song.mp3
         ↓
Service Worker intercepts request
         ↓
SW fetches from Catbox (streams, doesn't buffer)
         ↓
SW adds Content-Disposition: attachment header
         ↓
Browser receives same-origin response → starts download immediately
         ↓
File streams through SW to browser (shows native download progress)
```

## Files

**`public/download-sw.js`** - Service worker script
- Intercepts `/download-proxy/` requests
- Security: only allows `files.catbox.moe` URLs
- Streams response body through without buffering (critical for large files)
- Uses `response.body` directly → memory efficient

**`src/pages/music-catbox.astro`** - Example implementation
- Registers service worker on page load
- Download links use `/download-proxy/?url=...&filename=...` format
- No JavaScript download handlers needed - native browser downloads

## Important Non-Obvious Details

### 1. Service Worker Activation
**First visit:** SW installs but doesn't control the page yet. Downloads work on second load or after manual refresh.

**Solution used:** `self.skipWaiting()` + `clients.claim()` makes SW activate immediately, but browser still needs one navigation to use it.

**For production:** Could show "Activating downloads..." banner on first visit.

### 2. Response Body Streaming
```javascript
return new Response(response.body, { ... })
```

Passing `response.body` directly (not `await response.blob()`) is critical. This streams the download through the SW without buffering entire file into memory. Makes 8MB files feel instant.

### 3. Same-Origin Requirement
Service workers only work on HTTPS or localhost. GitHub Pages and Netlify both use HTTPS → works in production.

### 4. CORS Still Applies to SW
Service worker fetch to Catbox still subject to CORS, BUT:
- Catbox allows CORS (proven by audio player working)
- SW can modify response headers for same-origin response to page
- Browser trusts SW-modified headers

### 5. Why Not Just Use Catbox's Download URL?
Tested `catbox.moe/d/`, `catbox.moe/dl/` - don't exist. Catbox only provides `files.catbox.moe/` which streams without download headers.

## Security

Service worker validates:
- Only processes `/download-proxy/` URLs
- Only allows `files.catbox.moe` domain (prevents proxy abuse)
- All parameters validated before fetch

## Production Deployment

**Works on:**
- Netlify (static hosting + HTTPS)
- GitHub Pages (static hosting + HTTPS)
- Any HTTPS static host

**Doesn't work on:**
- HTTP sites (SW requires secure context)
- File:// protocol (no SW support)

Service worker file (`public/download-sw.js`) is served as a static asset, no build configuration needed.

## Performance

**Before (client-side fetch):** 20-30s wait → download starts
**After (service worker):** Click → instant browser download with streaming

User sees browser's native download progress immediately instead of page showing "downloading..." with no feedback.

## Alternative Considered: Web Workers

Web Workers can't intercept fetch requests or modify headers. Only Service Workers have this capability.
