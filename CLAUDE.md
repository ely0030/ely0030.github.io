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
- Click "[new blog post]" → prompts for category selection (choose existing or create new)
- Blog posts organized in collapsible category folders (matches main index)
- Fill metadata fields (category auto-filled from selection)
- Click "[save to blog]" during dev to save directly
- Requires `npm run dev` for save functionality
- **New**: getExistingCategories() at :3586, createNewBlogPost() at :3606

## Need More Context?
Start with `docs/LLM_CONTEXT.md` for complete details.