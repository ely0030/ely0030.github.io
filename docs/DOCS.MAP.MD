# Documentation Map for ely0030's Blog

⚠️ **IMPORTANT FOR AI ASSISTANTS**: Start with CLAUDE.md in root directory for quick context

## Quick Navigation

### Core Documentation (Most Useful)
[../CLAUDE.md](#claude-md)                               **START HERE** - Quick AI assistant reference
[LLM_CONTEXT.md](#llm-context)                           Complete project overview for AI/LLMs
[features_index.md](#features-index)                     Index of all features with locations
[changelog.md](#changelog)                               Project history and updates
[troubleshooting.md](#troubleshooting)                   Common issues and solutions

### Development & Setup
[development_workflow.md](#development-workflow)         Dev environment, scripts, commands
[build_configuration.md](#build-configuration)           Build system, TypeScript, dependencies
[windows-pc-setup.md](#windows-setup)                    Windows-specific setup guide with common fixes
[https-setup.md](#https-setup)                           HTTPS local network setup for all platforms
[network-hosting-setup.md](#network-hosting)             HTTP-only local network setup

### Security & Protected Mode
[../SECURITY-SETUP.md](#security-setup)                  Quick auth setup guide (ROOT DIR)
[../PROTECTED-MODE-SETUP.md](#protected-mode)            Complete site protection mode (ROOT DIR)
[protected-mode-critical.md](#protected-critical)        Protected mode implementation details

### Content Features
[page_types.md](#page-types)                             All page styles (blog, magazine, stanza, literature)
[literature-type-implementation.md](#literature-type)    Critical notes for literature pages
[book-layout.md](#book-layout)                           Book-style page with effects
[visual-markers.md](#visual-markers)                     iOS-style post indicators (!!, ??)
[private_password_feature.md](#password-protection)      Client-side password system
[folder-navigation.md](#folder-navigation)               Apache-style category folders
[category_system.md](#category-system)                   Visual category implementation

### Notepad Editor (Key Docs)
[notepad-critical-knowledge.md](#notepad-critical)       **MUST READ** - Critical gotchas and issues
[notepad-implementation-summary.md](#notepad-summary)    Feature overview and usage
[notepad-drag-drop-categories.md](#notepad-dragdrop)     Blog category drag-drop system
[notepad-image-paste.md](#notepad-images)                Image paste/storage system
[notepad-layout-fix.md](#notepad-layout)                 Grid debugging case study

### Planning Wall
[planning-wall.md](#planning-wall)                       Planning wall feature documentation

### Page Types & Content
[page_types.md](#page-types)                             All page styles (blog, magazine, stanza, literature)
[literature-type-implementation.md](#literature-type)     Critical notes for literature pages
[book-layout.md](#book-layout)                           Book-style page with effects
[visual-markers.md](#visual-markers)                     iOS-style post indicators (!!, ??)
[private_password_feature.md](#password-protection)       Client-side password system
[category_system.md](#category-system)                   Visual category implementation
[folder-navigation.md](#folder-navigation)               Apache-style category folders

### CSS & Styling Issues (Important)
[css-spacing-pitfalls.md](#css-pitfalls)                 **CRITICAL** - CSS traps to avoid
[astro-css-scoping-trap.md](#css-scoping)                Dynamic element styling fix
[font_system.md](#fonts)                                 Typography and ET Book fonts
[code-block-styling.md](#code-styling)                   Code styling implementation struggles

### Less Frequently Needed

#### Deployment & Network
[astro-netlify-deployment.md](#deployment)               Netlify deployment guide
[minipc-https-setup-log-2025-07-19.md](#minipc-log)      Case study of a difficult Windows HTTPS setup

#### Technical Details
[rss_and_sitemap.md](#rss-sitemap)                       RSS feed and sitemap generation
[code_block_component.md](#code-blocks)                  CodeBlock component details
[title_countdown_feature.md](#countdown)                 Dynamic countdown in page title
[live-markdown-rendering.md](#live-markdown)             Live markdown in notepad editor

#### Archives & Fixes
[newline-converter.md](#newline-converter)               Auto-converter for literature pages
[newline-preservation-complete.md](#newline-preservation) Complete newline preservation solution
[remark-ast-manipulation.md](#remark-ast)                Remark plugin AST lessons learned
[character_encoding_fix.md](#encoding-fix)               UTF-8 encoding solutions
[archive_system.md](#archives)                           Static HTML preservation
[folder_navigation_flicker_fix.md](#flicker-fix)         Folder jump fix on page load
[nested-folders-implementation-plan.md](#nested-folders)  Old planning doc for nested folders

#### Notepad History
[notepad-editor-evolution.md](#notepad-evolution)        ContentEditable history
[obsidian-style-editor-fix.md](#obsidian-editor)         Single document approach
[apache-notepad-style.md](#apache-notepad)               Apache aesthetic styling
[blog-frontend-editing.md](#blog-frontend)               Old blog editing approach

---

## Detailed Contents

### <a id="claude-md"></a>../CLAUDE.md
**Purpose**: Quick reference for AI assistants - READ THIS FIRST  
**Contains**: Project overview, critical files list, dev commands, known pitfalls  
**When to use**: Always start here before diving into other docs

### <a id="llm-context"></a>LLM_CONTEXT.md
**Purpose**: One-stop reference for AI assistants  
**Contains**: Architecture, features, workflow, all critical implementation details  
**When to use**: First document to read for complete project understanding

### <a id="features-index"></a>features_index.md
**Purpose**: Complete feature inventory  
**Contains**: All features (documented/undocumented), file locations, quick reference  
**When to use**: Finding where a feature is implemented

### <a id="changelog"></a>changelog.md
**Purpose**: Development history  
**Contains**: Date-stamped changes, bug fixes, feature additions  
**When to use**: Understanding what changed and when

### <a id="development-workflow"></a>development_workflow.md
**Purpose**: Development setup guide  
**Contains**: Scripts (`npm run dev`, `host-network.sh`, `host-network-https.ps1`), auto-conversion, Node setup
**When to use**: Setting up local development

### <a id="build-configuration"></a>build_configuration.md
**Purpose**: Technical build details  
**Contains**: Astro config, Vite settings, dependencies, TypeScript  
**When to use**: Modifying build process or debugging build issues

### <a id="deployment"></a>astro-netlify-deployment.md
**Purpose**: Deployment instructions  
**Contains**: Netlify setup, Git workflow, troubleshooting deployment  
**When to use**: Deploying site or fixing deployment issues

### <a id="troubleshooting"></a>troubleshooting.md
**Purpose**: Common problem solutions  
**Contains**: Port conflicts, build failures, markdown issues, notepad save debugging  
**Updated**: 2025-07-24 - Added notepad save debugging steps (Astro caching)
**When to use**: Something's broken

### <a id="network-hosting"></a>network-hosting-setup.md
**Purpose**: HTTP-only local network hosting
**Contains**: Details for `host-network.sh` (Linux/macOS), firewall rules, basic setup
**When to use**: For simple, non-encrypted local hosting on non-Windows systems.

### <a id="https-setup"></a>https-setup.md
**Purpose**: HTTPS local network hosting
**Contains**: Certificate generation and server scripts for Linux, macOS, and **Windows**.
**When to use**: For secure, encrypted local hosting

### <a id="minipc-log"></a>minipc-https-setup-log-2025-07-19.md
**Purpose**: Detailed log of a Windows HTTPS setup session
**Contains**: A real-world example of troubleshooting PowerShell, PSReadLine, and OpenSSL issues.
**When to use**: When the main `https-setup.md` guide isn't working on Windows.

### <a id="windows-setup"></a>windows-pc-setup.md
**Purpose**: Comprehensive Windows setup guide  
**Contains**: Step-by-step setup, HTTPS proxy fixes, authentication setup, console logging  
**Updated**: 2025-07-24 - Added console logging configuration for save debugging
**Critical**: Covers common Windows-specific issues and solutions  
**When to use**: Setting up the blog on a Windows PC

### <a id="protected-mode"></a>PROTECTED-MODE-SETUP.md
**Purpose**: Complete site password protection  
**Contains**: Setup for requiring auth to VIEW any page (not just edit)  
**Critical**: Proxy MUST load .env file or token mismatch occurs  
**Files**: https-proxy-protected.cjs, start-https-server-PROTECTED.bat, run-dev-protected.sh  
**When to use**: Preventing IoT devices from even viewing blog content

### <a id="security-setup"></a>SECURITY-SETUP.md
**Purpose**: Quick authentication setup guide  
**Contains**: Step-by-step auth implementation, .env setup, script modifications  
**Critical**: Protects against IoT devices on network editing your blog  
**When to use**: Initial security setup or troubleshooting auth issues

### <a id="secure-server"></a>blog-save-server-secure.js
**Purpose**: Authenticated blog save API server  
**Contains**: Password auth, rate limiting, path traversal protection  
**Key lines**: 21-27 (password), 30-47 (rate limit), 94-101 (path validation)  
**When to use**: Replace `blog-save-server.js` for secure editing

### <a id="auth-patch"></a>notepad-auth-patch.js
**Purpose**: Client-side authentication for notepad  
**Contains**: Login modal, token management, auth headers  
**When to use**: Adding auth to notepad.astro

### <a id="security-blueprints"></a>_OPS/BLUEPRINTS/security-enhancement/
**Purpose**: Comprehensive security enhancement plans  
**Contains**: 6 blueprints for future security implementation  
**Topics**: Auth, access control, encryption, validation, network hardening, private mode  
**When to use**: Planning enhanced security beyond basic auth

### <a id="page-types"></a>page_types.md
**Purpose**: Visual style documentation  
**Contains**: All pageTypes (blog, magazine, stanza, literature, book)  
**Critical**: Literature type has many non-obvious pitfalls  
**When to use**: Choosing or implementing page styles

### <a id="literature-type"></a>literature-type-implementation.md
**Purpose**: Literature type deep dive  
**Contains**: Critical implementation traps, line break handling, CSS pitfalls  
**Updated**: 2025-01-16 - Line break preservation solved with remark plugin
**When to use**: Working with literature pages specifically

### <a id="book-layout"></a>book-layout.md
**Purpose**: Book page effect guide  
**Contains**: Paper texture, photocopy effect, perspective tilt  
**When to use**: Creating book-style pages

### <a id="visual-markers"></a>visual-markers.md
**Purpose**: Post importance indicators  
**Contains**: iOS-style markers (!!, ??), colors, configuration  
**When to use**: Adding visual emphasis to posts

### <a id="password-protection"></a>private_password_feature.md
**Purpose**: Password system documentation  
**Contains**: SHA-256 hashing, inline UI, animations, localStorage  
**When to use**: Password-protecting posts

### <a id="folder-navigation"></a>folder-navigation.md
**Purpose**: Category folder system  
**Contains**: Apache-style folders, CSS pitfalls, double bullet fix  
**When to use**: Understanding homepage organization

### <a id="rss-sitemap"></a>rss_and_sitemap.md
**Purpose**: Feed generation guide  
**Contains**: RSS feed setup, sitemap config, SEO benefits  
**When to use**: Modifying feeds or checking SEO

### <a id="code-blocks"></a>code_block_component.md
**Purpose**: CodeBlock component API  
**Contains**: Props, usage, copy functionality, styling  
**When to use**: Using the CodeBlock component

### <a id="code-styling"></a>code-block-styling.md
**Purpose**: Code styling journey  
**Contains**: Shiki vs Prism conflicts, dark theme attempts  
**When to use**: Understanding why code blocks look the way they do

### <a id="fonts"></a>font_system.md
**Purpose**: Typography documentation  
**Contains**: ET Book setup, available fonts, licensing  
**When to use**: Working with fonts

### <a id="countdown"></a>title_countdown_feature.md
**Purpose**: Dynamic title documentation  
**Contains**: Countdown script, customization, testing  
**When to use**: Modifying the countdown

### <a id="newline-converter"></a>newline-converter.md
**Purpose**: Literature page converter  
**Contains**: Auto-conversion from drafts/, line break handling  
**When to use**: Writing literature pages

### <a id="encoding-fix"></a>character_encoding_fix.md
**Purpose**: UTF-8 fix documentation  
**Contains**: Smart quotes issue, mojibake fix, smartypants disable  
**When to use**: Character encoding issues

### <a id="archives"></a>archive_system.md
**Purpose**: Static archive guide  
**Contains**: Preserving old HTML, manual linking  
**When to use**: Archiving legacy content

### <a id="category-system"></a>category_system.md
**Purpose**: Visual category system documentation  
**Contains**: Category metadata structure, section groupings, CSS implementation details  
**When to use**: Working with post categorization or modifying homepage folder structure

### <a id="live-markdown"></a>live-markdown-rendering.md
**Purpose**: Live markdown rendering in notepad  
**Contains**: Real-time markdown with visible syntax markers, cursor preservation  
**When to use**: Working on notepad markdown features

### <a id="flicker-fix"></a>folder_navigation_flicker_fix.md
**Purpose**: Folder jump fix on page load  
**Contains**: CSS-based solution using no-transitions class  
**When to use**: Debugging folder navigation visual issues

### <a id="css-pitfalls"></a>css-spacing-pitfalls.md
**Purpose**: Critical CSS traps documentation  
**Contains**: Seven major CSS pitfalls including paragraph margins after breaks  
**Updated**: 2025-01-16 - Added button focus and paragraph margin fixes
**When to use**: When spacing seems broken despite trying everything

### <a id="css-scoping"></a>astro-css-scoping-trap.md
**Purpose**: Dynamic element styling solution  
**Contains**: Two-style-block pattern for JavaScript-generated elements  
**When to use**: When CSS styles aren't working on dynamic content

### <a id="newline-preservation"></a>newline-preservation-complete.md
**Purpose**: Complete solution for exact newline preservation  
**Contains**: Remark plugin implementation, CSS margin fix, failed approaches  
**Critical**: Must add break nodes to paragraph children, not between paragraphs  
**When to use**: Understanding or debugging newline rendering issues

### <a id="remark-ast"></a>remark-ast-manipulation.md  
**Purpose**: Remark AST manipulation patterns and pitfalls  
**Contains**: Node insertion techniques, AST structure insights, debug patterns  
**When to use**: Writing or debugging remark plugins

### <a id="notepad-critical"></a>notepad-critical-knowledge.md
**Purpose**: Comprehensive notepad gotchas  
**Contains**: Image handling, CSS scoping, cursor jumps, layout conflicts, edit mode, HTML escaping trap  
**Critical**: Read FIRST before any notepad work
**Updated**: 2025-07-24 - Added Astro content collection caching issue (saves work but content appears old)

### <a id="notepad-dragdrop"></a>notepad-drag-drop-categories.md
**Purpose**: Blog category drag-drop implementation
**Contains**: Section organization, empty category fix, expand state defaults
**Critical**: Drag-drop is VISUAL ONLY - doesn't re-categorize posts
**When to use**: Working with notepad category organization

### <a id="notepad-summary"></a>notepad-implementation-summary.md
**Purpose**: High-level notepad overview  
**Contains**: Core features list, user instructions, technical footprint  
**When to use**: Quick understanding of notepad capabilities

### <a id="notepad-images"></a>notepad-image-paste.md
**Purpose**: Image paste/storage system  
**Contains**: IndexedDB architecture, paste handler, markdown format  
**When to use**: Working with image features

### <a id="notepad-evolution"></a>notepad-editor-evolution.md
**Purpose**: ContentEditable implementation history  
**Contains**: Failed approaches, blur-only formatting solution  
**When to use**: Before changing contentEditable behavior

### <a id="notepad-layout"></a>notepad-layout-fix.md
**Purpose**: Grid debugging case study  
**Contains**: Grid width mismatch issue, misdiagnosis lessons  
**When to use**: When debugging CSS grid layouts

### <a id="obsidian-editor"></a>obsidian-style-editor-fix.md
**Purpose**: Single document editing approach  
**Contains**: Transition from block-based to unified editing  
**When to use**: Understanding notepad architecture

### <a id="apache-notepad"></a>apache-notepad-style.md
**Purpose**: Apache aesthetic for notepad  
**Contains**: Monospace fonts, [action] buttons, minimalist styling  
**When to use**: Maintaining notepad visual consistency

### <a id="solved-issues"></a>solved-issues/
**Purpose**: Bug tracking and resolutions  
**Contains**: Documented issues with investigation process and solutions  
**When to use**: Researching similar problems or adding new bug reports

---

## 📝 Session Logs & Tickets

### Session Documentation
[_temp/windows-setup-session-2025-01-20.md](#session-2025-01-20)     Complete Windows setup session with all fixes

### Open Tickets
[_OPS/TICKETS/_open/https-proxy-header-error.md](#proxy-header-ticket)     HTTPS proxy undefined header error

---

## Redundancies Fixed

### Completed Cleanup:
1. **development-workflow.md** deleted — kept `development_workflow.md` (more detailed)
2. **rss-sitemap.md** deleted — kept `rss_and_sitemap.md` (more complete)
3. **book_page_layout.md** deleted — kept `book-layout.md` (more comprehensive)
4. **visual_post_markers.md** deleted — kept `visual-markers.md` (more complete)
5. **page-types.md** deleted — kept `page_types.md` (has critical literature details)

### Consider Future Merges:
- **code_block_component.md** + **code-block-styling.md** — could merge into single "Code Blocks" doc
- **page_types.md** + **literature-type-implementation.md** — literature details could be section in page_types

---

## Most Important Docs

For new developers, read in order:
1. `LLM_CONTEXT.md` - Overview
2. `development_workflow.md` - Get started
3. `troubleshooting.md` - When stuck
4. `features_index.md` - Find anything

For specific tasks:
- **Writing posts**: `page_types.md`, `newline-converter.md`
- **Styling**: `font_system.md`, `code_block_component.md`, `css-spacing-pitfalls.md`
- **Features**: `private_password_feature.md`, `visual-markers.md`
- **Notepad work**: `notepad-critical-knowledge.md` (MUST READ FIRST)
- **Deploy**: `astro-netlify-deployment.md`
- **Debugging CSS**: `css-spacing-pitfalls.md`, `astro-css-scoping-trap.md`
