# LLM Context Documentation for ely0030's Blog

## Quick Start

This is a minimalist Astro blog with custom features for password-protected posts, multiple visual page styles, and a unique countdown timer. Built with Astro 5.7.1, deployed to Netlify.

**Key Commands:**
```bash
npm install        # Install dependencies (requires Node >=18.17.1)
npm run dev        # Start dev server (runs run-dev.sh script with NVM)
npm run build      # Build for production
npm run preview    # Preview production build
bash host.sh       # Quick build and serve locally
```

**Site Info:**
- URL: https://ely0030.github.io
- Title: "30 months left" (countdown to Oct 1, 2027)
- Stack: Astro, MDX, Tufte CSS, custom components

## Architecture Overview

### Tech Stack
- **Framework**: Astro 5.7.1 (static site generator)
- **Content**: Markdown/MDX with frontmatter
- **Styling**: Custom CSS inspired by Tufte, ET Book fonts
- **Deployment**: Netlify (Node 20.3.0)
- **Password Protection**: Client-side SHA-256 hashing
- **Additional Features**: RSS feed, XML sitemap, archive system, Obsidian-style notepad

### Project Structure
```
/
├── src/
│   ├── components/     # Reusable Astro components
│   ├── content/
│   │   ├── blog/       # Blog posts (MD/MDX)
│   │   └── drafts/     # Auto-converted on dev start (2025-07-02)
│   ├── layouts/        # Page layouts (BlogPost, BookPage)
│   ├── pages/          # Routes ([slug].astro handles blog posts)
│   ├── styles/         # Global CSS, Prism syntax highlighting
│   └── utils/          # Converters, utilities
├── public/             # Static assets (fonts, images, textures)
├── archive/            # Static HTML archives (manually maintained)
├── docs/               # Internal documentation
└── dist/               # Build output (gitignored)
```

## Core Features

### 1. Password-Protected Posts
Posts can be made private by adding to frontmatter:
```yaml
private: true
passwordHash: "sha256-hash-here"
```

**Implementation:**
- Index page shows 🔒 icon on hover, inline password prompt on click
- Successful auth stored in localStorage as `pw:/slug`
- Direct URLs protected by `PasswordGate.astro` component
- Animations: shake on wrong password, rotate+unlock on success

### 2. Dynamic Page Title Countdown
The `BaseHead.astro` component overrides the page title to show a countdown to October 1, 2027:
- Format: "X months Y days Z hours"
- Updates every second
- Implemented via client-side JavaScript

### 3. Multiple Page Styles
Posts support different visual styles via `pageType` frontmatter:

**blog** (default):
- Optimized for text, tighter spacing
- Sans-serif, 16px prose text
- Minimal paragraph gaps

**magazine**:
- Image-rich layout, generous spacing
- Larger first paragraph
- More heading separation

**stanza**:
- Poetry/stream-of-consciousness
- Centered single column
- Special `.stanza` paragraph class for extra spacing
- Pull quotes with `.pull` class

**literature** (CRITICAL - added 2025-07-01, updated 2025-07-03):
- Ultra-minimal essay layout: 14px font, 1.3 line-height, 480px width
- Left-aligned (NOT centered - common mistake)
- System sans-serif (NOT serif - counterintuitive)
- Includes draggable StyleEditor component (max-width: 480-1200px range)
- Interactive heading navigation: hash indicators, scroll tracking, click-to-scroll
- TRAP: Line breaks require `<br>` tags - markdown collapses multiple newlines
- TRAP: Horizontal rules need blank lines: `\n\n---\n\n` NOT `\n---\n`
- TRAP: Auto-converter must quote strings or numeric titles fail
- See `docs/literature-type-implementation.md` for critical pitfalls

**literature2** (added 2025-07-02):
- Fixed variant: 15px font, 1.3 line-height, 660px width, 0.9em paragraph spacing
- No StyleEditor - intentionally static settings
- Same line break handling as literature

**literature3** (added 2025-07-03):
- Maximum density: 14px font, 1.1 line-height, 480px width
- 25px padding, 0.5em paragraph spacing
- No StyleEditor - fixed settings
- Inherits all literature features including heading navigation

**book** (special layout):
- Uses `BookPage.astro` layout
- Paper texture background
- Drop caps, justified text
- Optional photocopy/perspective effects

### 4. Custom Post Marks
iOS Reminders-style marks for posts:
```yaml
markType: 'exclamation'  # or 'question'
markCount: 2             # 1-3
markColor: 'orange'      # grey/orange/blue
```
Shows as colored !!/??? before post title on index.

### 5. Advanced Components

**BaseHead.astro**: SEO, favicons, countdown timer
**Header.astro**: Minimal nav (Home, About only)
**CodeBlock.astro**: Tufte-style syntax highlighting with copy button
**PasswordGate.astro**: Full-page password protection
**FormattedDate.astro**: Consistent date formatting

### 6. RSS Feed & Sitemap

**RSS Feed**: Auto-generated at `/rss.xml`
- Includes all blog posts
- Uses site title/description from consts.ts
- Implemented in `/src/pages/rss.xml.js`

**XML Sitemap**: Auto-generated at `/sitemap-index.xml`
- Includes all pages and blog posts
- Configured via @astrojs/sitemap integration
- Helps with SEO and search engine discovery

### 7. Archive System

Static HTML files in `/archive/master/` for preserved content:
- Manually maintained legacy posts
- Linked from homepage (e.g., "You Should Exercise")
- Not part of the content collection

## Content Management

### Blog Post Schema
```typescript
{
  title: string
  description: string
  pubDate: Date
  updatedDate?: Date
  heroImage?: string
  private?: boolean
  passwordHash?: string
  markType?: 'exclamation' | 'question'
  markCount?: 1 | 2 | 3
  markColor?: 'grey' | 'orange' | 'blue'
  pageType?: 'blog' | 'magazine' | 'stanza' | 'essay' | 'literature' | 'literature2' | 'literature3' | 'notepad'
  pageLayout?: 'blog' | 'book'
  category?: string
}
```

### Image Positioning Classes
Tufte-inspired image placement:
- `.figure-left/right`: Float with text wrap (35% width)
- `.figure-mid-left/right`: Larger float (50% width)
- `.figure-center`: Centered block (65% width)
- `.figure-full`: Full width
- `.figure-margin`: Pushes into margin (30% width)

Options: `.figure-bordered`, `.figure-shadow`

## Styling System

### Typography
- Body: System font stack, 14px base
- Prose: 16-17px depending on pageType
- Headers: Bold, uppercase H2s
- Code: Consolas/monospace, dark background

### Color Palette
```css
--body-background: #fdfdfd
--body-font-color: #000
--color-link: #0055bb
--gray-200: #f6f8fa
--gray-500: #6e7781
--accent: #ff5500
```

### Layout Grid
Three-column grid on desktop:
- Sidebar (1fr): Navigation
- Main (5fr): Content
- Sidenotes (2fr): Margin notes

Stacks vertically on mobile <1000px.

## Key Files to Edit

**Adding Content:**
- `/src/content/blog/` - Create new .md/.mdx files
  - Supports subfolders for organization (e.g., `/saved/`, `/protocols/`)
  - URLs reflect folder structure via `[...slug].astro` routing

**Modifying Styles:**
- `/src/styles/global.css` - All custom styles
- `/src/layouts/BlogPost.astro` - Blog post template
- `/src/components/` - Individual component styles

**Site Configuration:**
- `/src/consts.ts` - Site title/description
- `/astro.config.mjs` - Build settings
- `/src/content.config.ts` - Content schema

## Development Workflow

1. **Local Development**: 
   - `npm run dev` (uses NVM to ensure Node 18.17.1, auto-converts drafts)
   - Or `bash host.sh` for quick build + serve
2. **Creating Posts**: 
   - Drop .md files in `/src/content/drafts/` for auto-conversion
   - Or add directly to `/src/content/blog/`
3. **Auto-conversion** (2025-07-02):
   - Place files in `drafts/` folder
   - `npm run dev` auto-generates frontmatter if missing
   - Converts literature pages (3+ newlines → `<br>` tags)
   - Moves to `blog/` folder automatically
4. **Password Protection**: Generate SHA-256 hash, add to frontmatter
5. **Custom Styling**: Use pageType or custom CSS classes
6. **Images**: 
   - Organization: Per-post folders `/public/post-name/` + shared `/public/shared/`
   - Usage: `<div class="figure figure-center"><img src="/shared/img.webp"></div>`
   - Figure classes work identically across ALL pageTypes (no CSS conflicts)
7. **Deploy**: Push to git, Netlify auto-deploys

### Development Scripts
- `run-dev.sh`: Loads NVM, converts drafts, starts dev server
- `host.sh`: Builds site and serves with `npx serve`
- `auto-convert-literature.js`: Batch processes drafts folder

## Advanced Features

### Sidenotes
Tufte-style margin notes:
```html
<label for="sn-1" class="sidenote-number"></label>
<input type="checkbox" id="sn-1" class="margin-toggle"/>
<span class="sidenote">Note content here</span>
```

### Reading Mode Toggle
BlogPost layout includes "Aa" button for compact/expanded view.

### Table of Contents
Auto-generated from H2/H3 headings in sidebar.

## Common Tasks

**Change countdown date:**
Edit the date in `BaseHead.astro` timer script (currently Oct 1, 2027).

**Add new page type:**
1. Update schema in `content.config.ts`
2. Add CSS rules in `global.css` for `body.newtype`

**Modify password UI:**
Edit animations/behavior in `/src/pages/index.astro` script section.

**Change site structure:**
- Routes: Add/modify files in `/src/pages/`
- Navigation: Edit `Header.astro`

**Add visual post markers:**
Add to frontmatter: `markType`, `markCount`, `markColor`

**Use book layout:**
Set frontmatter: `layout: "../layouts/BookPage.astro"`

**Add/modify categories:**
1. Edit `categoryMeta` object in `index.astro:40-49` for icons/colors
2. Edit `sections` object in `index.astro:52-58` to reorganize groupings
3. Add `category: "name"` to post frontmatter (lowercase!)

## Critical Implementation Notes (2025-07-04)

### Category System Hidden Dependencies
- **Bullet points**: From `global.css:1091-1097` via `.post-item::before` - NOT index.astro
- **Post counts**: Non-clickable via wrapper div + `pointer-events: none` (lines 245-254)
- **File indentation**: 1.5em via `.post-item` padding (lines 312-316)
- **Category colors**: Propagated via inline `style="--category-color: #hex"`

### Common Debugging Pitfalls
1. **"I removed X but it's still there"**: Check global.css, verify with grep, use replace_all flag
2. **Edit reverts**: Multiple edits to same line may not persist - verify with cat/grep
3. **Case sensitivity**: Frontmatter `category:` not `Category:`
4. **Archive special case**: Hardcoded display, doesn't iterate posts array
5. **Folder animation jump**: Multiple scripts competing to set heights
   - Inline script (line 452-457) vs DOMContentLoaded (line 694-705)
   - Solution: Disable ALL transitions during load with body.no-transitions class
   - Critical: Must use `requestAnimationFrame` after window.load to re-enable
6. **CSS spacing unfixable**: Check `white-space: pre-line` first (BlogPost.astro:105)
   - Preserves newlines between HTML elements as visual space
   - No margin/padding will fix it - must remove the property
   - Wasted 2+ hours on 2025-01-04 before discovering this
7. **Astro styles not applying**: Component styles are scoped - use `<style is:global>`
8. **Notepad Map/Object confusion**: Refactored code uses Map not Object
   - Use `notes.get(id)` not `notes[id]`
   - Use `Array.from(notes.keys())` not `Object.keys(notes)`
9. **Local Notes folder won't toggle**: Must match exact folder-group structure
   - See `src/pages/index.astro:172-197` for required HTML

## Performance Notes

- Static build with zero client JS (except countdown/password)
- Images inlined if <4KB (vite config)
- Prism syntax highlighting with selective token loading
- Font preloading for Atkinson/ET Book

## Security Considerations

- Password protection is client-side only
- SHA-256 hashes visible in HTML
- Suitable for casual privacy, not sensitive data
- Consider server-side auth for true security

## Deployment

Configured for Netlify:
- Auto-deploys from git pushes
- Node 20.3.0 specified in netlify.toml
- Builds to `/dist/` directory
- No server-side functionality
- Generates RSS feed and sitemap on build

## Notepad Editor (/notepad)

Obsidian-style note-taking interface with blog post creation/editing capabilities.

### Key Features
- **Local notes**: Browser IndexedDB storage, markdown support, image paste
- **Blog editor**: Create/edit posts directly, organized in category folders
- **Category selection**: On new post creation, prompts for category (existing or new)
- **Save queue**: Defers disk writes to handle Astro HMR reloads gracefully

### Critical Implementation
- **getExistingCategories()** (:3586) - Collects unique categories from posts
- **createNewBlogPost()** (:3606) - Prompts for category, pre-fills metadata
- **populateBlogPosts()** (:1471) - Groups posts by category with collapsible UI
- **State persistence**: localStorage for expanded folders, sessionStorage for reload handling

See `/docs/notepad-critical-knowledge.md` for implementation pitfalls.

## Additional Documentation

For detailed guides on specific features, see:
- `/docs/development-workflow.md` - Dev setup and commands
- `/docs/visual-markers.md` - Post marker system
- `/docs/rss-sitemap.md` - Feed and sitemap details
- `/docs/book-layout.md` - Book page styling
- `/docs/troubleshooting.md` - Common issues and fixes
- `/docs/private_password_feature.md` - Password protection details
- `/docs/page_types.md` - Visual style options
- `/docs/title_countdown_feature.md` - Countdown timer details
- `/docs/notepad-critical-knowledge.md` - Notepad implementation details

---

This documentation provides complete context for understanding and modifying the site without reading all source files. For specific implementation details, refer to the inline comments in the respective files.