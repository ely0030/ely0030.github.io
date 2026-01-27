# Music Mini Player - Session Handoff (26-01-2026h)

## Quick Context
You're continuing work on the music page mini player pin system in `src/pages/music.astro`. The mini player is a draggable floating card that can be "pinned" to the page. The pin is a separate DOM element that follows/chases the card.

**Current Status**: The coordinate system issues when scrolled are resolved. The remaining issue is a **shadow flash on initial spawn**.

## What Was Done This Session

### 1. Fixed Coordinate System Issues (WORKING)

The core problem was that conversions between viewport coordinates (`position: fixed`) and document coordinates (`position: absolute`) weren't happening at the right times.

**The Fix Pattern**: Always set the position mode (via inline style or class) BEFORE setting coordinates.

#### Drop/Tack fixes (4 locations):
When dropping a pin to tack it into the page, we now set `position: absolute` inline BEFORE setting document coords:
```javascript
// CRITICAL: Set position to absolute BEFORE setting document coords
autonomousPin.style.position = 'absolute';
autonomousPin.style.left = pinX + 'px';
autonomousPin.style.top = pinY + 'px';
// ... then add .tacked class later, clear inline position
```

Locations: ~lines 2385, 2572, 2755, 2932

#### Lift fixes (4 locations):
When lifting a pin (from tacked or resting state), we now set `position: fixed` and viewport coords BEFORE removing the class:
```javascript
// CRITICAL: Set fixed position and viewport coords BEFORE removing class
const viewPinX = e.clientX - 10;
const viewPinY = e.clientY - 5;
autonomousPin.style.position = 'fixed';
autonomousPin.style.left = viewPinX + 'px';
autonomousPin.style.top = viewPinY + 'px';
// NOW safe to remove class
autonomousPin.classList.remove('tacked');
```

Locations: ~lines 2271, 2457, 2644, 2830

#### Re-pin fixes (4 locations):
When dropping pin back on mini player, we convert viewport coords to document coords BEFORE switching to absolute:
```javascript
// CRITICAL: Convert pin's current viewport position to document coords
const pinRect = autonomousPin.getBoundingClientRect();
const pinDocX = pinRect.left + window.scrollX;
const pinDocY = pinRect.top + window.scrollY;
autonomousPin.style.left = pinDocX + 'px';
autonomousPin.style.top = pinDocY + 'px';
// Now safe to switch to absolute positioning
autonomousPin.style.position = '';
autonomousPin.classList.add('pinned');
```

Locations: ~lines 2343, 2528, 2727, 2911

### 2. Added Spawning Shadow (NEEDS WORK)

Added a `.spawning` CSS class for subtle shadow on initial appearance:
```css
.mini-player.pinned.spawning {
    box-shadow:
        0 1px 4px rgba(0, 0, 0, 0.09),
        0 0 2px rgba(0, 0, 0, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    transition: box-shadow 0.25s ease-out;
}
```

Location: ~line 697-704

Changed `spawnNextToTrack()` to use `.spawning` instead of `.gliding`:
```javascript
miniPlayer.classList.add('pinned', 'spawning', 'dragged');
```

Location: ~line 2005

### 3. Changed Spawn Order (CAUSING ISSUES)

Modified `updateMiniPlayerWithPosition()` to use `visibility: hidden` trick:
```javascript
const updateMiniPlayerWithPosition = () => {
    const wasHidden = miniPlayer.classList.contains('hidden');
    if (wasHidden) {
        // Remove display:none but keep invisible for dimension calculations
        miniPlayer.classList.remove('hidden');
        miniPlayer.style.visibility = 'hidden';
    }
    originalUpdateMiniPlayer();
    if (wasHidden) {
        // Position and animate (player has dimensions now)
        loadSavedPosition();
        // Now make visible - pinned state is already set
        miniPlayer.style.visibility = '';
    }
};
```

Location: ~line 3032-3050

## What's Still Broken

**Shadow flash on spawn**. The user reports:
1. Mini player spawns without a shadow
2. Gets a shadow
3. Gets tacked and the shadow disappears again

This creates a jarring flash effect. The transitions between shadow states aren't smooth.

## Root Cause Analysis

The issue is likely timing-related:
- The `.spawning` class adds a subtle shadow
- The base `.pinned` class has minimal shadow
- The `animatePinTack()` function removes `.spawning` after the tack animation
- But somewhere in the spawn sequence, these states are fighting

Possible causes:
1. The `visibility: hidden` → `visibility: ''` transition might be triggering reflows that cause flashes
2. The shadow transition timing doesn't align with when classes are added/removed
3. The initial state before `.spawning` is applied has no/different shadow

## Suggested Next Steps

1. **Debug the spawn sequence**: Add console.logs to trace exactly when each class is added/removed and when the player becomes visible

2. **Consider removing `.spawning` entirely**: The user may prefer no special spawn shadow at all - just appear flat immediately

3. **Alternative approach**: Instead of CSS transitions for the shadow, maybe fade in the entire mini player with opacity

4. **Check `animatePinTack()` timing**: The function at ~line 1922 handles the pin drop animation. The cleanup at ~line 1973 removes `.spawning`. Make sure this timing aligns with user expectations.

## Key Code Locations

| Section | Approx Lines | Description |
|---------|--------------|-------------|
| CSS - Spawning shadow | 697-704 | `.mini-player.pinned.spawning` class |
| CSS - Pinned shadow | 688-695 | `.mini-player.pinned` class |
| JS - spawnNextToTrack | 1978-2016 | Spawns player next to clicked track |
| JS - animatePinTack | 1922-1976 | Pin drop animation, removes .spawning at end |
| JS - updateMiniPlayerWithPosition | 3032-3050 | Controls spawn visibility sequence |
| JS - loadSavedPosition | 2018-2022 | Just calls spawnNextToTrack() |

## Dev Setup

```bash
cd /mnt/c/Users/Chris/Desktop/Coding Projects/ely0030.github.io
npm run dev -- --port 4321
# Visit http://localhost:4321/music/
```

## Test Cases

1. **Spawn (the broken one)**: Refresh page, click a track → watch for shadow flash
2. **Pull pin when scrolled**: Scroll down, pull pin from mini player → should work smoothly now
3. **Drop pin when scrolled**: Release pin somewhere on page → should tack correctly now
4. **Re-pin via drop**: Pull pin, drop on mini player → should animate smoothly from cursor to tack spot

## Files to Read First

1. `CLAUDE.md` - Project instructions and known pitfalls
2. `docs/music-mini-player.md` - Architecture documentation (may be slightly outdated after this session)
3. `src/pages/music.astro` - All the code

## What User Wants

A clean, non-jarring spawn experience. Either:
- No shadow animation at all (spawn flat)
- OR a very subtle, smooth shadow that fades seamlessly

The current implementation flashes between states which looks glitchy.
