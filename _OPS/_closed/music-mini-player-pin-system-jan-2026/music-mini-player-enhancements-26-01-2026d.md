# Music Mini Player - Pin System Session Handoff

## Overview
Continuing work on the music page (`src/pages/music.astro`) mini player's autonomous pin system. This is a floating music player that can be "pinned" to the page (switches from `position: fixed` to `position: absolute`).

## What This Session Accomplished

### 1. Unified Tacking Animation
The pin now has a consistent diagonal tacking animation that matches the 15deg needle angle:
- **CSS keyframes updated** (~line 760-776): `pin-tack-into-page` now moves diagonally (down + left) instead of just vertically
- **Needle shrinks as pin enters**: CSS transition on `.tacking .pin-needle` makes needle disappear as it "enters" the surface

### 2. Pull-Up Resistance for Pin Removal
Pulling the pin from the card now works identically to pulling from the page:
- Must pull **UP** with resistance (not just drag away)
- Needle emerges gradually as you pull (0 → 15px based on pull distance)
- Pin lifts as you pull (0 → 8px)
- Rotation increases (0 → 15deg)
- Once pulled 25px, pin comes free and mini player unpins immediately
- Location: ~lines 2300-2490 (PIN DRAGGING FROM CARD section)

### 3. Re-pinning When Dropping on Mini Player
**Critical fix**: When pulling pin from card and dropping it back on/near the card, it now properly re-pins instead of just tacking into the page.
- Added `isOverMiniPlayer()` check to pin drag from card handlers
- Both mouse (~line 2413) and touch (~line 2572) handlers updated
- Uses same tacking animation when re-pinning

### 4. Generous Hit Area for Re-pinning
- `isOverMiniPlayer()` function has 40px padding around the mini player
- Makes it much easier to drop pin on/near card to re-pin
- Location: ~line 2266-2298

### 5. Debug System (STILL IN CODE - REMOVE WHEN DONE)
Added debug button "📋 Copy Pin Debug" in bottom-left corner:
- Logs each pin drop attempt with coordinates, hit area, and result
- Click button to copy JSON to clipboard
- Location: ~lines 2250-2264
- **TODO**: Remove this debug code once pin system is fully tested

## Current Code Structure

All code is in `src/pages/music.astro`:
- **CSS**: ~line 377-1073
- **Pin CSS**: ~line 708-860
- **Tacking keyframes**: ~line 760-785
- **JavaScript**: ~line 1075-2890
- **Debug + isOverMiniPlayer**: ~line 2250-2298
- **Pin drag from card (pull-up)**: ~line 2300-2645
- **Tacked pin dragging**: ~line 2647-2890

## Key Functions

- `isOverMiniPlayer(x, y, logIt)` - Check if point is within 40px of mini player
- `unpinMiniPlayer()` - Convert card from absolute to fixed positioning
- `getPinTargetPosition()` - Where pin should rest on card (top-right area)
- `getPosition()` / `setPosition()` - Get/set card position (handles viewport vs document coords)

## What Needs Testing

1. **Pull pin from card** - Must pull UP, needle should emerge gradually, mini player floats when free
2. **Drop pin back on card** - Should re-pin with tacking animation
3. **Drop pin near card (within 40px)** - Should also re-pin
4. **Drop pin away from card** - Should tack into page
5. **Pull tacked pin from page** - Same pull-up feel
6. **Drop pulled pin on floating mini player** - Should re-pin with tacking animation
7. **Double-click to pin** - Pin drops from above, then tacks in with animation
8. **Double-click to unpin** - Pin hides, card floats

## Potential Issues to Watch

1. **Coordinate systems** - The code juggles viewport vs document coordinates. If something is offset when scrolled, check if scroll offsets are being added/subtracted correctly.

2. **Touch events** - All changes were made to both mouse and touch handlers. Test on mobile.

3. **Animation timing** - Multiple setTimeout calls for animations. If things look glitchy, check timing.

## Dev Setup

```bash
npm run dev  # port 4321
# Visit http://localhost:4321/music/
# Play a track to spawn mini player
# Double-click to pin, then test pin interactions
```

## Files Changed This Session

- `src/pages/music.astro` - All pin system code

## Related Handoffs

- Previous: `_OPS/_open/music-mini-player-enhancements-26-01-2026c.md`
- Documentation: `docs/music-mini-player.md`
- Main instructions: `CLAUDE.md`

## Session Notes

The user wanted:
1. Tacking IN animation to match pulling OUT (same diagonal angle, same physical feel)
2. Immediate visual feedback when pulling pin from card (mini player floats as soon as pin comes free)
3. Forgiving hit detection for dropping pin on/near card to re-pin

The 15deg angle is important because that's the needle rotation - the pin should enter/exit surfaces at that angle for realism.
