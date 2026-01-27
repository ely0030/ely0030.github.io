# Music Mini Player - Session Handoff (26-01-2026f)

## Overview
Continued work on the music page (`src/pages/music.astro`) mini player. This session focused on fixing pin drag offset issues and changing spawn behavior.

## What This Session Accomplished

### 1. Fixed Pin Drag Offset When Scrolled
**The Problem**: When scrolled down and dragging a pin (either from the card or tacked), the pin position was offset by the scroll amount.

**Root Cause**: After unpinning/untacking, the pin switches from `position: absolute` to `position: fixed`, but we were still calculating document coordinates instead of viewport coordinates for display.

**The Solution**:
- Store document coords in `pinX`/`pinY` for drop detection
- Use viewport coords for `autonomousPin.style.left/top` (display)
- Fixed in 4 places:
  - Resting pin drag (mouse): lines ~2323-2355
  - Resting pin drag (touch): lines ~2497-2527
  - Tacked pin drag (mouse): lines ~2676-2707
  - Tacked pin drag (touch): lines ~2851-2881

### 2. Removed Double-Click to Toggle Pin Mode
- **Location**: Removed the `dblclick` event listener (was ~lines 1453-1548)
- **New behavior**: Mini player always spawns pinned
- **Only way to unpin**: Pull the pin out of the mini player

### 3. Mini Player Spawns Next to Clicked Track
- **Location**: New `spawnNextToTrack()` function (~lines 1969-2007)
- **Behavior**: On first track play, mini player spawns:
  - 20px to the right of the clicked track row
  - Vertically centered with the row
  - Falls back to left side if not enough room on right
  - Clamped to viewport bounds
- **Always pinned**: Uses document coordinates for absolute positioning

### 4. Removed Debug Button
- **Location**: Was lines ~2234-2248
- **Removed**: The "📋 Copy Pin Debug" button and `pinDropLog` array
- **Simplified**: `isOverMiniPlayer()` function no longer has logging parameter

## Key Code Locations

All code is in `src/pages/music.astro`:

| Section | Approx Lines | Description |
|---------|--------------|-------------|
| CSS - Mini player | 664-920 | Shadow states, hover, dragging, pinned, gliding |
| CSS - Pin | 708-840 | Autonomous pin styles, tacking animation |
| CSS - Impact animation | 842-873 | `pin-impact` keyframes, `just-pinned` rule |
| JS - animatePinTack helper | 1912-1967 | Shared pin drop animation |
| JS - spawnNextToTrack | 1969-2007 | New spawn logic |
| JS - loadSavedPosition | 2009-2056 | Load or spawn next to track |
| JS - isOverMiniPlayer | 2234-2246 | Hit detection (simplified) |
| JS - Resting pin drag | 2248-2542 | Pull pin from card |
| JS - Tacked pin drag | 2620-2964 | Pull tacked pin from page |

## Changes Summary

1. **Double-click removed** - Only way to switch modes is pulling the pin
2. **Always spawns pinned** - Mini player uses absolute positioning from the start
3. **Spawns next to track** - First spawn positions next to clicked track row
4. **Pin drag offset fixed** - Viewport coords used during drag, document coords for drop

## What Needs Testing

1. **First spawn**: Click a track - mini player should appear to the right of that row, pinned
2. **Saved position restore**: If saved position is visible, restore there instead
3. **Pin drag when scrolled**: Scroll down, pull pin from mini player - should follow cursor exactly
4. **Tacked pin drag when scrolled**: Same test with a tacked pin
5. **Re-pin via pin drop**: Pull pin, drop on mini player - should re-pin
6. **Tack on page**: Pull pin, drop elsewhere - should tack into page

## Known Issues / Limitations

- Mobile responsiveness of spawn position not thoroughly tested
- If the track row is very wide, the right-side spawn might still be off-screen on narrow viewports

## Dev Setup

```bash
npm run dev  # or npx astro dev --port 4321
# Visit http://localhost:4321/music/
# Click a track to spawn mini player
```

## Session Notes

Main changes from user requests:
1. Fixed pin drag offset when scrolled (was offset by scroll amount)
2. Mini player always spawns pinned, next to clicked track
3. Removed double-click feature - only way to unpin is pulling the pin

The physical metaphor is preserved: the pin holds the card to the page, and you must physically pull it out to free the card.
