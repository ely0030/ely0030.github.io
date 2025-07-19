# Changelog

_Last updated: 2025‑01‑07_

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