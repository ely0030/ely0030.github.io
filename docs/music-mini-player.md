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

### Manual Re-pin Flow (4 handlers: mouse/touch × resting/tacked pin)
```javascript
stopAnimation();
miniPlayer.classList.remove('gliding', 'dragging');
// DON'T add .pinned yet - keep unpinned shadow during pin slide

// Pin slides to tack spot (120ms)...

setTimeout(() => {
    // NOW add both classes - animation 0% matches current shadow
    miniPlayer.classList.add('pinned');
    miniPlayer.classList.add('just-pinned-from-float');
}, 120);
```

### Why Delay Adding `.pinned`
Adding `.pinned` immediately changes shadow to minimal. We want unpinned shadow during the 120ms pin slide, THEN the impact animation.
