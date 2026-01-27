# Music Mini Player - Autonomous Pin System

## File Location
All code in `src/pages/music.astro`:
- HTML: ~line 345-348 (autonomous pin), ~line 350-380 (mini player)
- CSS: ~line 708-760 (autonomous pin styles)
- JS: ~line 1431-1580 (pin logic)

## Architecture

The pin is a **separate DOM element** from the mini player. This is critical - it allows the pin to move independently.

```html
<!-- Pin lives OUTSIDE mini player -->
<div id="autonomous-pin" class="autonomous-pin hidden">
    <div class="pin-head"></div>
    <div class="pin-needle"></div>
</div>
<div id="mini-player" class="mini-player hidden">...</div>
```

## Pin Behavior States

1. **Chasing** - follows mini player, speed scales with card speed
2. **Gave up** - card too fast (>6 speed), follows lazily
3. **Running** - card stopped, pin dart-throws to tack spot

## Non-Obvious Design Decisions

### Repulsion Field Centered on Card, Not Tack Spot
`getCardCenter()` vs `getPinTargetPosition()` - repulsion uses card center so the field is uniform from all sides. Otherwise left side would feel weaker since tack spot is top-right.

### Velocity Smoothing for Anti-Jitter
When pin is left of card, chase (toward right tack spot) and repulsion (away from center) conflict. `pinVelX/pinVelY` with 70/30 blend smooths this.

### Asymptotic Slowdown with "Immensifier"
When BOTH card speed is low AND pin is close, slowdown multiplies dramatically (up to 95% reduction). Pin "knows" tack animation will cover the distance.

```javascript
const immensifier = 1 - (lowInertia * closeDistance * 0.95);
```

### Speed Factor Squared
`adjustedSpeedFactor = speedFactor * speedFactor` - makes low speeds exponentially slower. At 50% card speed → 25% chase urgency.

### Distance Field Weakens at High Speed
`adjustedDistanceFactor = distanceFactor + (1 - distanceFactor) * speedFactor` - when card has high inertia, asymptotic field effect is reduced so pin chases more actively.

## Key Constants (line ~1444-1449)

| Constant | Value | Purpose |
|----------|-------|---------|
| PIN_GIVEUP_SPEED | 6 | Card speed where pin gives up active chase |
| PIN_RUN_SPEED | 0.15 | Normal chase speed (ratio/frame) |
| PIN_LAZY_SPEED | 0.03 | Chase speed when "gave up" |
| PIN_WAIT_DISTANCE | 350 | Asymptotic field radius |
| PIN_REPULSION | 1.2 | Repulsion strength when card approaches |

## Pin Visual States (CSS)

- `.resting` - needle hidden (height: 0), on card
- `.gave-up` - reduced opacity (0.7)
- Default (chasing) - needle visible, 15deg tilt

## Pin Mode Switching

**No double-click toggle** - the only way to unpin is to pull the pin out of the mini player.

### Always Spawns Pinned
When you click a track to play, the mini player:
- Spawns next to the clicked track (20px to the right)
- Uses `position: absolute` (scrolls with page)
- Pin drops in with animation

### Unpinning (Pull Pin Out)
To switch to floating mode:
- Click and drag the pin upward from the mini player
- Once threshold reached (~25px), pin comes free and card unpins
- Card switches to `position: fixed` (floats in viewport)
- Pin follows cursor and can be dropped on card to re-pin

### Re-pinning
Drop the pin back on the mini player:
- Pin slides to tack position
- Card switches back to `position: absolute`
- Tacking animation plays

## Pin Lift Animation

When you click and drag, pin lifts out of card with snappy pop-out:

```javascript
// Force reflow between position set and transition start
autonomousPin.style.transition = 'none';
// ... set starting position ...
autonomousPin.offsetHeight; // force reflow
autonomousPin.style.transition = '...'; // now animate
```

**Why `pinIsLifted` state**: Without it, `updateAutonomousPin()` immediately resets to resting state if distance < 8. The flag prevents this during drag.

## Shadow State System

**Critical**: Base `.mini-player` has `transition: box-shadow 0.2s`. This causes glitches when states change rapidly. Fix: `transition: none` on `.dragging` and `.gliding` classes.

| State | Shadow | Notes |
|-------|--------|-------|
| Unpinned resting | moderate | Default floating |
| Unpinned dragging | large | Being held up |
| Unpinned gliding | moderate | Hockey puck mode, NOT elevated |
| Pinned resting | minimal | Tacked flat to page |
| Pinned dragging/gliding | large | Lifted off page |

## Impact Animation (Tacking)

**Not a button press** - it's a tack motion. Key differences:
- Press DOWN and STAY slightly down (doesn't bounce back to full height)
- End state: `translateY(1px) scale(0.995)` - card stays "held down"
- Shadow goes to zero at impact, stays minimal

**Timing fix**: Remove `.gliding` class AT SAME TIME as adding `.just-pinned` to avoid shadow flash between states.

## Spawn Behavior

### No Shadow on Spawn
Card spawns with `boxShadow: none` and `transition: none` inline. Why:
- Base `.mini-player` has large shadow, `.pinned` has small shadow
- Even with `.pinned` class, browser briefly shows base shadow on visibility change
- Fix: Force no shadow until pin tack animation completes (~320ms), then clear inline styles

```javascript
// spawnNextToTrack()
miniPlayer.style.transition = 'none';
miniPlayer.style.boxShadow = 'none';
// ... position card ...
animatePinTack(true);  // isSpawn=true skips impact animation
```

### `isSpawn` Parameter
`animatePinTack(isSpawn)` - when `true`, skips `.just-pinned` impact animation. Impact assumes card was elevated (dragging/gliding), but spawned cards start flat. Playing impact on spawn causes shadow flash (keyframe starts with elevated shadow).

## Mid-Flight Grab

### Pin Continues Chasing (No Teleport)
When grabbing card mid-flight, `onCardStartMoving()` checks `alreadyChasing`:

```javascript
const alreadyChasing = pinIsLifted || !autonomousPin.classList.contains('resting');
if (alreadyChasing) {
    // Don't reset pinX/pinY - let pin continue from current position
    return;
}
```

Without this, grabbing a gliding card teleports the pin to the tack spot instantly (jarring). With the check, pin smoothly continues its chase from wherever it currently is.

## Re-pinning (Dropping Pin Back on Card)

### Two Different Impact Animations
**Critical**: `pin-impact` vs `pin-impact-from-float` exist because animation 0% must match card's current shadow.

| Animation | 0% Shadow | Used When |
|-----------|-----------|-----------|
| `pin-impact` | Elevated (0 12px 48px) | Auto-tack from `.pinned.gliding` |
| `pin-impact-from-float` | Unpinned (0 4px 24px) | Manual re-pin from floating |

If you use wrong animation, shadow jumps to 0% state = flash.

### Manual Re-pin Flow (4 handlers: mouse/touch × pin drag/card drag)

**Critical**: No slide animation. Pin goes directly to target position. This prevents teleport/flash bugs when scrolled.

```javascript
stopAnimation();
miniPlayer.classList.remove('gliding', 'dragging');

// Calculate target position in document coords
const cardDocX = parseFloat(miniPlayer.style.left) || 0;
const cardDocY = parseFloat(miniPlayer.style.top) || 0;
pinX = cardDocX + cardWidth - 25;
pinY = cardDocY + 8;

// Pin to absolute at target (no transition)
autonomousPin.style.position = '';
autonomousPin.classList.add('pinned');
autonomousPin.style.left = pinX + 'px';
autonomousPin.style.top = pinY + 'px';

// Pin card and play tacking animation immediately
miniPlayer.classList.add('pinned');
miniPlayer.classList.add('just-pinned-from-float');
isPinned = true;
// ... tacking animation ...
```

### Why No Slide Animation
Old code used 120ms slide with delayed `isPinned = true`. This caused:
1. **Teleport bug**: `getPinTargetPosition()` returned wrong coords when `isPinned` was still false
2. **Flash bug**: `updateAutonomousPin()` could add `.hidden` during the async window

Fix: Match the Title/Artist tacking pattern - instant positioning, immediate state changes.

## Loop Mode (Track/Artist)

Drop pin on track name → track loops. Drop on artist name → cycles through artist's tracks.

### Text Width Detection
Uses canvas `measureText()` to detect actual text bounds, not container width. Pin only activates where text exists.

```javascript
const getTextWidth = (element) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = getComputedStyle(element).font;
    return ctx.measureText(element.textContent).width;
};
```

### Pin Position Memory
`loopPinOffsetX/Y` stores offset from card. When card moves and stops, pin returns to same relative position (not standard tack spot).

### State Variables
| Variable | Purpose |
|----------|---------|
| `loopMode` | Track loop active |
| `artistLoopMode` | Artist loop active |
| `loopArtist` | Artist name string to match |
| `loopPinOffsetX/Y` | Pin offset from card corner |

## Table Pin Drops

Pin can be dropped on track/artist names in the main table (not just mini player).

### Hitbox Tuning
`shrinkBottom=3` - vertical hitbox shrunk 3px from bottom to prevent activating when clicking below text. Found through iteration (8→0→4→2→3).

### Queue System
Pinning a *different* track/artist on table queues it instead of playing immediately.

| Variable | Purpose |
|----------|---------|
| `queuedLoopRow` | Queued track row element |
| `queuedLoopArtist` | Queued artist name string |

**Mutual exclusion**: Setting one clears the other. Only one queue type at a time.

**Visual indicators**: Two separate elements in HTML:
- `.mini-track-queued` after track name → `song.mp3 → queued.mp3`
- `.mini-artist-queued` after artist name → `Artist → Queued Artist`

**Why separate elements**: Can't move one element dynamically - simpler to have two and show/hide.

**Next/Prev button behavior** (both identical):
- Queued track → plays queued track, activates track loop
- Queued artist → plays first track by artist, activates artist loop
- In track loop mode → replays same track
- In artist loop mode → cycles through same artist's tracks only

Loop symbol hidden while queued (appears after transition).

### Robustness

**DOM validation**: Before using `queuedLoopRow`, check `document.contains(queuedLoopRow)`. Rows can be deleted from table while queued.

**Artist name normming**: All artist comparisons use `.trim()`. Whitespace differences between mini player and table would break matching otherwise.

## Pin Return from Table

When pin is on table and user clicks different track, pin flies back to mini player.

### Critical: Pin Mini Player First
Must convert mini player from fixed→absolute BEFORE calling `getPinTargetPosition()`. Otherwise coords are wrong.

```javascript
if (!isPinned) {
    const rect = miniPlayer.getBoundingClientRect();
    const docX = rect.left + window.scrollX;
    const docY = rect.top + window.scrollY;
    isPinned = true;
    miniPlayer.classList.add('pinned');
    // ... set position with docX/docY
}
const target = getPinTargetPosition(); // NOW returns document coords
```

### Card Moving vs Stationary
| Card State | Pin Behavior |
|------------|--------------|
| Stationary | Fly-and-tack animation directly to mini player |
| Moving | Enter chase mode, set `pinGaveUp=true` for lazy approach |

`pinGaveUp=true` set AFTER `onCardStartMoving()` (which resets it to false). Gives "assessing from afar" feel instead of UFO-like rush.

### Interference Prevention
`pinReturningFromTable` flag prevents `updateAutonomousPin()` and `onCardStopped()` from overriding the custom return animation.

### Waiting State (Card Moving When Pin Returns)

When pin returns from table while card is moving, it enters a **waiting state** instead of immediately chasing.

**Behavior**: Pin makes one attempt toward the card, coasts to a stop, then waits still until card stops.

**Why**: Prevents UFO-like behavior where pin rushes at moving card then halts abruptly.

**State flags** (line ~1672-1675):
| Flag | Purpose |
|------|---------|
| `pinWaitingForSlowdown` | Pin is waiting for card to stop |
| `pinMadeAttempt` | Pin already made its initial move |
| `pinRunLoopActive` | Guards against multiple animation loops |

**Flow**:
1. `animatePinReturnToMiniPlayer()` detects card is moving → sets `pinWaitingForSlowdown = true`
2. `updateAutonomousPin()` sees flag → pin makes one impulse toward target, then coasts to stop
3. Card stops → `onCardStopped()` sees `wasWaiting = true` → sets `pinIsRunning = true`, adds `gliding` class for elevated shadow
4. `runLoop` animation starts → pin chases at full speed
5. Pin reaches target → tack animation plays

**Critical: Shadow during chase**
Card gets `gliding` class when entering running mode (line ~2057). This gives elevated shadow while pin approaches. Without it, card looks flat (wrong) because actual gliding already ended.

**State resets** (prevent stale flags):
- `onCardStartMoving()` clears `pinIsRunning`, `pinWaitingForSlowdown`, `pinMadeAttempt` (line ~1928-1931)
- `onCardMoving()` transitions back to waiting if card speeds up during chase (line ~2019-2026)

## Z-Index Layering

| Element | Z-Index | Notes |
|---------|---------|-------|
| Mini player | 1000 | Always |
| Pin (default) | 1001 | Above card when flying |
| Pin `.on-table` | 999 | Below card when tacked to table |

`.on-table` class added/removed with `pinOnTable` state changes (8 add locations, 2 remove locations).

## Bounds Safety

`ensureInReachableBounds()` called after inertia ends. Absolutely positioned elements don't extend scrollHeight, so card could end up unreachable. Function smoothly animates back if outside bounds.

## Mobile Touch Support

### Touch Loupe (Magnifying Glass)
Shows magnified view of page under thumb when dragging pin on mobile.

**Why DOM cloning (not canvas)**: Canvas would require re-rendering all page content. Cloning preserves exact styling and layout with just CSS transforms.

```javascript
// Clone from content area, not full page (avoids mini player duplication)
const mainContent = document.querySelector('.prose-content') || document.querySelector('main') || document.body;
loupeClone = mainContent.cloneNode(true);
```

**Magnification math** (line ~3148-3151):
```javascript
// scale(S) translate(X,Y) - translate happens in scaled space
const translateX = (loupeCenterX - relPinX * LOUPE_SCALE) / LOUPE_SCALE;
```

**Pin indicator positioning**: Needle TIP at loupe center (drop point), head sits above. `transform: translate(-50%, -100%)` on crosshair element. Head offset 6px right to align with 15deg needle tilt.

**Edge clamping** (line ~3146-3148): Loupe stays 10px from all viewport edges. Accounts for `translateX(-50%)` centering in horizontal bounds.

### touchcancel Handlers
**Critical for robustness**. All 4 touch interactions have touchcancel handlers:
- Progress bar scrubbing (line ~1992)
- Mini player drag (line ~2979)
- Pin drag from resting (line ~4405)
- Tacked pin drag (line ~5185)

Without these, interrupted touches (incoming call, system gesture) leave drag state stuck and loupe visible.

### Touch Guards
All touchmove handlers check `if (!e.touches.length) return` to prevent crashes if touch ends unexpectedly mid-handler.

### CSS Touch Properties
| Element | Property | Purpose |
|---------|----------|---------|
| `.mini-player` | `touch-action: none` | Block scroll/zoom during drag |
| `.autonomous-pin.resting` | `touch-action: none` | Block gestures on pin |
| `.pin-touch-target` | `touch-action: none` | 60px invisible hit area |
| `.mini-progress-bar` | `touch-action: pan-x` | Allow horizontal scrub only |
| `.mini-player-controls button` | `touch-action: manipulation` | Fast tap, no double-tap zoom |

### iOS Button Fixes (line ~1230-1248)
```css
-webkit-appearance: none;
-webkit-tap-highlight-color: transparent;
min-width: 44px;  /* iOS accessibility minimum */
min-height: 44px;
```
