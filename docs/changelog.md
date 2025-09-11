# Changelog

_Last updated: 2025‑01‑24_

## 2025-01-24: Category Drag & Drop Implementation

### Added
- **Drag & Drop Category Organization**
  - Categories can now be dragged between sections (Writing, Technical, Personal, etc.)
  - Visual feedback during drag with orange border indicators
  - Position-aware dropping for precise placement
  - Automatic persistence to localStorage
  - User feedback via showMessage() confirmation

### Technical Details
- Event handlers: `handleCategoryDragStart`, `handleCategoryDrop`, `handleCategoryDragOver`
- Document-level event delegation for dynamic content
- Complete DOM rebuild after drop via `populateBlogPosts()`
- Visual-only organization - doesn't change post metadata

### Documentation
- Created `_temp/changelog-drag-drop-categories.md`
- Updated `notepad-drag-drop-categories.md` with implementation details
- Added section to `notepad-critical-knowledge.md`

## 2025-07-24: Notepad Save Debugging & Astro Caching Discovery

### Discovered
- **Astro Content Collection Caching Issue**
  - Saves work correctly but dev server shows cached content
  - File on disk updates properly, UI shows old version
  - No fix available in Astro v5.12.0 - requires server restart
  - Only affects development mode, production works fine

### Added
- **Comprehensive Debug Logging**
  - `notepad.astro` - Content extraction and save queue logging
  - `blog-save-server-secure.js` - Server-side content preview logging
  - `host-network-https.ps1` - Console logging configuration

### Fixed
- **Windows PowerShell Script**
  - Changed to `-NoNewWindow` for visible server logs
  - Fixed `npx` not found error (use `npx.cmd` on Windows)
  - Removed "Press any key" prompt for cleaner operation

### Documentation
- Updated `notepad-critical-knowledge.md` with Astro caching details
- Added debugging steps to `troubleshooting.md`
- Enhanced `windows-pc-setup.md` with console logging setup
- Updated `CLAUDE.md` with new pitfall #27

## 2025-01-24: Cross-Platform Font System & Notepad Full Width

### Changed
- **Complete Typography Overhaul**
  - Replaced generic monospace with Apple-inspired SF font stack
  - Added -webkit-font-smoothing for consistent rendering
  - Windows now uses Consolas/Cascadia Code instead of Courier New
  - Mac uses SF Mono/Menlo for authentic Apple experience
- **Replaced Emoji Icons with Text Symbols**
  - Folder icons now use `[A]`, `[i]`, `[C]` etc. for consistency
  - Eliminates platform-specific emoji rendering differences
- **Notepad Full Width Layout**
  - Removed 1200px max-width constraint
  - Sidebar reduced from 300px to 250px
  - Editor now uses entire screen width

### Fixed
- Windows font rendering appearing "soft and round like Comic Sans"
- Inconsistent emoji appearance between platforms
- Notepad not utilizing full screen space on Windows

### Technical Details
- `src/styles/global.css` - Complete font system update
- `src/pages/notepad.astro` - Width constraints removed
- `src/pages/index.astro` - Icon replacements
- Updated `docs/font_system.md` with new strategy

## 2025-07-21: Notepad Category Drag-Drop Fixes

### Fixed
- **Empty Categories Now Visible**
  - Categories without posts now display properly after drag-drop
  - Added "(no posts yet)" message for empty categories
  - Root cause: Filter at line 2357 was hiding empty categories
- **Section Expand/Collapse State**
  - Fixed sections collapsing and hiding all categories on first click
  - Root cause: Inconsistent localStorage defaults (empty array vs all sections)
  - Now defaults to all sections expanded on first load
- **Missing showMessage Method**
  - Added user feedback when dragging categories between sections
  - Shows success message: "Moved 'category' to section"

### Technical Details
- `src/pages/notepad.astro:2283` - Removed category filter
- `src/pages/notepad.astro:2270-2276` - Fixed expandedSections defaults
- `src/pages/notepad.astro:5539-5551` - Added showMessage method
- Created `docs/notepad-drag-drop-categories.md` for implementation details

### Important Note
Drag-drop is for **visual organization only** - it moves category folders between sections but does NOT re-categorize the posts themselves. Posts retain their original category metadata.

## 2025-01-19: Security Hardening & Authentication

### Added
- **Authentication System for Blog Editing**
  - Password-based auth protects all edit/delete operations
  - Rate limiting: 5 login attempts per 15 minutes
  - SHA-256 token-based sessions
  - Protects against compromised IoT devices on network
- **Secure Blog Save Server** (`blog-save-server-secure.js`)
  - Replaces unprotected `blog-save-server.js`
  - Path traversal protection prevents escaping blog directory
  - Input validation on all API endpoints
  - Environment-based password configuration
- **Client-Side Auth Manager** (`notepad-auth-patch.js`)
  - Login modal UI for notepad
  - Token persistence in localStorage
  - Auto-retry on auth failures
  - Session management with logout
- **Security Documentation**
  - `SECURITY-SETUP.md` - Quick setup guide
  - `_OPS/BLUEPRINTS/security-enhancement/` - Comprehensive future security plans
  - 6 detailed blueprints for enhanced security implementation

### Changed
- Updated all hosting scripts to support secure server
- Modified CORS to accept Authorization headers
- Enhanced error messages for auth failures

### Fixed
- Path traversal vulnerability in file operations
- Missing input validation on API endpoints

### Removed
- 10 test files from root directory (cleanup)
  - 6 test documentation files
  - 4 test image files
  - All functionality preserved in proper documentation

## 2025-01-07: Notepad Edit Mode & Image Persistence

### Added
- **Edit Mode Toggle** (Cmd/Ctrl+M)
  - Switch between rendered view (images) and raw markdown text
  - Clickable hint link in editor actions bar
  - Visual indicator shows "Edit Mode" or "View Mode"
  - Makes editing around images much easier
- **Auto-Toggle Edit Mode**
  - Click into editor → automatically enters edit mode
  - Click outside editor → automatically exits edit mode
  - "Manual mode" checkbox disables auto-toggle behavior

### Fixed
- **Image Attribute Persistence**
  - Position and size now saved in markdown: `![alt](notepad-image:id?position=left&size=300)`
  - Fixed critical HTML escaping order bug that broke URL parameter parsing
  - Attributes preserved through all operations (edit mode, note switches, drag & drop)
  - Root cause: `&` was escaped to `&amp;` before URL parsing
- **Dataset Property Loss on innerHTML Replace**
  - Fixed bug where `editor.dataset.editMode` became undefined after formatting
  - Now preserves dataset properties through innerHTML replacements
  - Root cause: DOM replacement clears all custom properties

### Changed
- Removed visual styling differences between edit/view modes
  - Both modes now use white background and black borders
  - Consistent with Apache-style aesthetic

### Technical Details
- `src/pages/notepad.astro:2012-2044` - toggleEditMode implementation
- `src/pages/notepad.astro:1453-1494` - Fixed formatMarkdownLine escaping order
- `src/pages/notepad.astro:1334-1352` - Enhanced getPlainTextFromEditor for attributes

## 2025-07-05: Notepad Image Paste Support

### Added
- Copy/paste image functionality in notepad editor
- IndexedDB storage for image blobs (primary)
- localStorage base64 fallback for compatibility
- Image markdown syntax: `![alt](notepad-image:{id})`
- Automatic image display in formatted view
- Image export as base64 in markdown files

### Technical Details
- `ImageStorage` class manages blob storage
- Object URLs for efficient memory usage
- Size limits: 5MB per image, 50MB total
- Images cleaned up when switching notes
- Images deleted with their parent note

### Implementation
- `src/pages/notepad.astro:465-616` - ImageStorage class
- `src/pages/notepad.astro:1236-1351` - Enhanced paste handler
- `src/pages/notepad.astro:1138-1147` - Image markdown rendering
- `src/pages/notepad.astro:1335-1415` - Export with embedded images

## 2025-01-05: Notepad Delete Button Enhancements

### Changed
- Delete button visibility: removed `opacity: 0` hiding mechanism
- Delete confirmation: replaced `confirm()` with inline [del] → [sure?] UI
- Delete button spacing: added actual space characters (flexbox gap failed)
- Untitled note: now deletable (auto-creates new if all deleted)

### Fixed
- CSS scoping: Astro styles didn't apply to dynamic elements
- Global link styles overriding button styles
- Focus outline removal for cleaner appearance

### Implementation Details
- `src/pages/notepad.astro:636` - Added `activatedDeletes` Set for state tracking
- `src/pages/notepad.astro:792` - Space characters between date/delete
- `src/pages/notepad.astro:804-820` - Inline styles + hover listeners
- `src/pages/notepad.astro:1098-1100` - Auto-create untitled if none exist
- `src/pages/notepad.astro:1195-1234` - Two-stage confirmation logic

### Critical Lesson
**Astro component styles don't apply to JS-created elements**. Must use inline styles or global CSS.

## 2025-07-04: Heading Hash Hover-Only Blue

### Changed
- Literature page types: heading hashes (#) now only turn blue on hover
- Active/current section headings remain grey (#999) instead of blue (#6b8ec5)
- Applies to: literature, literature3 (literature2 has no hash indicators)

### Files Modified
- `src/styles/global.css:1543-1550,1565-1572` - literature hover/active colors
- `src/styles/global.css:2121-2128,2143-2150` - literature3 hover/active colors
- `docs/page_types.md:187-189` - Updated color state documentation

### Rationale
- Reduces visual noise when reading
- Blue only appears on intentional hover interaction
- Maintains subtle grey indicator for current position

## 2025-01-04: Apache Index Enhancement

### Added
- Post dates next to filenames (format: MMM DD, YYYY)
- "Index of /" header with horizontal rule
- Visual clarity improvements:
  - Alternating row colors (rgba(0,0,0,0.02))
  - Folder group borders (#eee)
  - Stronger bullets (1.1em, bold, #333)

### Fixed
- **CRITICAL**: `.file-entry` padding-left caused massive spacing - removed
- Folder toggle made instant (0.05s step-end) - display:none breaks layout
- Date positioning: removed `margin-left: auto` for closer placement

### Changed
- Literature font size: 14px → 13px

### Files Modified
- `src/pages/index.astro:66-69,92-96,105,165-178,223,229-237,266` - Apache features
- `src/styles/global.css:1091-1097,1356` - Bullet styling, literature font
- `docs/folder-navigation.md` - Added critical implementation notes

## 2025‑07‑04: Apache-Style Folder Navigation

### Added
- Category-based folder grouping with collapsible UI
- `category` field in blog schema (`content.config.ts:27`)
- Folder state persistence via localStorage
- Tree branch display attempt (├─ └─) - removed due to alignment issues

### Critical CSS Fixes
- **Double bullet bug**: `list-style: disc` + `::before` bullets = double bullets
- **Solution**: Always use `list-style: none` with custom bullets (`global.css:395`)
- **Flexbox alignment**: Use `align-items: baseline` for bullet/text alignment

### Files Modified
- `src/pages/index.astro:29-44,67-135` - Category grouping and folder UI
- `src/content.config.ts:27` - Added category field
- `src/styles/global.css:394-398,1069-1093` - Fixed bullet conflicts

### Documentation Created
- `docs/folder-navigation.md` - Critical implementation details and pitfalls

## 2025‑07‑01: Literature Page Type Implementation

### Added
- New `literature` page type for ultra-minimal essay layout (13px, 1.2 line-height)
- `StyleEditor.astro` component - draggable panel for live typography adjustments
- CSS variables for runtime style control without recompilation

### Critical Implementation Notes
- **Layout trap fixed**: Used `max-width: none` on wrapper (centering broke left-alignment)
- **Font choice**: System sans-serif NOT serif (counterintuitive but matches minimal blogs)
- **Intentional density**: 13px/1.2 spacing is below comfortable - aesthetic choice

### Files Modified
- `src/content.config.ts:23` - Added 'literature' to pageType enum
- `src/styles/global.css:1354-1563` - Complete literature type styles
- `src/components/StyleEditor.astro` - New draggable adjustment panel
- `src/layouts/BlogPost.astro:222` - Conditional StyleEditor inclusion

### Documentation Created
- `docs/literature-type-implementation.md` - Critical implementation details
- Updated `docs/page_types.md` with failure modes and pitfalls
- Updated `docs/LLM_CONTEXT.md` with literature type warning

## 2025‑07‑01: Comprehensive Documentation Update

### Added
- Created comprehensive documentation for all undocumented features:
  - `development_workflow.md`: Development scripts, build process, and deployment
  - `rss_and_sitemap.md`: RSS feed and sitemap generation details
  - `visual_post_markers.md`: iOS-style post importance indicators
  - `archive_system.md`: Static HTML archive functionality
  - `book_page_layout.md`: Book-style page layout with effects
  - `code_block_component.md`: Custom CodeBlock component documentation
  - `build_configuration.md`: Build system and technical configuration
  - `font_system.md`: Typography and font management
  - `features_index.md`: Complete index of all features

### Enhanced
- Documented previously undocumented functionality discovered in codebase
- Created central features index for easy reference
- Added implementation details and examples for all features

## 2025‑04‑22: Code Block Improvements

### Fixed
- Resolved syntax highlighting inconsistency between MDX and Markdown files
- Fixed token coloring in code blocks by removing brute-force color override
- Ensured consistent styling between custom `<CodeBlock>` component and default Markdown code blocks

### Enhanced
- Improved code copy mechanism with better accessibility
  - Copy button now works when directly clicked (not just when clicking the code area)
  - Added fallback for browsers without Clipboard API support
  - Enhanced error handling for more reliable operation
- Added Prism token colors for standard `.astro-code` blocks to match CodeBlock styling
- Made copy button keyboard-accessible with proper click handler

### Technical Details
1. MDX files now use Prism via `mdx({ syntaxHighlight: false })` in astro.config.mjs
2. Removed blanket color override: `pre.astro-code span{color:var(--color-link) !important;}`
3. Added token-specific styling rules for proper syntax highlighting
4. Improved copy function with browser compatibility fallbacks
5. Made click handler work directly on the button element rather than requiring code area click

### Affected Files
- `astro.config.mjs`: Updated MDX integration settings
- `src/styles/global.css`: Improved code block token styling
- `src/components/CodeBlock.astro`: Enhanced copy functionality 