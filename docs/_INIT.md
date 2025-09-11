Project Identity and LLM Briefing

Purpose
- Personal site/blog built with Astro. Deployed on Netlify (primary) and optionally GitHub Pages via Actions.

Principles
- Keep UX minimal and fast. Avoid jarring refreshes; prefer in-place updates.
- Favor readable, maintainable code over cleverness.
- Preserve author intent for prose (newlines, spacing, typography).

Key Context for LLMs
- Tech stack: Astro 5, Node 20, MDX, rehype-prism-plus, sitemap/rss integrations.
- Build: `npm run build` outputs to `dist/`. Netlify uses `netlify.toml`. GitHub Pages (if enabled) uses Actions in `.github/workflows/deploy-pages.yml`.
- Site URL in config currently points to `https://ely0030.github.io` for canonical/sitemap. Update if the primary domain changes.

Pitfalls to Avoid
- Do not reintroduce CSS `white-space: pre-line` for prose.
- Respect Astro style scoping. Use `is:global` intentionally.
- Newline preservation for literature pages relies on `remark-preserve-newlines` and related CSS tweaks.

Where to Look First
- CLAUDE.md: high-signal constraints and gotchas.
- docs/LLM_CONTEXT.md: deeper architecture and decisions.
- astro.config.mjs: integrations, markdown, and server behaviors.
- src/pages and src/layouts for page types and layouts.

Operational Notes
- Netlify: `publish = "dist"`, Node 20. Build command `npm run build`.
- GitHub Pages: Use the provided Actions workflow; do not rely on Jekyll.

