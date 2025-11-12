# Music & Tweets Pages - Session Briefing
**Date:** 12-11-2025
**Session:** Initial implementation

## Overview
This session created two new pages for the site:
1. **Tweets page** (`/tweets`) - Displays saved tweets
2. **Music index** (`/music`) - Auto-generated directory listing of music files

---

## 1. TWEETS PAGE (`src/pages/tweets.astro`)

### What We Built
- Minimal page for displaying saved tweets
- Uses Twitter's embed widget
- Content centered vertically on page
- Left-aligned text (not centered)

### Current Structure
```
Title: "Saved Tweets"
├─ Individual file page layout
├─ Uses literature2 pageType
└─ Twitter widget script loads embedded tweets
```

### Key Features
- **Twitter embeds**: Uses `<blockquote class="twitter-tweet">` with official widget script
- **Privacy**: `data-dnt="true"` enabled (Do Not Track)
- **Styling**: Monospace font for page, sans-serif for "direct download" text
- **Error handling**: Script loads with safety checks and error handling

### Important Implementation Details
- **Script loading**: Uses `is:inline` directive for proper Astro handling
- **Fallback content**: Blockquote contains link to tweet if JavaScript fails
- **No "Back to blog" link**: Removed from BlogPost layout for literature2/3 pages

### How to Add More Tweets
Add new `<blockquote>` blocks in the `.tweet-container`:
```html
<blockquote class="twitter-tweet" data-theme="light" data-dnt="true">
    <p lang="en" dir="ltr">
        <a href="https://x.com/username/status/ID">View tweet</a>
    </p>
    &mdash; <a href="https://twitter.com/username">@username</a>
</blockquote>
```

### Added to Index
The tweets page appears in the "downloads/" category on the main index (`src/pages/index.astro`).

---

## 2. MUSIC INDEX (`src/pages/music.astro`)

### What We Built
Auto-generated Apache-style directory listing that:
- Scans `/public/music/` folder at build time
- Shows all audio files (.mp3, .wav, .flac, .ogg, .m4a)
- Displays file info with play buttons
- Allows downloads via clickable file size

### Current Structure
```
Index of /music
├─ .. (parent directory link)
└─ Files (alphabetically sorted)
   ├─ Play button (▶/❚❚)
   ├─ Filename (plain text)
   ├─ Artist (manual mapping)
   ├─ Last Modified (D.M.YY HH:mm)
   └─ Size (clickable blue link for download)
```

### Key Implementation Details

#### Automatic File Scanning
- Reads `/public/music/` directory at build time
- Filters for audio file extensions
- Extracts file metadata (size, modified date)
- Sorts alphabetically by filename

#### Artist Mapping System
**Location:** Top of `src/pages/music.astro` (lines 8-29)

Manual mapping object that assigns artists to files:
```typescript
const artistMap: Record<string, string> = {
    'Filename.mp3': 'Artist Name',
};
```

**Current Artists:**
- **Daniel Caesar**: 18 tracks
- **D'Angelo**: 2 tracks ("c'est la vie (2021) .mp3", "D'angelo - Inst. #5 (rare).mp3")

**How It Works:**
1. File system scan finds actual files
2. Each file checks `artistMap[filename]`
3. If found → displays artist name
4. If not found → displays "-"
5. Pattern matching ensures only real files show up

**To Add New Files:**
1. Drop MP3/audio file into `/public/music/`
2. Add entry to `artistMap` with exact filename
3. Build will automatically pick it up

#### Download Mechanism
- **Filename**: Plain text (not clickable)
- **File size**: Blue clickable link with `download` attribute
- User clicks size → browser downloads file

#### Audio Player
- Single shared `<audio>` element (hidden)
- Play button toggles ▶/❚❚
- **Only one track plays at a time** - clicking new play button stops current track
- State management tracks current row/button

#### Styling & Layout
**Compact Apache aesthetic:**
- Monospace font (SF Mono fallback chain)
- Small font sizes (12px body, 11px headers, 9px play button)
- Tight spacing (5px cell padding, reduced margins)
- Minimal line height (1.4)

**Column Widths:**
- Name: 38%
- Artist: 18% (+ 25px right padding for spacing)
- Last Modified: 22%
- Size: 12%

**Special Formatting:**
- Date format: `D.M.YY HH:mm` (e.g., "10.11.25 09:51")
- Size format: `##.##mb` (lowercase)
- Both dates and artist names: `white-space: nowrap` (no wrapping)

**Parent Row (".."):**
- All cells center-aligned except Name (left) and Artist (left)
- Shows "-" for all metadata columns

**Mobile Responsive:**
- Hides Artist, Modified, Size columns
- Shows only Play button + Name
- Play button slightly smaller (8px)

#### File Page (`src/pages/music/root-of-all-evil.astro`)
Individual file detail page (currently only for Root of all Evil):
- Vertically centered layout
- Filename as title (Courier New, 18px)
- Stock HTML5 audio player (height: 36px for elegance)
- Blue "direct download" link (Arial, not monospace)
- Ultra-minimal: no file info metadata shown

---

## 3. CHANGES TO EXISTING FILES

### `src/pages/index.astro`
Added tweets entry to downloads category:
```javascript
postsByCategory['downloads'].push({
  id: 'tweets',
  data: { title: 'tweets', pubDate: new Date(), category: 'downloads' },
  isArchived: false
});
```

### `src/layouts/BlogPost.astro`
Removed "« Back to blog" link that was showing for literature2/3 pageTypes.

---

## 4. CURRENT STATUS & KNOWN STATE

### Working Features
✅ Music index auto-scans directory
✅ Artist mapping system functional
✅ Single audio playback (stops previous track)
✅ Downloads work via size link
✅ Compact Apache styling applied
✅ Mobile responsive hiding
✅ Date/artist columns don't wrap

### Design Decisions Made
- File size is the download link (unconventional but clean)
- Artist column has extra 25px right padding for visual balance
- Type column removed (redundant with filename extension)
- Dates in European format (D.M.YY)
- All metadata shows "-" for parent directory row

### Files in Public
**Location:** `C:\Users\Chris\Desktop\Coding Projects\ely0030.github.io\public\music\`

**Current count:** 20 audio files
- 18 Daniel Caesar tracks
- 2 D'Angelo tracks

### Potential Issues/TODOs
⚠️ **Artist mapping is manual** - requires updating for each new file
⚠️ **Individual file pages** - Only root-of-all-evil has a detail page. Other files might need these or should remove the link path from music index
⚠️ **Size link color** - Blue color might not match site aesthetic if site theme changes
⚠️ **No back navigation** - Individual file pages have no way back to music index

---

## 5. HOW TO CONTINUE

### Adding More Music
1. Drop files in `/public/music/`
2. Update `artistMap` in `src/pages/music.astro` (lines 8-29)
3. Files auto-appear on next build

### Creating File Detail Pages
If user wants individual pages for each song:
1. Could auto-generate from template
2. Or use dynamic routing with `[...slug].astro`
3. Current approach: manual page creation

### Modifying Spacing/Layout
**If columns feel off-balance:**
- Adjust column widths in `.col-*` classes (lines 176-193)
- Modify artist padding-right (currently 25px, line 183)

**If text wraps:**
- Check `white-space: nowrap` is applied
- May need to reduce column widths

### Testing Checklist
When making changes:
- [ ] Check with 1-2 files
- [ ] Check with 20+ files (current state)
- [ ] Test mobile view (< 1000px)
- [ ] Test play/pause on multiple tracks
- [ ] Test download links work
- [ ] Verify artist mapping updates correctly

---

## 6. FINAL IMPLEMENTATION NOTES (12.11.25 1:45 PM)

**Critical change:** Mobile now uses direct Catbox links, desktop uses service worker.

**Why split:** Service worker initialization timing on mobile caused 9kb corrupted downloads. Mobile browsers have stricter SW lifecycle. Rather than fight browser behavior, mobile bypasses SW entirely.

**Detection:** `src/pages/music.astro:479` checks user agent + screen width ≤ 1000px

**Result:**
- Desktop: instant streaming downloads via SW
- Mobile: opens Catbox page → user taps download (reliable, one extra step)

See `docs/service-worker-download-proxy.md` for technical details.

## 7. RELATED FILES

**Core Files:**
- `src/pages/tweets.astro` - Tweets page
- `src/pages/music.astro` - Music index (auto-generated)
- `src/pages/music/root-of-all-evil.astro` - Individual file page
- `src/pages/index.astro` - Main index (links to music/tweets)
- `src/layouts/BlogPost.astro` - Layout used by all above

**Asset Location:**
- `public/music/*.mp3` - All music files

**Documentation:**
- `CLAUDE.md` - Main project context (mentions music/notepad pages)

---

## 8. USER PREFERENCES OBSERVED

- Likes **minimal, compact layouts** (Apache directory aesthetic)
- Prefers **monospace fonts** for technical content
- Values **pragmatic functionality** over decoration
- Wants **exact control** over spacing and alignment
- Appreciates **iterative refinement** ("more", "25px", etc.)
- Expects **things to work robustly** out of the box

---

## Questions for Next Session
If user continues work on this:
1. Should all music files have individual detail pages?
2. Is the "file size = download" approach working long-term?
3. Does the artist mapping need a better system (config file, JSON)?
4. Should there be pagination for many files?
5. Does the individual file page need back navigation to music index?
