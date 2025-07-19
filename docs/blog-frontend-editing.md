# Blog Frontend Editing

This feature extends the notepad at `/notepad` to allow direct editing of blog posts from the browser during development.

## Overview

The notepad was extended to include a "Blog Posts/" section that lists all existing blog posts from `src/content/blog/`. Users can create new posts, edit existing ones, and save them directly back to the filesystem during development.

## Critical Operations

**Start**: `npm run dev` → `/notepad`
**Save methods**: [export post] / [save to folder] / [save to blog]
**Delete**: [del] → [sure?] → confirm (two-click safety)
**Key state**: `this.currentBlogPostId` tracks editing context

## Technical Implementation

### Data Flow
- **Build**: `getCollection('blog')` → `window.BLOG_POSTS`
- **Edit**: `loadBlogPost()` sets `this.currentBlogPostId` (CRITICAL for saves)
- **Save**: POST to `:4322/api/save-blog-post` with `{filename, content}`

### Key Implementation Details

**Filename logic** (notepad.astro:2973-2982):
- New posts: `generateSlug(title)` → `my-post.md`
- Existing: Preserve `currentBlogPostId` (includes subdirs)

**Subdirectory handling** (blog-save-server.js:44-66):
- Split path/filename before sanitizing
- Create dirs with `fs.mkdir({recursive: true})`

**Timestamp preservation** (blog-save-server.js:72-89):
- Store `originalStats` before write
- Restore with `fs.utimes(filePath, atime, mtime)`
- Preserves archival dates when editing

## Critical Failure Modes

### "Save not working" but file created
**Symptom**: Click save, page refreshes, no apparent change
**Reality**: New file created with slug-based name instead of updating original
**Fix**: Check `src/content/blog/` for duplicate files
**Prevention**: Fixed in notepad.astro:2973-2982

### Blog posts display as plain text
**Location**: CSS in wrong style block
**Fix**: Move to `<style is:global>` - see notepad.astro:673-731

### Subdirectory posts save to wrong location
**Example**: `articles/my-post` → `articles-my-post.md` (wrong)
**Fix**: blog-save-server.js:44-66 now preserves paths

### Schema validation crashes build
**Symptom**: `description: Required` error after save
**Fix**: notepad.astro:3071-3079 adds defaults for all fields

### UI refresh after operations
**Removed**: All `window.location.reload()` calls
**Pattern**: Manipulate DOM/arrays directly for smooth UX

## Security Considerations

⚠️ **Development Only**: The save server has no authentication and allows direct file writes. Never expose port 4322 to the internet or use in production.

### Password Protection
- Uses client-side SHA-256 hashing
- Stored as `passwordHash` in frontmatter
- Not secure for production use (client-side only)

## Environment Requirements
- Node.js >= 18.17.1
- Chrome/Edge for File System API features
- Port 4322 available for save server
- Write permissions to `src/content/blog/`

## Save Queue System Implementation

### Architecture
**Problem**: Astro HMR watches `src/content/blog/` → instant reload on file write
**Solution**: Defer writes until navigation events

### Key Functions
- `queueBlogSave()` (notepad.astro:3112) - Captures state to `pendingBlogSave`
- `executePendingSave()` (:3165) - Performs actual disk write
- Auto-triggers: `loadNote()`, `loadBlogPost()`, `createNewBlogPost()`

### State Restoration Flow
1. Push button stores state in `sessionStorage` (:3682-3688)
2. `executePendingSave()` writes file → Astro reloads
3. `init()` checks for `pendingReload` (:1342-1400)
4. Restores exact blog post + scroll positions

### Critical: New Post ID Mapping
- New posts use temp IDs: `new-post-{timestamp}`
- After save, real ID from `result.filename`
- **MUST update sessionStorage** (:3279-3289) or restore fails

## Known Limitations
1. Save functionality only works during development
2. File System API only works in Chromium browsers
3. Password protection is client-side only
4. No conflict resolution for concurrent edits
5. Pending changes warning on page unload can't force save (browser limitation)

## Future Enhancements
- Real-time preview of rendered markdown
- Auto-save functionality
- Git integration for version control
- Conflict detection for concurrent edits
- Production-ready save mechanism with auth