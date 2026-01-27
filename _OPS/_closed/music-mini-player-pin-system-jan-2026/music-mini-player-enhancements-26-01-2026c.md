# Music Mini Player - Pin System Session Handoff

## Overview
You're continuing work on the music page (`src/pages/music.astro`) mini player's autonomous pin system. This is a floating music player that can be "pinned" to the page (switches from `position: fixed` to `position: absolute`).

## What This Session Accomplished

### Core Fixes Made

1. **Hockey Puck Bug** - Mini player was shooting up when scrolled
   - Root cause: `getPosition()` returned viewport coords but `setPosition()` expected document coords for pinned mode
   - Fix: `getPosition()` now returns document coords when `isPinned` is true (adds `scrollX/scrollY`)
   - Location: ~line 1762-1774

2. **Drag Offset When Scrolled** - Dragging pinned player was offset
   - Root cause: Drag coords were viewport-based but needed document coords
   - Fix: Added `+ window.scrollX/Y` in mousemove/touchmove handlers when `isPinned`
   - Location: ~line 2028-2035 (mouse), ~line 2109-2116 (touch)

3. **Double-Click Pin Animation** - Now shows pin dropping from above when pinning from viewport mode
   - Location: ~line 1406-1451

4. **Spawn In Viewport** - Mini player always spawns in viewport even if saved position is off-screen
   - Checks if saved position is visible before restoring
   - Falls back to default bottom-right position
   - Location: `loadSavedPosition()` ~line 1901-2000

5. **Pin Tacking Animation on Spawn** - When spawning in pinned state, shows the full pin drop animation
   - Location: ~line 1948-1993

### New Feature: Draggable Pin

The pin can now be grabbed and moved independently. Two scenarios:

**A. Pin on Pinned Card (resting state)**
- Grab the pin head and drag it off the card
- If dropped >30px away: unpins the mini player, pin tacks into the page at drop location
- If dropped within 30px: snaps back to resting position
- Location: ~line 2231-2405

**B. Pin Tacked Into Page**
- Must PULL UPWARD to remove (simulates pulling pin out of page)
- As you pull up, needle gradually emerges (height/opacity animate with pull distance)
- Need to pull 25px before it comes free
- Once free, can drag to:
  - Mini player → re-pins it
  - Elsewhere → tacks into new position
- Location: ~line 2408-2700

### CSS Classes Added

```css
.autonomous-pin.resting    /* On card, grabbable */
.autonomous-pin.dragging   /* Being dragged */
.autonomous-pin.tacked     /* Tacked into page (not on card) */
.autonomous-pin.tacking    /* Playing tack animation */
```

### Key Functions

- `getPosition()` - Returns card position (viewport or document coords based on isPinned)
- `setPosition(x, y)` - Sets card position with bounds checking
- `getPinTargetPosition()` - Where pin wants to be on the card
- `isOverMiniPlayer(x, y)` - Check if point is over the mini player
- `unpinMiniPlayer()` - Convert card to fixed positioning

## Current State / What to Test

1. **Scrolling behavior** - Scroll up/down with pinned player, should stay in place
2. **Drag when scrolled** - Drag pinned player while scrolled down, should follow cursor correctly
3. **Double-click to pin** - Should show pin drop animation
4. **Pull pin from tacked state** - Must pull UP, needle should emerge gradually
5. **Re-pin via dropped pin** - Drag tacked pin onto floating player to re-pin

## Potential Issues to Watch

1. **Coordinate systems** - The codebase juggles viewport vs document coordinates. If something is offset, check if scroll offsets are being added/subtracted correctly.

2. **Touch events** - Changes were made to both mouse and touch handlers. Test on mobile.

3. **Animation timing** - Multiple setTimeout calls for animations. If things look glitchy, check timing.

## File Locations

All code is in `src/pages/music.astro`:
- CSS: ~line 377-1019
- Pin CSS specifically: ~line 708-800
- JavaScript: ~line 1021-2720
- Pin state variables: ~line 1497-1510
- Pin dragging (from card): ~line 2231-2405
- Tacked pin dragging: ~line 2408-2700

## Dev Setup

```bash
npm run dev  # port 4321
# Visit http://localhost:4321/music/
# Play a track to spawn mini player
# Double-click to pin, drag to test
```

## Related Files

- Previous handoffs: `_OPS/_open/music-mini-player-enhancements-26-01-2026a.md` and `b.md`
- Documentation: `docs/music-mini-player.md`
- Main instructions: `CLAUDE.md`

## Session Notes

The user wanted the pin interaction to feel physical and satisfying:
- Pin "tacks" into page with downward animation
- Must pull UP to remove (with resistance)
- Needle emerges gradually as you pull
- Can re-pin by dropping pin on floating player

The coordinate math can get confusing because:
- Fixed positioning = viewport coordinates
- Absolute positioning = document coordinates
- `getBoundingClientRect()` always returns viewport coords
- Mouse/touch events give viewport coords (`clientX/Y`)
