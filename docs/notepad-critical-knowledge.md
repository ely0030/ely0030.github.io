# Notepad Implementation: Critical Knowledge

## Edit Mode Toggle (2025-01-07, Updated 2025-01-13)

### Feature
**Location**: `src/pages/notepad.astro:2683-2721` (toggleEditMode), `:2095-2100` (keybind)
**Trigger**: Cmd/Ctrl+M or click "edit mode" hint
**Purpose**: Toggle between rendered view (images) and raw markdown (text)

### Critical Implementation Detail
**NEVER** save/restore cursor position during toggle - contentEditable makes it unreliable
**State tracking**: `editor.dataset.editMode === 'true'`

### Newline Preservation Fix (2025-01-13)
**Issue**: `editor.textContent = plainText` loses newlines in contentEditable
**Location**: `:2709-2717`
**Fix**: Convert to div structure when entering edit mode:
```javascript
const lines = plainText.split('\n');
editor.innerHTML = lines.map(line => {
  if (line === '') return '<div class="empty-line">&nbsp;</div>';
  return `<div class="text-line">${this.escapeHtml(line)}</div>`;
}).join('');
```
**Why**: contentEditable needs block elements to preserve line breaks

## Edit Mode Auto-Toggle Behavior (2025-01-07)

### CRITICAL: Dataset Property Preservation
**Location**: `src/pages/notepad.astro:1481-1491`
**Issue**: `editor.innerHTML = newHtml` DESTROYS all dataset properties
**Fix**: Save/restore dataset.editMode, dataset.initialized, dataset.skipFormat before innerHTML replacement
**Wasted**: 30min debugging why editMode was always undefined

### Auto-Toggle Implementation
**Location**: Focus handler `:1253-1258`, Blur handler `:1274-1279`
**Behavior**: 
- Focus → auto-enter edit mode (if manual mode unchecked)
- Blur → auto-exit edit mode (if manual mode unchecked)
- Checkbox click → preserve current mode (skip blur handler if activeElement is checkbox)
**Non-obvious**: Must check activeElement === persistCheckbox to prevent mode change on checkbox click

### Visual Styling Removed
**Location**: `src/pages/notepad.astro:279-282`
**Changed**: Edit mode background #f9f9f9 → #fff, border #666 → #000
**Reason**: User preference for no visual distinction between modes

## Image Paste & Manipulation (2025-01-07)

### Architecture Overview
**Location**: `src/pages/notepad.astro:586-702,1364-1962`
- **IndexedDB Storage**: Images stored as binary blobs, not base64 (ImageStorage class)
- **Markdown Reference**: `![alt](notepad-image:imageId)` format preserved in plain text
- **Blob URL Cache**: `this.imageUrlCache` Map prevents recreating URLs on every render

### Critical Implementation Details

#### 1. Image State Persistence Through Reformatting
**Location**: `src/pages/notepad.astro:1433-1448`
**CRITICAL**: Position/size data MUST be preserved during markdown reformatting
```javascript
// In formatMarkdownLine() - preserve existing img attributes
const existingImg = editor.querySelector(`img[data-image-id="${imageId}"]`);
let position = existingImg?.getAttribute('data-position') || '';
let size = existingImg?.getAttribute('data-size') || '';
// Pass through placeholder: data-position="${position}" data-size="${size}"
```
**Why**: Blur events trigger reformatting which rebuilds DOM, losing inline styles

#### 2. CSS Specificity Battles
**Location**: `src/pages/notepad.astro:467-512`
**Issue**: Position classes weren't applying due to default `display:block` and `margin:auto`
**Fix**: Higher specificity selectors + explicit margin overrides
```css
.editor-content .text-line img.align-left {
  margin-left: 0 !important;
  margin-right: auto !important;
}
```

#### 3. Resize Handle Implementation
**Location**: `src/pages/notepad.astro:1697-1761`
**Non-obvious**: Handle positioning uses `getBoundingClientRect()` + absolute positioning
**Gotcha**: Must update handle position during drag as image resizes

#### 4. Image Drag & Drop Between Lines
**Location**: `src/pages/notepad.astro:1764-1930`
**Complex State**: Track `this.draggedImage` reference + original line cleanup
**Critical**: If line becomes empty after drag, convert to `empty-line` class

### Failure Modes & Solutions

#### Size Reset on Position Change
**Location**: `src/pages/notepad.astro:1644-1666`
**Issue**: Applying position classes reset image size
**Fix**: Store width/maxWidth before class changes, restore after

#### Image Disappearing After Resize
**Location**: `src/pages/notepad.astro:1459-1466`
**Root Cause**: `saveCurrentNote()` triggered reformat without size preservation
**Fix**: Set `editor.dataset.skipFormat = 'true'` temporarily

#### getPlainTextFromEditor Image Handling
**Location**: `src/pages/notepad.astro:1334-1352`
**CRITICAL**: Must detect images in text lines and convert back to markdown WITH attributes
```javascript
const img = div.querySelector('img[data-image-id]');
if (img) {
    const position = img.getAttribute('data-position') || '';
    const size = img.getAttribute('data-size') || '';
    let markdown = `![${alt}](notepad-image:${imageId}`;
    if (position || size) {
        markdown += `?position=${position}&size=${size}`;
    }
    markdown += ')';
}
```

### Export Complexity
**Location**: `src/pages/notepad.astro:1573-1626`
**Async Pattern**: Convert IndexedDB images to base64 data URLs during export
**Memory**: FileReader + Promise pattern for blob→dataURL conversion

### Non-Obvious Implementation Details

#### Font Stack for Emoji Support
**Location**: `src/pages/notepad.astro:51,192,232,344,803`
**Issue**: Default `monospace` doesn't render color emojis
**Fix**: `Menlo, Monaco, 'Courier New', monospace, 'Apple Color Emoji', 'Segoe UI Emoji'`
**Applied to**: notepad-container, note-title-input, editor-content, md-code

#### Auto-Resize on Paste
**Location**: `src/pages/notepad.astro:1442-1488`
**Method**: `resizeImageIfNeeded()` - Canvas-based resizing
**Critical**: Maintains aspect ratio, 92% JPEG quality, 800px max width default
**Non-obvious**: Must handle Promise for blob creation, URL lifecycle

#### Delete Note Image Cleanup
**Location**: `src/pages/notepad.astro:1540-1545`
**Async**: `deleteNote()` now async to await `deleteImagesByNoteId()`
**Critical**: Prevents orphaned images in IndexedDB

#### loadNote Image Cleanup
**Location**: `src/pages/notepad.astro:1010-1011`
**Critical**: `this.cleanupImageUrls()` on note switch prevents memory leaks
**Why**: Blob URLs accumulate without explicit revocation

#### Image Click vs Drag Behavior
**Location**: `src/pages/notepad.astro:1397-1401,1513-1524`
**Complex**: Same element has 3 interactions:
- Click → Size/position menu
- Hover → Resize handle
- Drag → Move between lines
**Non-obvious**: Must preventDefault on all to avoid conflicts

## CSS Scoping Crisis (2025-01-05)

### Astro Scoped Styles vs Dynamic Content
**Location**: `src/pages/notepad.astro:14,310-368`
**CRITICAL**: Astro component styles DON'T apply to JS-generated HTML
**Failed Fix**: Making ALL styles global with `is:global` breaks site-wide styling
**Solution**: TWO style blocks - scoped for UI, global ONLY for dynamic markdown
```html
<style>/* All notepad UI styles */</style>
<style is:global>/* ONLY .editor-content .md-* styles */</style>
```
**Why**: Scoped styles have higher specificity, global styles affect entire site

## Failure Modes & Fixes

### 1. Map vs Object Confusion
**Location**: `src/pages/notepad.astro:643-830`
**Issue**: Refactored code used Map but methods treated it as Object
**Fix**: Use `this.notes.get(id)` not `this.notes[id]`, `Array.from(this.notes.keys())` not `Object.keys(this.notes)`

### 2. Storage Config Access
**Location**: `src/pages/notepad.astro:395-397`
**Issue**: `getAllNoteIds()` tried `this.config.defaults.untitledId` but storage only has `this.config` not full NOTEPAD_CONFIG
**Fix**: Hardcoded 'untitled' since it's constant

### 3. Missing init() Call
**Location**: `src/pages/notepad.astro:929-930`
**Issue**: Constructor didn't call init(), app never started
**Fix**: `const app = new NotepadApp(); app.init();`

## Non-Obvious Dependencies

### localStorage Keys Pattern
**Must follow**: `prefix:identifier` format
- Notes: `notepad:note-{id}`
- Index: `notepad:index`
- Folders: `folder-${categoryId}`
**Why**: Site-wide convention for key namespacing

### Static Site Constraints
**Location**: `astro.config.mjs` - `output: 'static'`
**Impact**: Can't use dynamic routes like `/notepad/[id]`
**Solution**: Hash routing `/notepad#note-id`

### Apache Index Integration
**Location**: `src/pages/index.astro:172-197`
**Structure Required**:
```html
<div class="folder-group" data-category="...">
  <div class="directory-entry">...</div>
  <div class="post-list">...</div>
</div>
```
**Why**: Existing folder toggle JS expects this exact structure

### Note Sidebar Display
**Location**: `src/pages/notepad.astro:690-739`
**Critical**: Notes must be `<a>` tags, not spans, to look clickable
**Hash Navigation**: Homepage links use `/notepad#note-id`

## Cursor Jump Prevention (CRITICAL)

### Root Cause
**Location**: `src/pages/notepad.astro:848-872`
**NEVER**: Replace innerHTML while user is typing - destroys cursor position
**ALWAYS**: Format only on blur or when editor not focused

### Failed Approaches (DO NOT RETRY)
1. **Cursor save/restore with offset calculations** - Too complex, unreliable
2. **DOM manipulation on every keystroke** - Causes cursor jumps
3. **contentEditable='plaintext-only' with overlay** - Can't do inline formatting
4. **Debounced formatting while typing** - Still causes jumps

### Working Solution
**Location**: `src/pages/notepad.astro:848-852`
```javascript
const isFocused = document.activeElement === editor;
if (isFocused) return; // CRITICAL: Skip formatting while typing
```

### Text Extraction
**Location**: `src/pages/notepad.astro:835-836`
**Use**: `editor.innerText` for contentEditable (preserves newlines)
**NOT**: Complex TreeWalker approaches

## CSS Pitfalls

### Never Use white-space: pre-line
**Location**: Removed from `src/layouts/BlogPost.astro:105`
**Why**: Creates unfixable spacing issues with prose
**Alternative**: Use `<br>` tags or proper markdown parsing

### Body Class Scoping
**Location**: `src/styles/global.css:2403-2429`
**Pattern**: All notepad styles must be under `body.notepad`
**Why**: Prevents conflicts with other page types

## Build/Dev Considerations

### Node Version Lock
**Location**: `.nvmrc` - `18.17.1`
**Critical**: Use `nvm use` before dev/build

### Vite Build Size
**Impact**: Monaco editor would add ~2MB
**Solution**: Custom contentEditable implementation (~11KB total)

## Data Migration Risk

### Note Structure Change
**Old**: `{ blocks: [{id, content}] }`
**New**: `{ content: string }`
**Risk**: Existing notes won't load after update
**Mitigation**: Add migration logic in loadNotes() if needed

## Layout Conflicts (CRITICAL)

### Grid Column Width Mismatch
**Location**: `src/pages/notepad.astro:33-44`
**Issue**: Grid allocated 250px but sidebar had min-width:300px - caused 50px overflow into editor
**Symptom**: "jammed" or "clashing" appearance between sidebar and editor
**Fix**: `grid-template-columns: 300px 1fr` and `gap: 2em`
**LESSON**: Grid column width MUST match actual content requirements

## Feature Changes

### Homepage Integration (REMOVED)
**Old**: Separate "Local Notes" folder with orange styling
**New**: Single "Untitled" entry in uncategorized folder (dated July 5, 2025)
**Location**: `src/pages/index.astro:84-102`
**Why**: Make notepad innocuous/hidden

### Preview Feature (REMOVED)
**Removed**: Preview button, togglePreview(), Ctrl+P shortcut
**Location**: `src/pages/notepad.astro` - multiple deletions
**Why**: Simplify, focus on pure writing

## Delete Button Implementation (CRITICAL)

### CSS Scoping Trap
**Location**: `src/pages/notepad.astro:793-822`
**Issue**: Astro component styles don't apply to dynamically created elements
**Failed Fix**: Adding `is:global` affected entire page
**Solution**: Apply styles via JavaScript inline styles on element creation

### Style Cascade Override
**Location**: `src/pages/notepad.astro:804-806`
**Issue**: Global `a { text-decoration: underline }` overrides component CSS
**Why**: `.btn` class + global link styles have higher specificity
**Fix**: `deleteBtn.style.textDecoration = 'none'` directly on element

### Flexbox Gap Non-Spacing
**Location**: `src/pages/notepad.astro:792`
**Issue**: CSS `gap: 2em` between flex children had NO EFFECT
**Root Cause**: Unknown - flexbox layout not respecting gap property
**Fix**: `metaSpan.appendChild(document.createTextNode('  '))` - actual space characters

### Untitled Note Protection
**Old**: `if (noteId !== NOTEPAD_CONFIG.defaults.untitledId) return`
**New**: Allow deletion but auto-create new untitled if `notes.size === 0`
**Location**: `src/pages/notepad.astro:1098-1100`
**Why**: Users expect all notes deletable but app needs ≥1 note

### Two-Stage Delete State Tracking
**Location**: `src/pages/notepad.astro:636` - `this.activatedDeletes = new Set()`
**Purpose**: Track which delete buttons were clicked for red color persistence
**Clear on**: Actual deletion (line 1096) OR timeout/click-away (lines 1217, 1230)

## Markdown Rendering Pitfalls

### Hidden Content Text Extraction
**Location**: `src/pages/notepad.astro:974-995`
**Issue**: `innerText` skips CSS `display:none` content - hyperlinks lose URLs
**Failed**: Using `innerText` or `textContent` alone
**Solution**: TreeWalker traverses ALL text nodes including hidden
```javascript
const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
```

### Hyperlink Editing UX
**Location**: `src/pages/notepad.astro:957-974,925-931`
**Behavior**: 
- Click link text → `.expanded` class → URL stays visible for editing
- Click brackets → `.show-url` class → toggles URL
- Blur editor → removes all `.expanded` → hides URLs
**Critical**: `contenteditable="false"` on `<a>` tags makes links clickable

### Shift+Tab Un-indent
**Location**: `src/pages/notepad.astro:1045-1075`
**Complex**: Must find current line start, check for spaces, create range to delete
**Why Simple Solutions Fail**: contentEditable doesn't have built-in un-indent

## Newline Preservation Crisis (2025-01-05)

### The Problem Cascade
**Location**: `src/pages/notepad.astro:1055-1090,1010-1056`
**Issue**: Formatting on blur → extracts text → splits lines → joins with `<br>` → LOSES EMPTY LINES
**Failed Attempts**:
1. `white-space: pre-line` - Creates spacing chaos
2. Non-breaking spaces `&nbsp;` - Browser collapses them
3. Double `<br>` tags - Still collapsed
4. Skip formatting if already formatted - Breaks new link rendering

### Working Solution: Div-Based Lines
**Location**: `src/pages/notepad.astro:1076-1084`
```javascript
if (line === '') return '<div class="empty-line">&nbsp;</div>';
return `<div class="text-line">${this.formatMarkdownLine(line)}</div>`;
```
**Critical**: `getPlainTextFromEditor` must handle div structure (lines 1010-1030)

### Focus/Blur Trap
**Location**: `src/pages/notepad.astro:968-1004`
**Issue**: `contenteditable="false"` links don't focus editor → no blur event → links stay expanded
**Fix**: Force focus on ANY click inside editor (line 975-977)
**Why**: Without focus, there's no blur when clicking away

### Link Toggle UX
**Location**: `src/pages/notepad.astro:978-1002`
**Behavior**:
- Link text clicks → toggle expanded state
- `[` `]` brackets → toggle expanded state  
- URL part clicks → NO ACTION (allows editing)
**Critical**: Check `!urlPart` before toggling (line 994)

## HTML Escaping Order Trap (2025-01-07) 🔥

### CRITICAL BUG PATTERN
**Location**: `src/pages/notepad.astro:1453-1494` (formatMarkdownLine)
**Issue**: HTML escaping `&` to `&amp;` BEFORE parsing image URLs breaks query parameters
**Example**: `![img](notepad-image:123?position=left&size=300)` → `&` becomes `&amp;` → URLSearchParams fails

### Solution
**MUST** parse images BEFORE HTML escaping:
1. Extract image markdown with regex
2. Parse URL parameters while `&` is still literal
3. Create placeholder element
4. THEN escape HTML for remaining content
5. Restore placeholder through escaping

**Failed approach**: Escaping HTML first (2+ hours debugging)

## Image Paste Implementation (2025-07-05)

### Storage Architecture
**Location**: `src/pages/notepad.astro:465-616`
**Primary**: IndexedDB for blob storage (`notepadImages` database)
**Fallback**: localStorage with base64 encoding
**Format**: `![alt](notepad-image:{imageId})`
**Limits**: 5MB per image, 50MB total

### Object URL Management
**Location**: `src/pages/notepad.astro:688` - `this.objectUrls = new Map()`
**Purpose**: Track blob URLs to prevent memory leaks
**Cleanup**: `cleanupObjectUrls()` called when switching notes
**Creation**: On-demand when images render

### Paste Handler Changes
**Location**: `src/pages/notepad.astro:1236-1351`
**Detection**: Check `clipboardData.items` for image types
**Flow**: Show loading → Save to storage → Insert markdown → Create object URL
**Critical**: Must find and replace loading text accurately

### Export Considerations
**Location**: `src/pages/notepad.astro:1335-1415`
**Behavior**: Converts `notepad-image:` refs to base64 data URLs
**Why**: Makes exported markdown portable with embedded images
**Process**: Async to handle blob→base64 conversion

## Blog Post Editing Integration (2025-01-13)

### Architecture
- Blog posts loaded via `getCollection('blog')` at build time
- Passed to client via `define:vars` in script tag
- Stored in `window.BLOG_POSTS` global

### Save Methods
1. **Export** - Downloads .md file
2. **Save to Folder** - File System API (Chrome only)
3. **Save to Blog** - Dev server API on port 4322

### Critical Implementation Failures

#### Blog Post CSS Scoping (2025-01-13)
**Location**: `notepad.astro:673-731` (moved from :210-268)
**Issue**: Blog post list rendered as plain text
**Root cause**: Dynamic elements created by `populateBlogPosts()` can't access scoped styles
**Fix**: Move `.blog-post-*` CSS to `<style is:global>` block
**Time wasted**: 20min - obvious once understood Astro scoping

#### Subdirectory Filename Handling
**Location**: `blog-save-server.js:44-66`
**Issue**: Posts in subdirs (e.g., `manifestation/cccworld`) flattened to `manifestation-cccworld.md`
**Fix**: Split path/filename, preserve directory structure, create dirs with `fs.mkdir`
**Critical**: `currentBlogPostId` includes full path - must handle in all save methods

#### State Persistence Through Save
**Location**: `notepad.astro:1424` (loadBlogPost sets currentBlogPostId)
**Non-obvious**: `this.currentBlogPostId` required for save functions to work
**Failure mode**: "No blog post loaded to save" despite post being visible

## Blog Post Delete Implementation (2025-01-13)

### Two-Click Delete Mechanism
**Location**: `notepad.astro:3578-3622`
**Pattern**: Mirrors note deletion - [del] → [sure?] → delete
**State**: `this.activatedBlogDeletes` Set tracks confirmation state
**API**: POST `/api/delete-blog-post` with `{filename: "post.md"}`

### File Timestamp Preservation
**Location**: `blog-save-server.js:72-89`
**Issue**: `fs.writeFile` destroys original creation date
**Fix**: Store `originalStats` before write, restore with `fs.utimes`
**Critical**: Preserves archival file dates when editing

## Schema Validation Failures (2025-01-13)

### Required Field Defaults
**Location**: `notepad.astro:3071-3079` (all save methods)
**Issue**: Astro schema requires `description` field - empty saves fail
**Fix**: Chain fallbacks: `value || title || 'No description provided'`
**Pattern**: All metadata fields need defaults to prevent schema errors

## Smooth UI Updates Without Refresh

### Delete Animation
**Location**: `notepad.astro:734-758` (CSS), `:2968-2983` (blog), `:2911-2918` (notes)
**Pattern**: Add `.deleting` class → wait 300ms → remove from DOM + array
**Critical**: Update data structures AFTER animation completes

### New Post Addition
**Location**: `notepad.astro:3157-3213` (save handler), `:1379-1386` (populateBlogPosts)
**Non-obvious**: Must update `currentBlogPostId` from temp to real ID
**Animation**: Pass `highlightNewId` to `populateBlogPosts()` for fade-in
**Data flow**: Add to `window.BLOG_POSTS` → repopulate list → no refresh needed

## Astro Dev Server Reload Handling - SOLVED! (2025-01-13)

### Critical Implementation Details
**Core issue**: Astro HMR triggers on ANY file change in src/content/blog/
**Solution**: Defer disk writes via save queue

### Key Components
1. **pendingBlogSave** (:1297) - Stores {blogPostId, title, content, metadata, timestamp}
2. **queueBlogSave()** (:3112) - Captures state WITHOUT disk write
3. **executePendingSave()** (:3165) - Actual disk write + HMR trigger
4. **Auto-execute hooks**: 
   - loadNote(:1705) - `await this.executePendingSave()`
   - loadBlogPost(:1501) - Before loading different post
   - createNewBlogPost(:3605) - Before creating new

### State Restoration After Reload
**Push button handler** (:3676-3700):
```javascript
// Store BEFORE executePendingSave
sessionStorage.setItem('notepad:pendingReload', {
  blogPostId: this.pendingBlogSave.blogPostId,
  scrollPosition: window.scrollY,
  editorScrollPosition: editor.scrollTop,
  timestamp: Date.now()
})
```

**Init restoration** (:1342-1380):
- Checks pendingReload within 5sec window
- Calls `await this.loadBlogPost(blogPostId)`
- Restores scroll positions IMMEDIATELY (no delay)

### NEW POST ID MAPPING TRAP
**Location**: :3279-3289
**Issue**: New posts have temp IDs ('new-post-123') → real ID after save
**Fix**: Update sessionStorage state with real ID from result.filename
```javascript
if (pending.blogPostId.startsWith('new-post-')) {
  const newPostId = result.filename.replace('.md', '');
  // Update pending reload state with REAL ID
  state.blogPostId = newPostId;
  sessionStorage.setItem('notepad:pendingReload', JSON.stringify(state));
}
```

### UI State Management
- **Push button visibility**: Show on queueBlogSave(:3136), hide on execute(:3303)
- **Warning on unload**: beforeunload handler(:3822) if pendingBlogSave exists
- **Button text change**: "save to blog" → "queue save" (:902)

## Blog Post Category Organization (2025-01-13)

### Feature Overview
**Location**: `src/pages/notepad.astro:1471-1600` (populateBlogPosts)
**Purpose**: Organize blog posts into collapsible category folders matching main index

### Implementation Components

#### 1. Category Collection
**getExistingCategories()** (:3586-3603)
- Extracts unique categories from `window.BLOG_POSTS`
- Always includes 'uncategorized' as fallback
- Sorts: uncategorized first, then alphabetical

#### 2. New Post Category Selection
**createNewBlogPost()** (:3606-3634)
- Prompts user with numbered list of existing categories
- Allows new category creation via text input
- Pre-fills `meta-category` field with selection
- Shows selected category in meta text

#### 3. Visual Folder Organization
**populateBlogPosts()** (:1487-1600)
- Groups posts by category
- Creates collapsible folder UI:
  ```
  📂 uncategorized/ (6)
  📁 articles/ (4)
  ```
- Persistent expand/collapse state via localStorage['notepad:expandedBlogCategories']
- Click handler for toggle (:4043-4065)

### Critical Details
- **Category normalization**: Always lowercase in metadata
- **Folder icons**: 📂 (open) vs 📁 (closed)
- **Default expanded**: 'uncategorized' category starts open
- **Post sorting**: Within category, newest first by pubDate