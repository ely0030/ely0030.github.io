# Notepad Drag-and-Drop Categories Implementation

**Date**: 21-01-2025  
**Session**: Adding drag-and-drop functionality for categories within sections

## Current Status

The user has a notepad feature at `/notepad` that organizes blog posts by categories grouped into sections. They want to be able to drag categories around to reorder them within sections and between sections.

### What's Working
1. **Section drag-and-drop**: Sections can be dragged up/down to reorder (WORKING)
2. **Add section button**: Fixed and working - creates new sections at the top
3. **Section editing**: Double-click or [edit] button to rename sections inline
4. **Empty sections**: Now visible with placeholder text "(empty section - drag categories here)"

### What's NOT Working
- **Category drag-and-drop**: Categories cannot be dragged at all - no visual feedback, no movement

## Technical Context

### How Categories Work
**IMPORTANT**: Categories are NOT stored entities. They are dynamically generated from blog post metadata.

```javascript
// Sections just store category names:
sections = {
  'Writing': ['articles', 'creative', 'ideas', 'thoughts'],
  'Technical': ['technical'],
  'Personal': ['personal', 'protocols'],
  'Miscellaneous': ['uncategorized', 'archive', 'saved']
}
```

- Categories only "exist" when there are blog posts using that category name
- Dragging a category moves its name between section arrays
- The actual blog posts keep their original categories - it's just UI organization

### Code Structure

The drag-and-drop is implemented in `src/pages/notepad.astro`:

1. **Category creation** (line ~2366):
   - Categories are created with `class="blog-category-header draggable"` and `draggable="true"`
   
2. **Event setup** in `setupDragAndDrop()` (line ~2564):
   - Attaches dragstart/dragend handlers to `.blog-category-header.draggable` elements
   
3. **Handlers**:
   - `handleDragStart` (line ~2610) - Sets up drag data
   - `handleDragOver` (line ~2654) - Shows drop indicators
   - `handleDrop` (line ~2707) - Handles the drop logic
   - `handleDragEnd` (line ~2635) - Cleanup

## The Problem

Categories are created with proper draggable attributes, but drag events aren't firing. Possible causes:

1. **Timing issue**: `setupDragAndDrop()` is called at the end of `populateBlogPosts()`, but might be running before DOM is ready
2. **Event bubbling**: The toggle button inside might be interfering
3. **Re-rendering**: When sections/categories change, `populateBlogPosts()` recreates the DOM but event handlers might not re-attach

## What We've Tried

1. Added `setTimeout` delay before calling `setupDragAndDrop()` (line ~2518)
2. Added debugging logs to track event attachment
3. Verified categories have `draggable="true"` and proper classes
4. Fixed syntax errors in `handleDrop` that were preventing JS from running

## Next Steps

1. **Add more debugging** to see if drag events are firing at all:
   ```javascript
   header.addEventListener('dragstart', (e) => {
     console.log('RAW dragstart event fired!', e);
     this.handleDragStart(e);
   });
   ```

2. **Check for CSS interference**:
   - Some CSS properties like `user-select: none` can break dragging
   - Check if any parent elements have `pointer-events: none`

3. **Test simpler drag setup**:
   - Try making just the category name draggable instead of the whole header
   - Remove the toggle button temporarily to test

4. **Verify event delegation**:
   - The category toggle button has `draggable="false"` but might still interfere
   - Try `e.stopPropagation()` in the toggle click handler

5. **Browser compatibility**:
   - Test in different browsers
   - Check if drag events work on other elements

## Key Files

- `/src/pages/notepad.astro` - Main implementation
- `/CLAUDE.md` - Project context, see pitfall #21 about section management
- `/docs/notepad-critical-knowledge.md` - Notepad documentation

## Testing Instructions

1. Go to `/notepad`
2. Create a blog post with a unique category name
3. Try to drag the category to another section
4. Check browser console for any error messages
5. Look for the drag cursor when hovering over categories

## Important Notes

- The user wants to keep the current behavior where categories are just organizational labels
- Don't change how categories fundamentally work - just fix the drag-and-drop
- Blog posts appear in "DEBUG v4" mode from earlier debugging - can be removed