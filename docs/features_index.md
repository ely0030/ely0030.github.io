# Features Index

This document provides a comprehensive index of all features available in this Astro blog, both documented and undocumented.

## Content Features

### Blog Posts
- **Location**: `/src/content/blog/`
- **Docs**: Built-in Astro feature
- **Features**: Markdown/MDX support, frontmatter, content collections

### Category System with Sections
- **Location**: `index.astro:39-80`, `content.config.ts`
- **Docs**: [category_system.md](./category_system.md)
- **Features**: Visual category icons, color-coding, section groupings
- **Critical details**:
  - Bullet points from `global.css:1091-1097` NOT index.astro
  - Post counts non-clickable via `pointer-events: none`
  - Sections added: Writing (articles/creative/ideas/thoughts), Technical, Personal, Miscellaneous
  - New categories: thoughts (💭), saved (📁 red)
  - REMOVED: alternating backgrounds, folder header backgrounds

### Visual Post Markers
- **Location**: `content.config.ts`, `index.astro`
- **Docs**: [visual-markers.md](./visual-markers.md)
- **Features**: iOS-style importance indicators (!, ?)

### Page Types
- **Location**: `content.config.ts`, layouts
- **Docs**: [page_types.md](./page_types.md)
- **Features**: blog, magazine, stanza, essay layouts

### Page Types Showcase
- **Location**: `src/pages/page-types/` (index + examples)
- **Routes**: `/page-types/`, `/page-types/{blog|magazine|stanza|literature|literature2|literature3|book}/`
- **Purpose**: Quick visual reference of each page type using the real layouts

### Private Posts
- **Location**: `PasswordGate.astro`
- **Docs**: [private_password_feature.md](./private_password_feature.md)
- **Features**: Client-side password protection

### Archive System
- **Location**: `/archive/`, `/public/`
- **Docs**: [archive_system.md](./archive_system.md)
- **Features**: Static HTML preservation

### Notepad (Obsidian-style)
- **Location**: `/src/pages/notepad.astro`, `global.css:2392-2457`
- **Docs**: [notepad-critical-knowledge.md](./notepad-critical-knowledge.md)
- **Features**: Live markdown rendering, Apache index styling, hybrid persistence
- **Storage**: localStorage (notes) + IndexedDB (images)
- **Added**: 2025-01-04, Images: 2025-01-07, Blog editing: 2025-01-13
- **Image Features**:
  - Paste from clipboard (auto-resize to 800px max)
  - Click menu: sizes (200-800px), positions (left/center/right/float)
  - Drag handle for free resize (hover bottom-right)
  - Drag image to reposition between lines
  - Export includes base64-encoded images
- **Critical**: See docs for Map/Object pitfalls, cursor preservation, image state persistence

### Blog Frontend Editing
- **Location**: `src/pages/notepad.astro` (lines 1289-2969)
- **Purpose**: Edit blog posts directly in the browser
- **Status**: Implemented, CSS styling issue fixed
- **Docs**: [blog-frontend-editing.md](./blog-frontend-editing.md)
- **Features**:
  - View all blog posts in sidebar
  - Create new posts with full metadata
  - Three save methods (export, folder, API)
  - Dev server integration on port 4322

### Music Page + Mini Player
- **Location**: `src/pages/music.astro`
- **Docs**: [music-mini-player.md](./music-mini-player.md)
- **Features**:
  - Track table with duration auto-fetch
  - Draggable mini player with physics inertia
  - Autonomous pin system (separate DOM element)
  - Double-click to pin/unpin (fixed vs absolute positioning)
  - Smart pin behavior: asymptotic slowdown, repulsion field, dart-throw tack

## Navigation Features

### Folder Navigation
- **Location**: `index.astro:95-690`, `content.config.ts:27`
- **Docs**: [folder-navigation.md](./folder-navigation.md)
- **Features**: Apache-style folders, collapsible categories with sections
- **Visual**: 
  - Section headers (Writing/, Technical/, etc) group categories
  - Category-specific icons instead of generic folders
  - Post counts "(n)" - non-clickable, only icon/name triggers expand
  - Alternating row backgrounds use category color (4% opacity)
  - No borders between categories for cleaner look
  - State persists in localStorage

### Homepage Styling (literature2)
- **Location**: `src/pages/index.astro` (`body: literature2 no-transitions`), `src/styles/global.css` (`body.literature2 .layout-wrapper`)
- **Notes**: literature2 keeps the sidebar visible (unlike literature/literature3). This ensures the nav (Home/About) aligns the same as literature2 posts.

## Layout Features

### Book Page Layout
- **Location**: `BookPage.astro`
- **Docs**: [book-layout.md](./book-layout.md)
- **Features**: Physical book appearance, effects

### Title Countdown
- **Location**: `BaseHead.astro`
- **Docs**: [title_countdown_feature.md](./title_countdown_feature.md)
- **Features**: Dynamic countdown in page title

## Components

### CodeBlock Component
- **Location**: `CodeBlock.astro`
- **Docs**: [code_block_component.md](./code_block_component.md)
- **Features**: Tufte-style code display, copy function

### Standard Components
- **Location**: `/src/components/`
- **Features**: Header, Footer, FormattedDate, etc.

## Technical Features

### RSS Feed
- **Location**: `rss.xml.js`
- **Docs**: [rss_and_sitemap.md](./rss_and_sitemap.md)
- **Features**: Automatic feed generation

### Sitemap
- **Location**: `astro.config.mjs`
- **Docs**: [rss_and_sitemap.md](./rss_and_sitemap.md)
- **Features**: SEO-friendly sitemap generation

### Syntax Highlighting
- **Location**: `astro.config.mjs`, `global.css`
- **Docs**: [code-block-styling.md](./code-block-styling.md)
- **Features**: Prism.js with custom theme

## Development Features

### Build System
- **Location**: `astro.config.mjs`, `tsconfig.json`
- **Docs**: [build_configuration.md](./build_configuration.md)
- **Features**: TypeScript, Vite config, optimizations

### Development Workflow
- **Location**: `package.json`, scripts
- **Docs**: [development_workflow.md](./development_workflow.md)
- **Features**: NVM integration, build scripts

### Deployment
- **Location**: `netlify.toml`
- **Docs**: [astro-netlify-deployment.md](./astro-netlify-deployment.md)
- **Features**: Netlify configuration

## Styling Features

### Typography System
- **Location**: `/public/fonts/`, `global.css`
- **Docs**: [font_system.md](./font_system.md)
- **Features**: ET Book fonts, Tufte CSS inspiration

### Global Styles
- **Location**: `global.css`
- **Features**: Color scheme, responsive design

### Character Encoding
- **Location**: Various components
- **Docs**: [character_encoding_fix.md](./character_encoding_fix.md)
- **Features**: UTF-8 support fixes

## Utilities

### Host Script
- **Location**: `host.sh`
- **Docs**: [development_workflow.md](./development_workflow.md)
- **Features**: Quick build and serve

### Run Dev Script
- **Location**: `run-dev.sh`
- **Docs**: [development_workflow.md](./development_workflow.md)
- **Features**: NVM-aware development server

## Configuration Files

- `astro.config.mjs` - Main Astro configuration
- `tsconfig.json` - TypeScript configuration
- `netlify.toml` - Deployment configuration
- `package.json` - Dependencies and scripts
- `.nvmrc` - Node version specification

## Future Features

Potential additions mentioned in documentation:
- Image optimization
- Search functionality
- Dark mode toggle
- Comments system
- Analytics integration

## Quick Reference

Most commonly needed features:
1. Create new post: Add `.md` file to `/src/content/blog/`
2. Add visual marker: Use `markType`, `markCount`, `markColor` in frontmatter
3. Password protect: Set `private: true` and `passwordHash`
4. Use book layout: Set `layout: ../layouts/BookPage.astro`
5. Deploy: Push to main branch (Netlify auto-deploys)
