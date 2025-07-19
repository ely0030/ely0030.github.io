# Folder Navigation Flicker Fix

**Problem**: Folders that were previously open (saved in localStorage) would visually "jump" open on page load.

## Root Cause
Two separate scripts were setting max-height at different times:
1. **Inline script** (line 452-457): Sets aria-expanded from localStorage
2. **DOMContentLoaded** (line 694-705): Recalculates and sets scrollHeight

The CSS transition (`.post-list { transition: max-height 0.05s }`) was animating between these states.

## Failed Approaches
1. **Removing transition initially**: Still jumped due to dual height setting
2. **Delaying transition with setTimeout**: Race condition, unreliable
3. **Setting heights only once**: Complex coordination between scripts

## Working Solution
Disable ALL transitions during initial render:
1. Add `class="no-transitions"` to `<body>` (line 92)
2. CSS rule: `.no-transitions .post-list { transition: none !important; }` (line 313-315)
3. Remove class after full load: `window.addEventListener('load', () => requestAnimationFrame(() => body.classList.remove(...)))`

## Critical Insights
- **CSS max-height rule** (line 308-310) triggers instantly when aria-expanded changes
- **requestAnimationFrame** ensures DOM fully painted before enabling transitions
- **!important** needed to override specificity of base transition rule
- Both scripts can remain unchanged - solution works at CSS level