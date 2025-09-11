# Changelog Entry - July 21, 2025

## Notepad Category Drag-Drop Fixes

### Issues Fixed

1. **Empty Categories Disappearing**
   - **Problem**: Categories without posts vanished when moved to new sections
   - **Root Cause**: Line 2357 filtered out categories with no posts
   - **Solution**: Show all categories from section arrays, added "(no posts yet)" message

2. **Sections Collapsing on First Click**
   - **Problem**: Clicking a section collapsed it and hid all categories
   - **Root Cause**: localStorage default was empty array instead of all sections
   - **Solution**: Fixed 4 instances of `|| '[]'` to default to all sections expanded

3. **Missing User Feedback**
   - **Problem**: `this.showMessage is not a function` error when dropping categories
   - **Solution**: Added showMessage method at line 5539-5551

### Code Changes

```javascript
// Before (line 2283)
const visibleCategories = categories.filter(cat => postsByCategory[cat]);

// After
const visibleCategories = categories;
```

```javascript
// Before (line 2825)
const expandedSections = JSON.parse(localStorage.getItem('notepad:expandedSections') || '[]');

// After
const expandedSections = JSON.parse(localStorage.getItem('notepad:expandedSections') || JSON.stringify(Object.keys(this.sections)));
```

### Key Insight
Drag-drop is **visual organization only** - it moves category folders between sections but does NOT re-categorize the posts themselves. This is by design, not a bug.

### Commits
- `936488d` - fix: Empty categories now visible after drag-and-drop
- `7bed936` - fix: Section toggle now defaults to expanded state