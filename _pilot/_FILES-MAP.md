Essential Code Folders:

  1. src/ - All the actual application code

  - src/pages/ - Main pages (index.astro, notepad.astro, planning-wall.astro, [...slug].astro)
  - src/layouts/ - Layout components (BlogPost.astro, BookPage.astro)
  - src/components/ - Reusable components (PasswordGate.astro, BaseHead.astro, CodeBlock.astro)
  - src/styles/ - CSS files (global.css is 2000+ lines)
  - src/content/blog/ - Blog post content files
  - src/utils/ - Utility functions (remark plugins, converters)

  2. Root config files - Critical for understanding the setup

  - astro.config.mjs
  - package.json
  - tsconfig.json
  - CLAUDE.md - Quick reference with all the pitfalls

  3. Server/Security files (if working on backend)

  - blog-save-server-secure.js
  - https-proxy.cjs, https-proxy-protected.cjs

  Skip These Folders:

  - _pilot/ - Just notes and prompts
  - _OPS/ - Tickets and planning docs
  - _temp/ - Temporary files
  - docs/ - Documentation (reference as needed, but not code)
  - public/ - Static assets (images, fonts)
  - node_modules/ - Dependencies
  - dist/ - Build output
  - .astro/ - Astro cache

  Most efficient approach: Copy the entire src/ folder + root config files + CLAUDE.md. That's where 99% of the code changes happen.