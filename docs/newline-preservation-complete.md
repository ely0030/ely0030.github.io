# Complete Newline Preservation Solution

**Created**: 2025-01-16
**Issue**: Exact newline preservation for all page types (especially literature2)
**Solution Status**: ✅ WORKING

## The Problem
Multiple newlines typed in notepad editor were not rendering with exact spacing in blog posts:
- 2 newlines → 1 visual line (missing 1)
- 3 newlines → 2 visual lines (missing 1)
- 6 newlines → 5 visual lines (missing 1)

## The Solution

### 1. Remark Plugin
**File**: `src/utils/remark-preserve-newlines.js`
**Key**: Add `break` nodes to paragraph's children array (NOT between paragraphs)

```javascript
// Process backwards to avoid index issues
for (let i = tree.children.length - 1; i > 0; i--) {
  // ... detect gaps between paragraphs ...
  
  // Add break nodes to END of previous paragraph
  for (let j = 0; j < newlineCount; j++) {
    prevNode.children.push({
      type: 'break'  // NOT 'html' or 'text'
    });
  }
}
```

### 2. Astro Config
**File**: `astro.config.mjs:17`
```javascript
remarkPlugins: [remarkPreserveNewlines, remarkBreaks],
```
**CRITICAL**: Restart dev server after changes

### 3. CSS Fix for Unselectable Gap
**File**: `src/styles/global.css:1783-1785`
**Issue**: Paragraph margin creates unselectable gap after breaks
```css
/* Remove margin when previous paragraph ends with breaks */
body.literature2 .prose p:has(br:last-child) + p {
  margin-top: 0 !important;
}
```

## How It Works
1. User types multiple newlines in notepad
2. Markdown saved with literal `\n` characters
3. Remark plugin counts newlines between paragraphs
4. Adds exact number of `break` nodes to paragraph
5. Renders as `<p>text<br><br></p>`
6. CSS removes paragraph margin for seamless spacing

## Failed Approaches (Don't Retry)
1. ❌ Inserting HTML between paragraphs: `parent.children.splice(index, 0, {type: 'html'})`
2. ❌ Using `white-space: pre-line` CSS
3. ❌ Pre-processing with `<br>` tag insertion
4. ❌ Complex formulas (N-1, N-2, conditional logic)

## Testing
Create a post with:
```
Line 1


Line 2



Line 3
```
Should render with exact spacing - 3 newlines = 3 visual lines, 4 newlines = 4 visual lines.

## Gotchas
- **Must restart dev server** when changing astro.config.mjs
- **Must use `break` nodes**, not `html` or `text`
- **Must add to paragraph children**, not between paragraphs
- **CSS `:has()` selector** needed for margin fix (modern browsers only)