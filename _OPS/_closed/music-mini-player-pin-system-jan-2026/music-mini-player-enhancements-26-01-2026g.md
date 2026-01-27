# Music Mini Player - Session Handoff (26-01-2026g)

## Quick Context
You're continuing work on the music page mini player pin system in `src/pages/music.astro`. The mini player is a draggable floating card that can be "pinned" to the page. The pin is a separate DOM element that follows/chases the card.

**Current Status**: Mini player spawn and positioning works correctly. The pin behavior is still glitchy when the page is scrolled down.

## What Was Done This Session

### Changes Made (all in `src/pages/music.astro`):

1. **Removed double-click to toggle pin mode** (~line 1450)
   - The only way to unpin is now to pull the pin out of the mini player
   - Mini player always spawns pinned

2. **Mini player spawns next to clicked track** (~lines 1969-2013)
   - New `spawnNextToTrack()` function positions player 20px to the right of clicked track row
   - `loadSavedPosition()` simplified to always call `spawnNextToTrack()`

3. **Attempted fix for pin drag offset when scrolled**
   - The issue: After unpinning, pin switches from `position: absolute` to `position: fixed`
   - We were setting document coordinates on a fixed-positioned element
   - Fix attempted: Store document coords in `pinX`/`pinY` for drop detection, use viewport coords for display
   - Locations changed:
     - Resting pin drag (mouse): ~lines 2323-2355
     - Resting pin drag (touch): ~lines 2497-2527
     - Tacked pin drag (mouse): ~lines 2676-2707
     - Tacked pin drag (touch): ~lines 2851-2881

4. **Attempted fix for pin drop displacement**
   - Added `autonomousPin.style.left/top = pinX/pinY + 'px'` before tacking
   - Applied to all 4 "tack into page" code blocks (~lines 2426, 2602, 2792, 2968)

5. **Removed debug button** (~was line 2234)
   - Removed "📋 Copy Pin Debug" button and `pinDropLog` array
   - Simplified `isOverMiniPlayer()` function

## What's Still Broken

**Pin behavior when scrolled down is glitchy**. Specific symptoms to investigate:
- When scrolled down, the pin may not follow the cursor correctly during drag
- The drop position may still be offset
- The coordinate system (viewport vs document) gets confused somewhere

## Key Architecture to Understand

### Positioning Modes
- **Mini player unpinned**: `position: fixed` (viewport coords)
- **Mini player pinned**: `position: absolute` (document coords)
- **Pin default**: `position: fixed` (viewport coords)
- **Pin with `.pinned` class**: `position: absolute` (document coords)
- **Pin with `.tacked` class**: `position: absolute` (document coords)
- **Pin with `.dragging` class**: NO position change (inherits from previous state)

### The Core Problem
When you drag a resting pin from a pinned card:
1. Pin starts as `.resting` + `.pinned` → absolute positioned
2. `unpinMiniPlayer()` removes `.pinned` from pin → now fixed positioned
3. During drag, pin should use viewport coords for display
4. On drop, pin gets `.tacked` class → back to absolute, needs document coords

The fix attempted separates:
- `pinX`/`pinY` = document coords (for drop detection and final position)
- `viewPinX`/`viewPinY` = viewport coords (for display during drag)

But something is still wrong.

## Key Code Locations

| Section | Approx Lines | Description |
|---------|--------------|-------------|
| CSS - Pin positioning | 708-760 | `.autonomous-pin`, `.pinned`, `.tacked` classes |
| JS - spawnNextToTrack | 1969-2007 | Spawns player next to clicked track |
| JS - loadSavedPosition | 2009-2013 | Now just calls spawnNextToTrack |
| JS - unpinMiniPlayer | 2261-2272 | Converts pinned → fixed positioning |
| JS - Resting pin drag | 2274-2449 | Pull pin from mini player (mouse) |
| JS - Resting pin drag touch | 2452-2625 | Pull pin from mini player (touch) |
| JS - Tacked pin drag | 2628-2820 | Pull pin from page (mouse) |
| JS - Tacked pin drag touch | 2823-2991 | Pull pin from page (touch) |

## Debugging Approach

1. Add console.log statements to trace:
   - What coords are being calculated during drag
   - What the scroll position is
   - What class the pin has at each stage

2. The `isOverMiniPlayer(x, y)` function (~line 2234) does the viewport conversion:
   ```javascript
   const viewX = x - window.scrollX;
   const viewY = y - window.scrollY;
   ```
   This expects `x`/`y` to be document coords.

3. Check if `pinX`/`pinY` are actually being set to document coords during drag.

## Files to Read First

1. `CLAUDE.md` - Project instructions and known pitfalls
2. `docs/music-mini-player.md` - Architecture documentation
3. `src/pages/music.astro` - All the code (lines 664-3020 are relevant)

## Dev Setup

```bash
cd /mnt/c/Users/Chris/Desktop/Coding\ Projects/ely0030.github.io
npx astro dev --port 4321
# Visit http://localhost:4321/music/
```

## Test Cases

1. **Spawn**: Click a track → mini player should appear to the right of that row, pinned
2. **Drag pinned card when scrolled**: Scroll down, drag the mini player → should work smoothly
3. **Pull pin when scrolled**: Scroll down, pull pin from mini player → pin should follow cursor exactly
4. **Drop pin when scrolled**: Release pin somewhere on page → should tack exactly where released
5. **Tacked pin drag when scrolled**: Pull a tacked pin, move it → should follow cursor exactly
6. **Re-pin via drop**: Pull pin, drop on mini player → should re-pin correctly

## What User Reported Working
- Mini player spawn position (next to clicked track)
- Pin drop displacement seems better

## What User Reported Still Broken
- "Pin still acts glitchy as hell when scrolled down"

Focus on understanding the coordinate system and making sure viewport↔document conversions are happening at the right times.
