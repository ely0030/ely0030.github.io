# Planning Wall

Fixed grid project board at `/planning-wall`. Complete rewrite 2025-01-17.

## Architecture (Grid-Based)

**State**: 
- `this.projects[]` - array with `{id, title, ..., gridX, gridY}`
- NO columns array - positions stored directly on projects
- `this.gridColumns = 5` - fixed width
- Grid auto-expands vertically

**Critical**: Old column-based docs are OBSOLETE. System now uses CSS grid + absolute positioning.

## Drag-Drop Implementation

### What Works
```javascript
setupGridDragDrop() // lines 415-449
- dragover → adds .drag-over class
- Occupied slots: .swap-indicator class
- drop → handleDrop() → swaps or moves
```

### Visual Feedback
- Empty: 1px dotted #999 border
- Swap: target card → dashed border + gray bg + 0.7 opacity
- Dragging: 2deg rotate + 0.6 opacity

### Key Insight
NO placeholders, NO drop zones, NO position calculations. Just:
1. Hover slot → visual class
2. Drop → update gridX/gridY
3. Render

## Non-Obvious Gotchas

### Grid Slot Generation (lines 540-555)
```javascript
for (let y = 0; y <= rows; y++) {
  for (let x = 0; x < this.gridColumns; x++) {
    // CRITICAL: data-x/data-y attributes MUST match loop indices
    `<div class="grid-slot" data-x="${x}" data-y="${y}">`
```
Mismatch = drops land in wrong position.

### Swap Logic (lines 461-473)
When dropping on occupied slot:
1. Store dragged card's original position
2. Move dragged → target position  
3. Move occupying → original position
4. Mark BOTH as unsaved

### findEmptySlot() (lines 415-433)
Scans left→right, top→bottom. Returns `{x:0, y:maxRows}` if full.
**PITFALL**: Don't assume first empty is visually logical placement.

### Event Binding Order
1. `render()` rebuilds DOM
2. `attachCardListeners()` - card-specific events
3. `setupGridDragDrop()` - slot events
**MUST** call in this order or events lost.

## Migration Handling (lines 366-372)
Old projects lack gridX/gridY:
```javascript
project.gridX = index % this.gridColumns;
project.gridY = Math.floor(index / this.gridColumns);
```
Auto-positions in reading order.

## CSS Dependencies

### Critical Classes
- `.grid-slot` - MUST have `position: relative`
- `.project-card` - NO transitions (causes jump)
- `.dragging` - z-index: 1000 required
- Border changes MUST use `border-style` not `border` (preserves width)

### Apache Aesthetic
- Dotted borders only
- No animations/transitions
- Monospace `[empty]` `[swap]` indicators removed for cleaner look
- Opacity changes only for feedback

## Failed Approaches (Don't Retry)

1. **Dynamic columns** - complex array manipulation
2. **Placeholder elements** - position sync nightmare  
3. **Invisible drop zones** - too small to hit
4. **Animations** - felt "jumpy" not "snappy"
5. **Pointer events** - less reliable than drag events

## Card Editing (2025-01-18 Rewrite)

### Description Field - ContentEditable (lines 704-786)
**CRITICAL**: Uses contenteditable, NOT textarea replacement
- `setupContentEditable()` - Click anywhere → cursor at exact position via `caretRangeFromPoint()`
- Enter key → inserts `<br>` + zero-width space (`\u200B`) for cursor positioning
- Text extraction via TreeWalker preserves newlines: BR→`\n`, DIV/P→`\n`
- **GOTCHA**: Must strip `\u200B` on save (line 752)

### Save Behavior (line 826)
**PITFALL**: `.trim()` ONLY on title fields. Description preserves ALL whitespace.

### Custom Dropdowns (lines 854-943)
- Toggle on re-click (lines 770-774)
- `user-select: none` prevents text selection (line 232)
- **BUG FIX**: Store `activeDropdownField` to prevent immediate close (line 868)

### Ghost Cards (lines 920-975)
- Create real card immediately with `isGhost: true`
- Fully draggable/functional, just styled gray
- `isGhost` removed when title set (line 831)

### Visual State
- Unsaved indicator moved to controls bar: `[save • 3]` (lines 413-421)
- "Index" link turns blue on hover, navigates home (lines 41-42)
- No focus outline on buttons (line 46)

## Quick Debug

**Nothing drops**: Check `e.preventDefault()` in dragover
**Wrong position**: Verify data-x/data-y match actual grid position
**No swap**: `.occupied` class missing on slot
**Lost cards**: Check gridX/gridY values in localStorage
**Newlines lost**: Check if description using `.trim()` (shouldn't)
**Dropdown won't close**: Verify `activeDropdownField` cleanup

File: `/src/pages/planning-wall.astro` (all inline, ~1100 lines)