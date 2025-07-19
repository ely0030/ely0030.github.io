# Notepad Editor Evolution: Lessons in ContentEditable

## The Journey (What NOT to Do)

### Attempt 1: Live Markdown with innerHTML Replace
**Location**: `src/pages/notepad.astro` (removed)
**Approach**: Replace entire innerHTML on every keystroke with formatted markdown
**Result**: FAILED - Cursor jumped to start on every space/character
**Why**: Browser loses DOM position when innerHTML replaced

### Attempt 2: Complex Cursor Save/Restore
**Location**: `getCursorOffset`/`restoreCursorPosition` (removed)
**Approach**: Calculate text offset, replace innerHTML, restore cursor by walking DOM
**Result**: FAILED - Cursor jumped on backspace/enter in empty lines
**Why**: 
- Text offset calculations don't map cleanly to DOM positions
- Empty text nodes and BR elements create edge cases
- Too complex to handle all scenarios reliably

### Attempt 3: PlainText-Only ContentEditable
**Location**: `contentEditable='plaintext-only'`
**Approach**: Use plain text mode, no formatting
**Result**: WORKED but no inline markdown
**Why**: Browser handles everything natively, but can't style content

## The Solution That Works

### Final Approach: Format on Blur Only
**Location**: `src/pages/notepad.astro:848-872`
**Key Insight**: Don't fight the browser while user is typing

```javascript
// CRITICAL: Skip formatting while typing
const isFocused = document.activeElement === editor;
if (isFocused) return;
```

**Why This Works**:
1. User gets uninterrupted typing experience
2. Formatting applies when they pause/leave field
3. No cursor position calculations needed
4. Browser handles all input naturally

## Hard-Won Rules

1. **NEVER** manipulate DOM while `contentEditable` has focus
2. **ALWAYS** check `document.activeElement === editor` before formatting
3. **USE** `editor.innerText` not complex TreeWalker for text extraction
4. **FORMAT** complete markdown patterns only (no partial matches)
5. **PREFER** blur-only formatting over debounced approaches

## Architecture That Scales

```
User Types → Plain contentEditable → No interference
     ↓
User Blurs → Apply Formatting → Visual feedback
     ↓
Load Note → Format After Delay → Shows formatted
```

This separation of input and presentation is KEY to stability.