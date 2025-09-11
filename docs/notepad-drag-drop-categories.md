# Notepad Drag-Drop & Category System

## Overview
Blog post category folders support drag-drop for visual organization. 
- Initial implementation: 2025-01-21
- Drag & drop fully functional: 2025-01-24

## Architecture

### Section Storage
**Location**: `notepad.astro:2095` - `this.sections` loaded from localStorage
**Default**: `DEFAULT_SECTIONS` at :1449-1454
```javascript
{
  'Writing': ['articles', 'creative', 'ideas', 'thoughts'],
  'Technical': ['technical'],
  'Personal': ['personal', 'protocols'],
  'Miscellaneous': ['uncategorized', 'archive', 'saved']
}
```

### Critical Implementation

#### Empty Category Display (FIXED 2025-01-21)
**Issue**: Categories disappeared after drag to new section
**Root cause**: `notepad.astro:2357` - `if (!posts || posts.length === 0) return;`
**Fix**: Show ALL categories, even empty ones
**Changes**:
- Line 2283: Removed filter `categories.filter(cat => postsByCategory[cat])`
- Line 2356: Changed to `const posts = postsByCategory[category] || [];`
- Line 2419-2424: Added "(no posts yet)" message for empty categories

#### Section Expand State (FIXED 2025-01-21)
**Issue**: Sections collapsed on first click, categories disappeared
**Root cause**: Inconsistent localStorage defaults
**Location**: `notepad.astro:2825` - used empty array `'[]'` as default
**Fix**: Default to ALL sections expanded
```javascript
// Line 2270-2276: Check for empty or missing
if (savedExpandedSections && savedExpandedSections !== '[]') {
  expandedSections = JSON.parse(savedExpandedSections);
} else {
  expandedSections = Object.keys(sections);
  localStorage.setItem('notepad:expandedSections', JSON.stringify(expandedSections));
}
```
**TRAP**: Multiple places had `|| '[]'` defaults - must fix ALL (4 instances)

#### Missing showMessage Method
**Location**: Added at `notepad.astro:5539-5551`
**Used by**: handleCategoryDrop (:2816) for user feedback
**Pattern**: Shows in note-meta element, auto-clears after 3 seconds

## Drag-Drop Mechanics

### Visual Organization Only
**CRITICAL**: Moving categories does NOT re-categorize posts
- Category folders are visual grouping in sidebar
- Post metadata `category: "name"` unchanged
- Empty categories remain visible after move

### Event Flow
1. **Drag start** (:2377-2378) - inline handler sets `this.draggedCategory`
2. **Drag over** (:2664-2717) - visual feedback classes
3. **Drop** (:2720-2812) - updates section arrays, saves, refreshes
4. **Cleanup** (:2644-2661) - removes all drag classes

### CSS Classes
- `.dragging` - opacity 0.6 on dragged item
- `.drag-over-top/bottom` - orange border indicators
- `.drag-over` - section highlight

## Common Pitfalls

### 1. Categories "Disappearing"
**Symptom**: Drop category, it vanishes
**Cause**: Empty categories filtered out
**Fix Applied**: Show all categories regardless of post count

### 2. Section Won't Expand
**Symptom**: Click section, nothing shows
**Cause**: Empty expandedSections array in localStorage
**Fix Applied**: Default to all expanded on first load

### 3. Drag Not Working
**Check**: 
- `draggable="true"` attribute (:2370)
- Inline handlers (:2377-2381) not event delegation
- No preventDefault on dragstart

### 4. Wrong Drop Position
**Issue**: Categories drop in wrong section
**Check**: data-section attributes match

## State Management

### localStorage Keys
- `notepad:customSections` - Section→Categories mapping
- `notepad:expandedSections` - Which sections are open
- `notepad:expandedBlogCategories` - Which categories are open

### Save & Refresh Pattern
**Location**: All drag operations follow:
```javascript
this.saveSections();        // :2599 - Persist to localStorage
this.populateBlogPosts();   // :2233 - Rebuild DOM
```
**Why**: Complete rebuild ensures consistent state

## Failed Approaches (Don't Retry)
1. **Dynamic category creation on drop** - Too complex
2. **Placeholder elements during drag** - Position sync issues
3. **Animated transitions** - Interferes with drag state
4. **Server-side category updates** - Categories are client-side only

## Quick Debug
- **Nothing happens on drop**: Check console for `this.showMessage is not a function`
- **Categories missing**: Open DevTools → localStorage → check `notepad:customSections`
- **Sections won't toggle**: Delete `notepad:expandedSections` key → refresh