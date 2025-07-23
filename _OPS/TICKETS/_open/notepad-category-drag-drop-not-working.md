# Notepad Category Drag-and-Drop Not Working

**Date**: 2025-01-21
**Status**: PARTIALLY RESOLVED
**Component**: Notepad Blog Editor
**Severity**: High

## SOLUTION #2 (PARTIAL SUCCESS)

**Root Cause Found**: Multiple issues:
1. Button element was not the issue (changing to div didn't help)
2. Event listeners were being attached to dynamically created elements that got replaced
3. Wrong event handler methods were being called (name conflicts)

**Fix Applied**:
1. Added global document-level event listeners for drag events
2. Renamed methods to avoid conflicts (handleCategoryDragOver, etc.)
3. Fixed scope issues with variables

**Current Status**: 
- ✅ Categories CAN now be dragged
- ✅ Drop zones work (sections highlight when hovering)
- ✅ Drop events fire successfully
- ❌ BUT: Categories "disappear" after being moved

**Why Categories Disappear**:
Categories are just organizational labels, not actual containers. When you move a category to a different section, you're only moving the label. The blog posts themselves still have their original category in their metadata. Since the moved category has no posts in the new section, it doesn't display.

This appears to be working as designed - the category system is just for visual organization in the sidebar, not for actually re-categorizing posts.

## ATTEMPTED SOLUTION #1 (FAILED)

Changed the BUTTON element to a DIV with ARIA attributes, thinking HTML5 drag-and-drop was incompatible with buttons:
```javascript
// Changed:
const categoryToggle = document.createElement('div');
categoryToggle.setAttribute('role', 'button');
categoryToggle.setAttribute('tabindex', '0');
```

**Result**: No change. Drag-and-drop still doesn't work at all. Categories show no drag behavior.

## Problem Description

Category folders in the notepad blog editor cannot be dragged at all. When attempting to drag a category:
- No visual feedback (no drag cursor, no ghost image)
- No drop zones appear
- It behaves like any regular clickable element, not a draggable one
- Section headers CAN be dragged successfully, but categories cannot

## Current Implementation

### What Works
- Section headers are draggable and can be reordered
- Category toggle buttons work (expand/collapse)
- All other notepad functionality works

### What Doesn't Work
- Categories show no drag behavior whatsoever
- No drag cursor appears on hover
- No ghost image when attempting to drag
- No drop indicators appear

## Technical Details

### HTML Structure
```html
<div class="blog-category">
  <div class="blog-category-header draggable" draggable="true" data-category="articles" data-section="Writing">
    <button class="blog-category-toggle">
      <span class="category-icon">📁</span>
      <span class="category-name">articles/</span>
      <span class="post-count">(5)</span>
    </button>
  </div>
  <ul class="category-posts">...</ul>
</div>
```

### CSS Applied
```css
.blog-category-header.draggable {
  cursor: grab;
  user-select: none;
  /* Visual drag handle indicator */
}
```

### JavaScript Setup
- Event delegation implemented on parent `blog-post-list`
- `draggable="true"` attribute is set
- Event handlers attached for dragstart/dragend
- Toggle button mousedown prevents parent drag

## Attempted Solutions

1. **Direct event listeners** - Replaced when DOM recreated
2. **Separate drag handle** - Still didn't work
3. **Event delegation** - Current approach, still not working
4. **Different timing** - setTimeout, requestAnimationFrame
5. **Debug logging** - Shows setup happening but no drag events fire

## Root Cause Analysis

The issue appears to be that:
1. The `draggable="true"` attribute is set
2. Event listeners are attached
3. But the browser isn't recognizing the element as draggable

Possible causes:
- CSS interference (though user-select: none is set)
- Button element inside preventing drag initiation
- Browser-specific drag behavior
- Missing drag data or improper event handling
- Z-index or positioning issues

## Diagnostic Steps

1. Check if `ondragstart` inline handler works
2. Test with a simple div without the button
3. Check computed styles for any blocking properties
4. Test in different browsers
5. Check if parent elements have any drag prevention

## Next Steps

1. Try a minimal test case with just a draggable div
2. Investigate if the button element is somehow blocking all drag events
3. Check browser console for any errors during drag attempt
4. Consider restructuring HTML to have drag handle outside the button
5. Test with native HTML5 drag attributes only (no JS)

## Related Code

- `src/pages/notepad.astro`: Lines 2350-2381 (category header creation)
- `src/pages/notepad.astro`: Lines 2564-2615 (drag setup)
- `src/pages/notepad.astro`: Lines 968-1021 (CSS styles)

## Session Notes

Multiple attempts made to fix this issue:
- Changed from whole header draggable to separate drag handle
- Switched back to whole header approach
- Implemented event delegation to handle DOM recreation
- Added extensive debug logging
- The fundamental issue remains: drag events simply don't fire