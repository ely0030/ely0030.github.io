# Files Map — Docs to Code (Astro Site)

Last scanned: 2025-09-08

Purpose: Quickly see which docs are worth reading, what they map to in the codebase, and any known mismatches. Use this as your starting index when navigating documentation.

## How To Use
- Read the High‑Signal list first for orientation and current fixes.
- Use the Code → Docs Matrix when changing a specific file.
- Treat items under Low‑Priority/Archive as optional background.

## High‑Signal (Read First)
- **../CLAUDE.md**: Quick AI assistant reference with pitfalls list (ROOT DIR - START HERE)
- DOCS.MAP.MD: Master index for the docs set.
- LLM_CONTEXT.md: Complete project documentation for AI assistants.
- features_index.md: Feature inventory with locations; line hints can drift.
- troubleshooting.md: Up‑to‑date common issues and resolutions.
- notepad-critical-knowledge.md: Must-read for notepad work (cursor jumps, state loss, etc.)

## Core Pages & Components
- src/pages/index.astro: Homepage with folder navigation, categories, visual markers
- src/pages/notepad.astro: Obsidian-style editor with blog management (3000+ lines)
- src/pages/planning-wall.astro: Kanban-style planning board
- src/pages/[...slug].astro: Dynamic blog post routing (handles subfolders)
- src/layouts/BlogPost.astro: Main blog layout with all pageTypes
- src/components/PasswordGate.astro: Password protection component
- src/components/BaseHead.astro: Meta tags, fonts, countdown feature

## Feature Docs (Active in Code)
- page_types.md: PageType variants; maps to `src/layouts/BlogPost.astro`, `content.config.ts`.
- literature-type-implementation.md: Line breaks, traps, plugins; `src/utils/remark-preserve-newlines.*`.
- private_password_feature.md: Client password UX; `src/components/PasswordGate.astro`, inline auth in `src/pages/index.astro`.
- folder-navigation.md: Category folders UX; `src/pages/index.astro`.
- category_system.md: Category metadata/icons; `src/pages/index.astro`.
- visual-markers.md: `markType/markCount/markColor`; rendering in `src/pages/index.astro`.
- code_block_component.md: `src/components/CodeBlock.astro`; Prism setup in `astro.config.mjs`.
- code-block-styling.md: Prism/CSS decisions; `astro.config.mjs`, `src/styles/*`.
- rss_and_sitemap.md: `src/pages/rss.xml.js`, `astro.config.mjs` integration.
- archive_system.md: Static archives; `public/you-should-exercise.html` + link in `src/pages/index.astro`.
- notepad-critical-knowledge.md: Core notepad behaviors; `src/pages/notepad.astro`.
- blog-frontend-editing.md: In‑browser post editing; `src/pages/notepad.astro`.
- live-markdown-rendering.md: Live rendering model; `src/pages/notepad.astro`.
- notepad-image-paste.md: Paste/resize/storage flows; `src/pages/notepad.astro`.
- title_countdown_feature.md: Head title countdown; `src/components/BaseHead.astro`.
- font_system.md: Fonts and preloads; `public/fonts/*`, `BaseHead.astro`.

## Security & Server Files (Root Directory)
- **blog-save-server-secure.js**: Authenticated blog save API
- **blog-save-server.js**: Basic blog save API without auth
- **https-proxy.cjs**: HTTPS proxy for development
- **https-proxy-protected.cjs**: Protected mode proxy with login
- **https-proxy-simple.cjs**: Simplified proxy variant

## Dev / Ops Docs
- **../SECURITY-SETUP.md** (root): Quick auth setup guide
- **../PROTECTED-MODE-SETUP.md** (root): Complete site protection setup
- development_workflow.md: Scripts and NVM flow; `package.json`, `run-dev*.sh`, `host.sh`.
- windows-pc-setup.md: Windows specifics with batch files and PowerShell scripts.
- https-setup.md: HTTPS local/protected dev setup for all platforms.
- network-hosting-setup.md: Local network hosting; `host-network*.sh|ps1`.
- protected-mode-critical.md: Protected mode implementation details.
- astro-netlify-deployment.md: `netlify.toml` and deploy notes.

## Utilities / Fixes Docs
- newline-preservation-complete.md: Matches `src/utils/remark-preserve-newlines.*`, `rehype-preserve-spacing.mjs`.
- newline-converter.md: `src/utils/convert-newlines.js` usage.
- remark-ast-manipulation.md: Background on remark AST decisions.
- character_encoding_fix.md: Encoding practices reflected across templates.

## CSS & Styling (Important for Debugging)
- **css-spacing-pitfalls.md**: Critical CSS traps (white-space: pre-line, etc.)
- **astro-css-scoping-trap.md**: Dynamic element styling issues
- src/styles/global.css: Main stylesheet (2000+ lines)

## Nice‑to‑Have Context
- book-layout.md: `src/layouts/BookPage.astro`.
- apache-notepad-style.md: Aesthetic for notepad; `src/pages/notepad.astro`.
- folder_navigation_flicker_fix.md: Folder UI behavior insights.
- build_configuration.md: General build notes; defer to `astro.config.mjs` for source of truth.

## Scripts & Batch Files
- run-dev.sh: Standard dev with auto-conversion
- run-dev-protected.sh: Protected mode development
- host.sh / host-network.sh: Network hosting scripts
- host-network-https.ps1: Windows PowerShell HTTPS setup
- start-https-server.bat: Windows batch for HTTPS
- start-https-server-PROTECTED.bat: Windows protected mode
- start-https-server-DEBUG.bat: Windows debug mode (separate windows)

## Low‑Priority / Archive
- minipc-https-setup-log-2025-07-19.md: Environment‑specific case study log.
- notepad-editor-evolution.md: ContentEditable history
- obsidian-style-editor-fix.md: Old single document approach
- nested-folders-implementation-plan.md: Old planning document
- blog-frontend-editing.md: Superseded by current notepad implementation
- solved-issues/*: Historic tickets; informational only.
- planning-wall.md: Now actively used but docs may be outdated.

## Known Mismatches To Fix
- LLM_CONTEXT.md: Says the title countdown "updates every second". Current `src/components/BaseHead.astro` calculates once on load without a timer. Update doc to reflect one‑time override behavior.
- planning-wall.md: Listed as low-priority but feature is actively used.
- Some docs reference `docs-refined/` subdirectory which may not exist.

## Code → Docs Matrix (Quick Cross‑Reference)
- src/pages/index.astro:
  - Docs: folder-navigation.md, category_system.md, visual-markers.md, private_password_feature.md, troubleshooting.md, archive_system.md
- src/components/PasswordGate.astro:
  - Docs: private_password_feature.md
- src/components/BaseHead.astro:
  - Docs: title_countdown_feature.md, font_system.md, rss_and_sitemap.md
- src/layouts/BlogPost.astro, src/pages/[...slug].astro:
  - Docs: page_types.md, literature-type-implementation.md, code_block_component.md, code-block-styling.md
- src/pages/notepad.astro:
  - Docs: notepad-critical-knowledge.md, notepad-drag-drop-categories.md, notepad-implementation-summary.md, notepad-image-paste.md, notepad-layout-fix.md, live-markdown-rendering.md
- src/utils/remark-preserve-newlines.* and src/utils/rehype-preserve-spacing.mjs:
  - Docs: newline-preservation-complete.md, remark-ast-manipulation.md, newline-converter.md
- astro.config.mjs:
  - Docs: code-block-styling.md, rss_and_sitemap.md, development_workflow.md
- run-dev*.sh, host-network*.sh|ps1, https-proxy*.cjs:
  - Docs: https-setup.md, network-hosting-setup.md, protected-mode-critical.md, windows-pc-setup.md, PROTECTED-MODE-SETUP.md, SECURITY-SETUP.md
- src/pages/planning-wall.astro:
  - Docs: planning-wall.md
- public/fonts/*:
  - Docs: font_system.md
- public/you-should-exercise.html:
  - Docs: archive_system.md

## Maintenance Notes
- Line ranges in docs are hints; prefer selectors/components when searching.
- If you add a new component or page, update the Code → Docs Matrix and place any new doc in the Feature or Dev/Ops section.

