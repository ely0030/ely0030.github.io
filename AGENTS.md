# Repository Guidelines

## Project Structure & Module Organization
- src/: Astro components, pages, utils, and content config.
- src/content/blog/: Markdown/MDX posts (public content). Use kebab-case filenames.
- public/: Static assets served as-is.
- docs/: Project docs. Start with `docs/_INIT.md`, `docs/@_MAP.md`, `docs/@_INDEX.md`.
- .github/: CI/CD workflows (e.g., GitHub Pages deploy).
- check-metadata.js: Validates required blog frontmatter.

## Build, Test, and Development Commands
- npm run dev: Starts local dev via `run-dev.sh` (Astro + helpers).
- npm run build: Builds the site with Astro.
- npm run preview: Serves the production build locally.
- node check-metadata.js: Lists posts missing required frontmatter.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; ESM modules only (`type: module`).
- Content: Place posts in `src/content/blog/` with frontmatter:
  - title (string), description (string), pubDate (YYYY-MM-DD or ISO).
  - Optional: category, pageType, heroImage, private/passwordHash, mark* fields.
- Filenames: kebab-case for posts and assets; folders lowercase.

## Testing Guidelines
- No unit test suite; validate by:
  - Running `node check-metadata.js` (frontmatter correctness).
  - `npm run build` to catch schema/route/content errors.
  - `npm run preview` for manual smoke testing of pages.

## Commit & Pull Request Guidelines
- Commit style reflects Conventional Commits: feat, fix, docs, chore, wip; scoped when helpful (e.g., fix(build): …).
- PRs should include: clear description, linked issue (if any), screenshots for UI changes, and notes on content schema impacts.
- Keep changes focused; update docs when behavior or structure changes.

## Agent Quicklinks
- CLAUDE.md: Critical patterns, pitfalls, and guardrails.
- docs/_INIT.md: Identity/purpose context for LLMs.
- docs/@_MAP.md: Where features/modules live.
- docs/@_INDEX.md: A–Z component reference.
- Optional: docs/CROSS_REFERENCES.md for interconnected features.

