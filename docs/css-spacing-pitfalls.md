# CSS Spacing Pitfalls

Critical CSS traps that waste hours of debugging. Read this FIRST when spacing seems broken.

## white-space: pre-line Death Trap

**Location**: BlogPost.astro:105 (REMOVED 2025-01-04)  
**Symptom**: Unfixable vertical gaps between elements  
**Time wasted**: 2+ hours

### What happened
```css
.prose {
  white-space: pre-line; /* NEVER USE THIS */
}
```

This preserves newlines in HTML as visual space:
```html
<p>text</p>
<ul>...</ul>
```
The newline between `</p>` and `<ul>` becomes ~1em of unremovable space.

### Failed attempts
- `margin: 0 !important` - no effect
- `margin-top: -1em` - no effect  
- `position: relative; top: -0.5em` - no effect
- Modified 20+ CSS rules across multiple files

### Why it failed
Not a margin/padding issue. The browser renders the newline character as actual space, like pressing Enter in a word processor.

### Solution
Remove `white-space: pre-line`. Period.

## Astro Style Scoping Trap

**Location**: Any component `<style>` tag  
**Symptom**: Styles don't apply to child components

### What happened
```astro
<!-- BlogPost.astro -->
<style>
  body.literature2 .prose p + ul {
    margin-top: 0 !important; /* Won't work! */
  }
</style>
```

Astro scopes component styles by default. They only apply to that component's HTML.

### Solution
```astro
<style is:global>
  /* Now works everywhere */
</style>
```

## CSS Load Order Chaos

**Files**: global.css vs component styles  
**Symptom**: !important doesn't work, specificity seems broken

### What happened
Astro loads CSS unpredictably:
1. Component styles (literature2-specific)
2. Global styles (general .prose rules)

Later styles win regardless of specificity.

### Solution
- Use CSS layers: `@layer base, components`
- Or move all prose styles to ONE location
- Or use inline styles as nuclear option

## JSX/HTML Whitespace Trap

**Location**: index.astro:171 (visual markers)  
**Symptom**: CSS margins/padding have zero effect on element spacing  
**Time wasted**: 30min

### What happened
```jsx
{markStr && <span class="mark">!</span>}
<a href="#">Title</a>
```
The newline/space between `</span>` and `<a>` renders as visible space character.

### Failed attempts
- `margin-right: -1rem` - no effect
- `margin-left: 0` - no effect
- Changed CSS specificity - no effect
- Added `!important` - no effect

### Why it failed
Not a CSS issue. The whitespace IS content, like typing a space in text.

### Solution
```jsx
{markStr && <span class="mark">!</span>}<a href="#">Title</a>
```
Remove ALL whitespace between elements.

## CSS Specificity vs Global Selectors

**Location**: global.css:936-938 + component styles
**Symptom**: Button focus outlines persist despite `outline: none`
**Time wasted**: Debugging CSS cascade issues

### What happened
```css
/* global.css */
button:focus { 
  outline: 2px solid rgba(0, 85, 187, 0.5); 
}

/* Component */
.folder-header:focus { 
  outline: none; /* Doesn't work! */
}
```

Global element selector `button:focus` beats class selector `.folder-header:focus`.

### Solution
```css
button.folder-header:focus {
  outline: none !important;
}
```
Increase specificity + !important to override globals.

## Paragraph Margin After Breaks

**Location**: global.css:1783-1785  
**Symptom**: Unselectable gap between newlines and following text
**Issue**: `p + p { margin-top: 0.9em }` adds space after `<br>` tags

### Solution
```css
p:has(br:last-child) + p {
  margin-top: 0 !important;
}
```
Removes margin when paragraph ends with breaks for exact newline preservation.

## ContentEditable Cursor Positioning

**Location**: planning-wall.astro:762-785
**Symptom**: Enter key doesn't create newlines OR cursor jumps to wrong position

### What happened
ContentEditable divs need special handling for line breaks:
```javascript
document.execCommand('insertHTML', false, '<br>'); // WRONG - cursor gets lost
```

### Solution
Insert BR + zero-width space for cursor anchor:
```javascript
const br = document.createElement('br');
range.insertNode(br);
const textNode = document.createTextNode('\u200B'); // Zero-width space
range.insertNode(textNode);
```

### Text Extraction Gotcha
Must strip `\u200B` when saving:
```javascript
text.replace(/\u200B/g, '') // line 752
```

## Custom Dropdown Click-Away Bug

**Location**: planning-wall.astro:879-884
**Symptom**: Dropdown closes immediately on open

### Failed attempt
```javascript
addEventListener('click', handleClickOutside); // Fires on opening click!
```

### Solution
Store reference to opening field, ignore clicks on it:
```javascript
this.activeDropdownField = field; // Store opener
if (!this.activeDropdown.contains(e.target) && 
    !this.activeDropdownField.contains(e.target)) { // Check both
  close();
}
```

## Key Lessons

1. **Check white-space first** when margin/padding changes do nothing
2. **JSX whitespace = content** - newlines between elements create gaps
3. **Always use `is:global`** for cross-component styles in Astro
4. **CSS load order > specificity** in build tools
5. **Test in production build** - dev server lies about CSS order
6. **Global element selectors beat class selectors** - use higher specificity or !important
7. **Paragraph margins interfere with break spacing** - use `:has()` to detect and remove