# Planning Wall Drag & Drop Fix - Session Handoff
**Date**: 17-01-2025  
**Session ID**: planning-wall-drag-drop-fix-17-01-2025a  
**Status**: In Progress - Stuck on vertical drag/drop implementation

## Overview
User created a planning wall feature at `/planning-wall` for project management. The feature is mostly complete but has a critical issue with the vertical drag & drop system that needs fixing.

## Current State

### What Works
1. **Planning wall page** exists at `src/pages/planning-wall.astro`
2. **Card creation** works - click `[new card]` to create
3. **Card selection** works - click to select (orange border), Shift+click creates below selected
4. **Horizontal drag** to create new columns seems functional
5. **Data persistence** via localStorage
6. **Visual design** matches site's Apache/minimalist aesthetic

### What's Broken
**Vertical drag & drop is completely broken**. User's complaints:
- Drop zones are "tiny spaces at the bottom of cards" 
- Drop feedback is "clipping through notes"
- User wants: "just make the outline of a card exactly the same size and place as where the card will be placed"
- Multiple attempts to fix have failed

## Technical Context

### Current Implementation Attempt
The code has gone through multiple iterations:
1. Started with separate `.drop-zone` divs between cards
2. Tried making cards themselves drop targets 
3. Attempted placeholder system
4. Currently has a mixed approach that doesn't work

### Key Files
- `/src/pages/planning-wall.astro` - Main implementation (1000+ lines)
- Contains all CSS and JavaScript inline

### Current Drag/Drop Code Structure
```javascript
// Key components:
- this.draggedElement - tracks dragged card
- this.placeholder - supposed to show drop preview
- handleDragStart/End/Over/Drop methods
- addDropZones() - creates drop areas
- Drop zones use `.drop-zone` class
```

## User's Clear Requirements
User was explicit about what they want:
1. **Full card-sized drop zone** - not tiny areas
2. **Drop zone shows card outline** exactly where card will land
3. **Drop zone IS the drop target** - drop on the preview
4. **Simple** - user emphasized "that's it"

## What Has Been Tried & Failed

### Attempt 1: Invisible Drop Zones
- Created 5px tall zones with negative margins
- Expanded to 60px on hover
- **Failed**: Too small, hard to hit

### Attempt 2: Card-based Drop Targets  
- Made cards themselves detect top/bottom half
- Showed lines above/below cards
- **Failed**: User wants to drop "under cards not onto cards"

### Attempt 3: Mixed Placeholder System
- Created placeholder element
- Tried to position it dynamically
- **Failed**: Still creates tiny drop areas, not full card previews

## Root Problem
The current approach is too complex. All attempts have tried to create separate small drop zones instead of what the user clearly asked for: **a full card-sized preview that appears between cards when dragging**.

## Recommended Solution

### Approach
1. **Remove ALL current drag/drop code** - it's too convoluted
2. **Single placeholder system**:
   ```javascript
   // When drag starts:
   - Create a card-sized placeholder (same dimensions as real card)
   - Hide it initially
   
   // During drag:
   - Detect gaps between cards (not the cards themselves)
   - Insert placeholder in the gap
   - Placeholder is visible, full card size
   - Placeholder IS the drop target
   
   // On drop:
   - Get placeholder position
   - Move real card there
   - Remove placeholder
   ```

3. **Key insight**: Don't create invisible zones. Create visible card-sized placeholders that act as both preview AND drop target.

### Implementation Steps
1. Delete `addDropZones()` method
2. Delete all `.drop-zone` CSS
3. Simplify to just:
   - Track mouse position relative to gaps between cards
   - Insert placeholder element in nearest gap
   - Placeholder handles its own drop events

## Current Blockers
- Too much legacy code from failed attempts
- Mixing multiple approaches (zones + placeholders + card detection)
- Not following user's simple requirement

## Test Scenario
To verify fix works:
1. Create 2-3 cards in a column
2. Drag a card - should see full card-sized preview between cards
3. Preview should be exactly where card will land
4. Drop on preview - card moves there
5. No tiny zones, no clipping, just simple card-sized previews

## Session End State
- User frustrated after multiple failed attempts
- Requested this handoff document
- Problem is clear but implementation is overcomplicated
- Needs fresh approach following user's simple spec

## Key Warning
**Don't overthink this**. User wants exactly what they said: show a card-sized outline where the card will drop. That outline is the drop zone. Nothing more complex than that.