# Music Mini Player - Autonomous Pin System Handoff

## Session Summary
Continued work on the music page mini player's pin system. The pin is now a fully autonomous element with smart behavior based on card speed and distance.

## What Was Built This Session

### 1. Autonomous Pin Architecture
The pin was moved **outside** the mini player DOM. This is critical - previously the pin was a child of mini-player, so dragging the card directly moved the pin.

```html
<!-- Pin is SEPARATE from mini player -->
<div id="autonomous-pin" class="autonomous-pin hidden">...</div>
<div id="mini-player" class="mini-player hidden">...</div>
```

### 2. Smart Asymptotic Slowdown
Pin speed scales based on:
- **Card speed** - slower card = less urgency to chase
- **Distance** - closer pin = less urgency
- **Immensifier** - when BOTH are low, multiplies slowdown up to 95%

Key formula at ~line 1550-1556:
```javascript
const adjustedSpeedFactor = speedFactor * speedFactor; // squared for dramatic low-speed effect
const adjustedDistanceFactor = distanceFactor + (1 - distanceFactor) * speedFactor; // weakens at high speed
const immensifier = 1 - (lowInertia * closeDistance * 0.95);
const urgency = Math.max(0.005, adjustedSpeedFactor * 0.5 + adjustedDistanceFactor * 0.5) * immensifier;
```

### 3. Repulsion Field
Two repulsion systems:

**Approach repulsion** (~line 1493-1502): When card moves toward pin
- Centered on `getCardCenter()` not tack spot (uniform from all sides)
- Scales with approach speed and distance

**Proximity repulsion** (~line 1505-1517): When pin too close to card
- Backs away from card center
- Stronger when card has low inertia (lowInertiaFactor)

### 4. Velocity Smoothing
Added `pinVelX/pinVelY` with 70/30 blend (~line 1573-1577) to reduce jitter when chase and repulsion forces conflict (especially from left side of card).

### 5. Static Pin Visual
Pin needle is always at 15deg tilt while chasing. No dynamic pointing based on direction - user found it cleaner.

## File Locations

All code in `src/pages/music.astro`:
- **HTML**: ~line 345-348 (autonomous pin)
- **CSS**: ~line 708-760 (pin styles)
- **JS Pin State**: ~line 1435-1449 (variables and constants)
- **JS Pin Logic**: ~line 1460-1580 (updateAutonomousPin, onCardMoving, onCardStopped)

## Key Constants (~line 1444-1449)

```javascript
const PIN_GIVEUP_SPEED = 6;     // Card speed where pin gives up active chase
const PIN_RUN_SPEED = 0.15;     // Normal chase speed (ratio/frame)
const PIN_LAZY_SPEED = 0.03;    // Chase speed when "gave up"
const PIN_WAIT_DISTANCE = 350;  // Asymptotic field radius
const PIN_REPULSION = 1.2;      // Repulsion strength
```

## Current Status / Expected Behavior

1. **Click and hold** mini player → Pin lifts (needle appears at 15deg)
2. **Drag slowly** → Pin trails behind, maintains comfort distance
3. **Drag fast** → Pin "gives up" (opacity 0.7), follows lazily
4. **Card approaches pin** → Pin backs away ("woah woah" reaction)
5. **Card slows down** → Pin dramatically slows (asymptotic)
6. **Card stops** → Pin dart-throws to tack spot with impact animation

## Potential Issues to Watch

- **Jitter from left side**: Velocity smoothing helps but may still occur if chase/repulsion forces are extreme
- **Repulsion field tuning**: Values (350px field, 1.2 strength, 120px proximity zone) may need adjustment based on feel
- **Pin position on page load**: If pinned state is restored from localStorage, pin position should initialize correctly

## Related Files

- `docs/music-mini-player.md` - Documentation created this session
- `docs/features_index.md` - Updated with music page entry
- `_temp/git-commit-backlog.md` - Commit description ready

## Previous Handoffs

- `music-mini-player-enhancements-25-01-2025a.md` - Original scope
- `music-mini-player-enhancements-25-01-2025b.md` - Pin alignment, impact animation, early pin work

## Dev Setup
```bash
npm run dev  # port 4321
# Visit http://localhost:4321/music/
# Play a track, double-click mini player to pin, drag to test
```
