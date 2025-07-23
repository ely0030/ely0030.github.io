# CLAUDE.md - AI Assistant Context

Quick reference for AI assistants. Read this FIRST.

## Project Overview
Personal blog built with Astro. Minimalist aesthetic, multiple page types, custom features.

## Critical Files to Know
- **docs/LLM_CONTEXT.md** - Complete project documentation
- **docs/troubleshooting.md** - Common issues and solutions
- **docs/css-spacing-pitfalls.md** - CSS traps (READ if spacing seems broken)
- **src/styles/global.css** - All styling (2000+ lines)
- **src/pages/index.astro** - Homepage with folder navigation
- **src/layouts/BlogPost.astro** - Main blog layout

## Development Commands
```bash
npm run dev          # Start dev server (port 4321)
./run-dev.sh        # With auto-conversion for literature pages
npm run build       # Production build
./host.sh           # Network hosting
```

## Notepad Shortcuts
- `Cmd/Ctrl+M` - Toggle edit mode (images ↔ markdown text)
- `Cmd/Ctrl+S` - Save current note
- `Tab` - Indent (2 spaces)
- `Shift+Tab` - Unindent
- **Auto-toggle**: Click in = edit mode, click out = view mode (unless "manual mode" checked)
- **Lists**: Bullet (-, *, +) and numbered (1.) lists render with visible syntax

## Known Pitfalls (Avoid These!)

### 1. CSS white-space: pre-line
**NEVER** use this with prose content. Creates unfixable spacing.
- Location: BlogPost.astro:105 (removed 2025-01-04)
- Wasted 2+ hours debugging

### 2. Astro Style Scoping
Component styles are scoped by default. Use `<style is:global>` for cross-component styles.

### 3. Literature Page Line Breaks
Markdown collapses newlines. Use:
- `<br>` tags manually
- Auto-converter in `run-dev.sh`
- Never try CSS-only solutions

### 4. Folder Animation Flicker
Multiple scripts fight for control. Solution involves `body.no-transitions` class.

### 5. Notepad Editor Cursor Jumps
**NEVER** replace innerHTML while user typing. Causes cursor to jump.
- Location: notepad.astro:848-872
- Solution: Only format on blur when editor not focused
- See: docs/notepad-critical-knowledge.md

### 6. Notepad Image State Loss
**CRITICAL**: Image position/size resets on blur without preservation
- Location: notepad.astro:1433-1448 (formatMarkdownLine)
- Must preserve data-position/data-size through placeholder
- CSS position classes need !important + explicit margins

### 7. Dynamic Element CSS Scoping
Astro component styles DON'T apply to JS-created elements
- Location: notepad.astro delete buttons
- Failed: `<style is:global>` breaks everything
- Fix: Apply inline styles in JavaScript when creating elements

### 8. CSS Grid Column Width Mismatch
Grid template columns MUST match actual content width requirements.
- Location: notepad.astro:33-44
- Issue: 250px grid < 300px min-width = 50px overflow
- Fix: Match grid column to content needs

### 9. JSX/HTML Whitespace IS Content
Whitespace between elements renders as visible space. CSS margins won't fix it.
- Location: index.astro:171 (visual markers)
- Issue: `<span>!</span> <a>Title</a>` creates unfixable gap
- Fix: `<span>!</span><a>Title</a>` (no whitespace)
- Wasted 30min on CSS margin tweaks

### 10. Notepad HTML Escaping Order 🔥
**CRITICAL**: Must parse image URLs BEFORE HTML escaping
- Location: notepad.astro:1453-1494 (formatMarkdownLine)
- Issue: `&` → `&amp;` breaks URLSearchParams for `?position=left&size=300`
- Fix: Parse images first, create placeholders, THEN escape HTML
- Wasted 2+ hours (attributes lost on edit mode toggle)

### 11. Blog Subfolder Routing
**CRITICAL**: Subfolders in content/blog require [...slug].astro not [slug].astro
- Location: src/pages/[...slug].astro (renamed from [slug].astro)
- Issue: `/saved/post-name/` returns 404 with regular [slug].astro
- Fix: Use spread operator [...slug] for nested path support
- Note: Filesystem folders ≠ visual categories (see docs/category_system.md)

### 12. Blog Post Filename Preservation 🔥
**CRITICAL**: Editing existing posts must preserve original filename
- Location: notepad.astro:2973-2982 (saveBlogPostToAPI)
- Issue: Title-based slug generation creates duplicates instead of updating
- Fix: Check if editing existing (`!currentBlogPostId.startsWith('new-post-')`)
- Wasted: Debug time figuring why saves "weren't working" (they were creating new files)

### 13. File Timestamp Preservation
**CRITICAL**: Editing files destroys creation dates
- Location: blog-save-server.js:72-89
- Issue: `fs.writeFile` overwrites all file metadata
- Fix: Store `originalStats` → write → restore with `fs.utimes`
- Important for: Archival purposes, file history tracking

### 14. Blog Schema Validation Trap
**CRITICAL**: Empty fields cause Astro build errors
- Location: notepad.astro:3071-3079
- Issue: `description` is required field, crashes on empty
- Fix: Chain defaults `value || title || 'No description provided'`
- Apply to: ALL metadata fields in save functions

### 15. Page Refresh Anti-pattern
**CRITICAL**: Don't refresh after saves/deletes
- Location: notepad.astro:3157-3213 (removed window.location.reload)
- Issue: Jarring UX, interrupts workflow
- Fix: Update DOM/arrays in place, use animations
- Key: `window.BLOG_POSTS` manipulation + `populateBlogPosts()`

### 16. Astro Dev Server Auto-Reload - SOLVED with Save Queue 🔥
**CRITICAL**: Astro HMR watches src/content/blog/ → file change = page reload
- Location: notepad.astro:3111-3310 (queue implementation)
- Key insight: Can't prevent reload, so defer disk writes
- `pendingBlogSave` holds {blogPostId, title, content, metadata}
- `executePendingSave()` at :3165 → actual disk write
- Auto-triggers: loadNote(:1705), loadBlogPost(:1501), createNewBlogPost(:3605)
- State restoration: :1342-1380 (INSTANT, no delay) + :3279-3289 (new post ID update)
- **GOTCHA**: New posts need ID mapping (temp → real) for reload restore

### 17. ContentEditable Newline Preservation
**ISSUE**: `editor.textContent = plainText` loses \n in contentEditable
- Location: notepad.astro:2709-2717
- Fix: Split lines → map to divs with escapeHtml
- Empty lines → `<div class="empty-line">&nbsp;</div>`
- **WHY**: contentEditable needs block elements for line breaks

### 18. Category Input UX Failure
**ISSUE**: Prompt popup for category on new post = bad UX
- Location: notepad.astro:3884 (createNewBlogPost)
- Fix: Removed prompt entirely - defaults to "uncategorized"
- User changes category in metadata field after creation
- Sanitization STILL happens in queueBlogSave (:3481) on save

### 19. Operation Queue System (2025-01-15) 🔥
**SOLUTION**: Batch all blog operations until manual push
- Location: notepad.astro:1290-1524 (OperationQueue class)
- No more auto-saves on navigation - full user control
- Operations deduped: save→save = latest, create→delete = removed
- Visual indicators: orange dot on pending posts, button shows count
- **CRITICAL**: Deletes execute before saves to prevent conflicts
- Queue persists in sessionStorage across refreshes
- **GOTCHA**: executeSave MUST generate frontmatter (:1478-1495) - server expects full markdown not raw content

### 20. Planning Wall ContentEditable (2025-01-18) 🔥
**CRITICAL**: Description fields use contenteditable, NOT textarea
- Location: planning-wall.astro:704-786
- Click → cursor at exact position via `caretRangeFromPoint()`
- Enter key inserts `<br>` + `\u200B` (zero-width space) for cursor
- **GOTCHA**: Must strip `\u200B` on save (:752)
- TreeWalker extracts text preserving BR→\n conversion
- **Selection styling** (2025-01-21): planning-wall.astro:122-130
  - Orange border (1px #ff5500) + double shadow effect
  - Header gets subtle orange tint on selection
  - Smooth 0.15s transitions for elegant feel

### 21. Button Focus Outline CSS Specificity
**ISSUE**: Blue outline persists on buttons despite `outline: none`
- Location: global.css:936-938 has `button:focus { outline: 2px solid rgba(0, 85, 187, 0.5) }`
- Component `.class:focus` loses to global `button:focus` selector
- Fix: Use `button.class:focus { outline: none !important }`
- Applied to: notepad folder toggles, collapse all button, main index folders

### 21. Markdown Newline Preservation for Literature Pages 🔥
**ISSUE**: Multiple newlines not preserved exactly as typed
- Location: src/utils/remark-preserve-newlines.js + astro.config.mjs:17
- Failed attempts: Inserting HTML/text nodes between paragraphs (wrong AST level)
- **Solution**: Add `break` nodes to paragraph's children array: `prevNode.children.push({type: 'break'})`
- CSS fix: global.css:1783-1785 - `p:has(br:last-child) + p { margin-top: 0 }` removes gap
- **Critical**: Must restart dev server after astro.config.mjs changes
- Time wasted: 3+ hours trying wrong AST manipulation approaches

### 22. ContentEditable Empty Editor BR Tags (2025-01-19) 🔥
**CRITICAL**: ContentEditable auto-inserts `<br>` in empty editors
- Location: notepad.astro:2470-2472 (getPlainTextFromEditor), :2526-2556 (TreeWalker)
- Issue: Empty new notes showed whitespace block
- Root cause: `<br>` → TreeWalker converts to `\n` → split('\n') creates `['']` → empty-line div
- Fix: Detect BR-only content and return empty string
- **GOTCHA**: Must check BOTH direct innerHTML and TreeWalker path

### 23. Empty String Split Trap (2025-01-19)
**CRITICAL**: `''.split('\n')` returns `['']` NOT `[]`
- Location: notepad.astro:3282-3303 (toggleEditMode), :2574-2579 (applyMarkdownFormatting)
- Issue: Empty content creates one empty-line div with `&nbsp;`
- Fix: Explicit empty string check before split
- Wasted: 1+ hour debugging phantom whitespace

### 24. Notepad List Rendering (2025-01-19)
**FEATURE**: Markdown lists render with visible syntax
- Location: notepad.astro:2678-2694 (formatMarkdownLine), :2607-2627 (formatInlineMarkdown)
- Supports: `- `, `* `, `+ ` bullets, `1. ` numbered lists, nested with 2-space indent
- Pattern: Detect list syntax → wrap in span → apply inline formatting to content
- **CRITICAL**: Must handle inline markdown (bold/italic/code/links) within list items

### 25. Protected Proxy .env Loading (2025-01-20) 🔥
**CRITICAL**: https-proxy-protected.cjs MUST load .env file
- Location: https-proxy-protected.cjs:1 - needs `require('dotenv').config()`
- Issue: Proxy uses default password, API uses .env password → token mismatch
- Symptoms: Login succeeds but still shows "Unauthorized" on every request
- Fix: Add dotenv loading at top of proxy file
- Wasted: 30+ min debugging "working" auth that wasn't working

### 26. Protected Mode Login Page Styling (2025-01-21) 🔥
**CRITICAL**: Protected proxy login is NOT PasswordGate component
- Location: https-proxy-protected.cjs:80-173 (embedded HTML/CSS)
- Issue: Searched wrong files - it's inline HTML in proxy, not a component
- Fix: Edit styles directly in loginPageHTML const
- Final design: Minimal - just password input + login button at 40vh
- **GOTCHA**: Three different password UIs exist:
  - PasswordGate.astro (blog post protection)
  - index.astro inline form (private link clicks)
  - https-proxy-protected.cjs (site-wide protection)

## Page Types
- **blog** - Standard blog post (default)
- **magazine** - Larger text, wider spacing
- **stanza** - Poetry/prose with reading progress bar
- **literature/2/3** - Dense text layouts (see warnings above)
- **book** - Paper texture effect
- **notepad** - Obsidian-style editor (see docs/notepad-critical-knowledge.md)

## Quick Wins
- Visual markers: Add `markType`, `markCount`, `markColor` to frontmatter
- Password protect: Add `private: true` and `passwordHash: 'sha256hash'`
- Categories: Add `category: "name"` (lowercase only)

## Testing Reminders
- **Always test in production build** - CSS load order differs
- **Check multiple page types** - Styles can conflict
- **Verify on mobile** - Responsive breakpoints at 768px, 1000px

## Recent Issues (2025-01-04)
- Fixed excessive spacing between paragraphs and lists
- Root cause: `white-space: pre-line` (not margin/padding)
- Solution: Remove the property entirely

## Security Setup (2025-01-19)
- **Authentication added** to protect against IoT devices on network
- **Quick setup**: Create `.env` with `BLOG_AUTH_PASSWORD=your-password`
- **Use secure server**: Change `blog-save-server.js` → `blog-save-server-secure.js` in scripts
- **Features**: Rate limiting (5 attempts/15min), path traversal protection
- **See**: `SECURITY-SETUP.md` for full instructions

## Protected Mode (2025-01-20) 🔒
- **Complete site protection**: Requires password to view ANY page
- **Windows**: Run `start-https-server-PROTECTED.bat`
- **Mac/Unix**: Run `./run-dev-protected.sh`
- **How it works**: Protected proxy shows login page for all unauthenticated requests
- **See**: `PROTECTED-MODE-SETUP.md` for details

## Image Organization
- **Pattern**: Per-post folders `/public/post-name/` + shared `/public/shared/`
- **Reference**: Absolute paths `/shared/image.webp`
- **Critical**: Figure classes work identically across ALL pageTypes including literature
- **Example**: See roger-bannister's-feed.md for literature2 image usage

## Where to Look
- **Styling issues**: src/styles/global.css (search for body.pageType)
- **Build issues**: astro.config.mjs, vite settings
- **Content issues**: src/content.config.ts for schema
- **Homepage layout**: src/pages/index.astro (folder system)
- **Notepad issues**: docs/notepad-critical-knowledge.md (MUST READ)

## Do's and Don'ts
✅ DO:
- Read error messages carefully - Astro has good diagnostics
- Use grep/search before assuming something doesn't exist
- Test CSS changes in production build
- Check docs/ folder for existing solutions

❌ DON'T:
- Use `white-space: pre-line` with prose
- Forget `is:global` on component styles
- Try to preserve markdown line breaks with CSS
- Assume dev server CSS order matches production

## Notepad Blog Editor
- Create/edit blog posts at `/notepad`
- Click "[new blog post]" → creates new post with "uncategorized" category
- Blog posts organized in collapsible category folders (matches main index)
- Fill metadata fields (change category in metadata editor)
- **NEW Queue System**: All changes batched until "[Push Changes (n)]" clicked
  - No auto-saves - full control over when to trigger refresh
  - Visual indicators: orange • on posts with pending changes
  - Smart deduplication: multiple saves = only latest pushed
  - Queue persists across page refreshes
- Requires `npm run dev` for save functionality
- **Category input**: Change in meta-category field (lowercase auto-applied at :3481)

## Windows Setup (2025-01-20) 🔥
**CRITICAL**: Windows setup has specific gotchas and fixes

### Quick Start
```batch
# Use the DEBUG batch file for troubleshooting
start-https-server-DEBUG.bat
```

### Common Windows Issues & Fixes

#### 1. HTTPS Proxy Header Error
**Error**: `TypeError [ERR_HTTP_INVALID_HEADER_VALUE]: Invalid value "undefined"`
- **Location**: https-proxy.cjs header handling
- **Fix**: Use `delete proxyHeaders['accept-encoding']` not `undefined`
- **Ticket**: `_OPS/TICKETS/_open/https-proxy-header-error.md`

#### 2. BLOG_POSTS Not Loading in Notepad
**Error**: Notepad shows no posts, can't create new ones
- **Cause**: Missing `handleLogout` function stops script execution
- **Fix**: Added function definition in notepad.astro:4955-4961
- **Also**: Added initialization wrapper to wait for BLOG_POSTS

#### 3. Authentication Flow
- First save attempt → 403 error (normal)
- Login modal appears → enter password from `.env`
- Subsequent saves work without prompting
- **Fix**: Modified error handling to not show alerts for auth interruptions

#### 4. Port Configuration
**DEBUG batch file kills ALL node processes first!**
- HTTPS Proxy: Port 4320
- Astro Dev: Port 4321  
- Secure API: Port 4322
- Access via: https://localhost:4320

### Certificate Generation
```batch
mkdir certs
cd certs
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -config ../generate-cert.conf
```

### See Also
- `docs/windows-pc-setup.md` - Full Windows setup guide
- `_temp/windows-setup-session-2025-01-20.md` - Detailed session log
- `docs/minipc-https-setup-log-2025-07-19.md` - Another Windows setup example

## Need More Context?
Start with `docs/LLM_CONTEXT.md` for complete details.