# Planning Wall

Fixed grid project board at `/planning-wall`. Complete rewrite 2025-01-17. Updated 2025-01-20 for column-independent vertical layout.

## Architecture (Column-Independent Vertical Layout)

**State**: 
- `this.projects[]` - array with `{id, title, ..., gridX, gridY}`
- NO columns array - positions stored directly on projects
- `this.gridColumns = 5` - fixed width
- Each column maintains independent vertical flow

**Critical**: Column-independent system where cards float to top within their column. Y positions auto-compact on render to eliminate gaps.

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

### Grid Slot Generation (lines 662-704)
```javascript
for (let x = 0; x < this.gridColumns; x++) {
  html += `<div class="grid-column" data-column="${x}">`;
  // Each column manages its own Y positions independently
```
Column-based structure ensures vertical changes stay within columns.

### Swap Logic (lines 461-473)
When dropping on occupied slot:
1. Store dragged card's original position
2. Move dragged → target position  
3. Move occupying → original position
4. Mark BOTH as unsaved

### findEmptySlot() (lines 480-517)
Finds column with least items, then first empty Y position in that column.
**NEW**: Balances card distribution across columns for better visual layout.

### Auto-Compaction (lines 674-692)
**CRITICAL**: Y positions auto-compact within columns on every render:
```javascript
// For each column, sort by Y, reassign sequential positions
columnProjects.forEach((project, index) => {
  project.gridY = index;
});
```
Eliminates gaps when cards deleted/moved. Columns independent - moving card in column 0 doesn't affect column 1.

**PITFALL**: Compaction happens BEFORE slot generation. Must use compacted positions for data-y attributes or drops go to wrong place.

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
- `.planning-board` - Uses `display: flex` for column layout
- `.grid-column` - Flexbox column with `gap: 10px` between cards
- `.grid-slot` - MUST have `position: relative` and `min-height: 120px`
- `.project-card` - NO transitions (causes jump)
- `.dragging` - z-index: 1000 required
- Border changes MUST use `border-style` not `border` (preserves width)

### Height Matching Pitfall
**GOTCHA**: Empty slots must match card height (~120px) or drop targets become 0px tall and undroppable. CSS `min-height` critical.

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
6. **Fixed Y positions** - gaps after deletes looked broken
7. **Cross-column compaction** - unpredictable card movement

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

### Card Selection Styling (2025-01-21) 🎨
**EVOLUTION**: Orange too harsh → deep blue → back to subtle orange
- Location: planning-wall.astro:122-130, 145-152
- Border: `1px solid #ff5500` (subtle orange, not 2px)
- Double shadow: `0 0 0 1px rgba(255, 85, 0, 0.2), inset 0 0 0 1px rgba(255, 85, 0, 0.1)`
- Background tint: `rgba(255, 85, 0, 0.02)` - barely visible
- Header darker on selected: `rgba(255, 85, 0, 0.03)`
- **TRANSITIONS**: Added 0.15s cubic-bezier for smooth feel
- Card header also transitions background-color
- Priority dots reverted to original orange/yellow/gray
- **LESSON**: User wanted finesse in visual design, not animations

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
**Cards overlap**: Verify auto-compaction running in render()
**Empty column too short**: Check `.grid-slot` has `min-height: 120px`
**Gaps after delete**: Compaction only within columns - check gridX values

File: `/src/pages/planning-wall.astro` (all inline, ~1100 lines)