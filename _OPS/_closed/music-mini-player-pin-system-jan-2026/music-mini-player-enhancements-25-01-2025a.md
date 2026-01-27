# Music Mini Player Enhancements

## What Exists Now
A mini floating player was just added to the music page (`src/pages/music.astro`). It appears in the bottom-right when a track plays and has:
- Track name/artist display
- Progress bar (clickable to seek)
- Time display (current / duration)
- Controls: shuffle, prev, play/pause, next
- Syncs with main shuffle button
- Mobile responsive (full width on small screens)

Location in file:
- HTML: lines ~344-363
- CSS: lines ~653-762 (look for `/* Mini floating player */`)
- JS: lines ~1006-1100 (look for `// Mini player functionality`)

## What User Wants Next

### 1. Draggable
Make the mini player click-and-draggable so user can reposition it on screen.

### 2. Position Persistence
Save position to localStorage so it remembers where user left it across page reloads.

### 3. Subtle Glassmorphism
Add a slight glassmorphic effect while keeping it consistent with the minimal Apache-style aesthetic of the page. Current design is:
- White background (#ffffff)
- 1px solid border (#1d1d1f)
- Subtle box-shadow
- SF Mono font

Glassmorphism should be subtle - maybe just `backdrop-filter: blur(10px)` with a slightly transparent white background. Don't overdo it.

## Implementation Notes

For draggable:
- Add mousedown/mousemove/mouseup listeners
- Track offset from click position to element corner
- Update `left` and `top` (currently uses `bottom: 20px; right: 20px;`)
- Need to switch from bottom/right positioning to top/left for drag to work smoothly

For position persistence:
- Save to localStorage on drag end: `localStorage.setItem('miniPlayerPos', JSON.stringify({x, y}))`
- Load on page init and apply if exists
- Consider bounds checking so it doesn't get stuck off-screen

For glassmorphism:
```css
.mini-player {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
```

## Current Page State
- Dev server runs on port 4321 (`npm run dev`)
- Music page: http://localhost:4321/music/
- All other music features working: play/pause, shuffle, duration auto-fetch, downloads

## Files to Read
- `src/pages/music.astro` - everything is in this one file
- `CLAUDE.md` - has music page section with gotchas

## Don't Forget
- Test on mobile (the player goes full-width there, dragging behavior may need adjustment)
- The BlogPost layout JS hijacks h1 clicks - there's already a fix for the "Index" link, don't break it
