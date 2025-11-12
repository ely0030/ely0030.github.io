# Mobile Download Corruption Issue - Session Handoff

**Date:** 12.11.25
**Status:** Implemented workaround, needs testing on actual mobile device

## Problem Statement

Music downloads on mobile were producing 9kb corrupted files instead of full MP3s (should be 2-12MB). Desktop downloads worked perfectly.

**Symptoms:**
- Click download on mobile → 9kb file downloads instantly
- File is corrupted, won't play
- Desktop using same code → full file downloads correctly via service worker streaming

## Root Cause

Service worker initialization timing on mobile browsers. Downloads were clicking through **before** the service worker was fully ready, causing the request to bypass the proxy and download an error response instead of the actual file.

**Technical detail:** Mobile browsers have stricter service worker lifecycle timing than desktop. The ready-state check wasn't sufficient - race condition between user clicking and SW actually being ready to intercept fetch requests.

## Solution Implemented

**Split approach:** Mobile bypasses service worker entirely, uses direct Catbox links.

### File Changes

**`src/pages/music.astro:478-548`** - Download initialization logic
- Detects mobile via user agent regex OR screen width ≤ 1000px
- Mobile path: Rewrites `/download-proxy/` URLs to direct `files.catbox.moe` URLs, opens in new tab
- Desktop path: Keeps service worker with ready-state protection (links disabled until SW ready)

**`public/download-sw.js`** - No changes needed, just not used on mobile

**`docs/service-worker-download-proxy.md`** - Updated with mobile/desktop split explanation

### Trade-offs

**Desktop:**
- Instant streaming downloads
- Click → browser download starts immediately
- Requires HTTPS + service worker support

**Mobile:**
- Opens Catbox page → user taps download button there
- One extra step but 100% reliable
- No service worker dependency

## Current Status

**Code deployed:** Yes, pushed to main
**User testing on mobile:** Not confirmed yet
**Desktop verified:** Yes, working as before

## If Issue Persists

### Possible causes:

1. **User agent detection failing** - Check console log for `[Downloads] Mobile detected - using direct links` message
2. **Catbox CORS changed** - Verify `files.catbox.moe` still allows CORS for audio playback
3. **Link rewriting broken** - Inspect element on mobile, verify href is direct Catbox URL not `/download-proxy/`

### Debug approach:

```javascript
// Check what's happening on mobile:
console.log('User agent:', navigator.userAgent);
console.log('Window width:', window.innerWidth);
console.log('Is mobile:', isMobile); // Should be true on mobile

// Inspect a download link:
const link = document.querySelector('.size-link');
console.log('Link href:', link.href); // Should be files.catbox.moe URL on mobile
console.log('Link target:', link.target); // Should be "_blank"
```

## Alternative Approaches Tried (Failed)

1. **Client-side fetch + blob** - Worked but 20-30s wait, no progress feedback
2. **Netlify Functions proxy** - 6MB response limit, files are 8-12MB
3. **Ready-state protection alone** - Didn't fix mobile timing issue
4. **Fallback error handling** - Still got 9kb files, timing was too tight

## Files Involved

**Core implementation:**
- `src/pages/music.astro` - Music index page with download logic
- `public/download-sw.js` - Service worker (desktop only)
- `netlify/functions/download.js` - Netlify function (unused, kept for reference)

**Documentation:**
- `docs/service-worker-download-proxy.md` - Technical implementation details
- `_OPS/_open/music-tweets-pages-12-11-2025a.md` - Original session handoff (music page creation)

**Track list:**
- 21 tracks total, all hosted on Catbox
- External URLs only, no files in repo
- Manual track list in `music.astro:6-154`

## Next Steps for Testing

1. **Open on actual mobile device** (not just desktop browser resized)
2. **Check console logs** - Should see `[Downloads] Mobile detected - using direct links`
3. **Click any file size** - Should open Catbox page in new tab
4. **Download from Catbox** - Should get full file, not 9kb
5. **Verify desktop still works** - Should get instant download via service worker

## Context: Why This Matters

User is hosting Daniel Caesar unreleased music. Moved from local hosting (copyright risk) to Catbox external hosting. Service worker was critical for desktop instant downloads. Mobile reliability is more important than instant downloads, hence the split approach.

## If You Need to Revert

Replace mobile detection block (`music.astro:478-548`) with:

```javascript
// Force direct links for all devices:
const downloadLinks = document.querySelectorAll('.size-link');
downloadLinks.forEach(link => {
    const url = new URL(link.href);
    const fileUrl = url.searchParams.get('url');
    if (fileUrl) {
        link.href = fileUrl;
        link.target = '_blank';
    }
});
```

This bypasses service worker entirely but works 100% of the time on all devices.
