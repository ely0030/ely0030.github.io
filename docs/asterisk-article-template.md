# Asterisk-Style Article Template

Created: 2026-06-17

## Where It Lives

- Page: `src/pages/asterisk-article-copy.astro`
- Route: `/asterisk-article-copy/`
- Preview command: `npm run preview -- --host 127.0.0.1 --port 4322`
- Build check: `npm run build`

## What This Is

A standalone Astro page that recreates the useful layout behavior of the Asterisk Magazine article format without copying the article content or remote assets.

Reference used for layout study:
- `https://asteriskmag.com/issues/11/why-are-there-so-many-rationalist-cults`

The current page uses original placeholder editorial copy and local assets. The goal is a reusable long-form article template, not a content mirror.

## Main Features

- Cream editorial background with blue display typography.
- Large serif opener with headline and author line.
- Blue intro/deck block.
- Centered long-form text column.
- Local image figure block.
- Section headings that become scroll chapter markers.
- Fixed left scroll progress rail.
- Desktop side footnotes positioned near references.
- Mobile tap-to-open footnote popovers.
- Newsletter signup blocks with local no-op submit behavior.
- Author bio footer.
- Previous/next links.
- Tags and related-article rows.
- External article links get `target="_blank"` and safe `rel` attributes in the page script.

## Recent Polish Pass

The page was tuned against the screenshot in the follow-up session:

- Reduced visible chrome so the article carries the viewport.
- Switched headline/byline/intro/section display areas to a local high-contrast serif via `CopyArticleDisplay`.
- Tightened prose line height.
- Increased prose weight and size to better match the heavy black body texture.
- Adjusted blue to `#2f95d4`.
- Kept letter spacing at `0` to match project frontend rules.

## Important Implementation Notes

- Styling is isolated in `src/pages/asterisk-article-copy.astro` under `body.article-copy`.
- The page intentionally does not use the shared `BlogPost.astro` layout because this is an experimental one-page article system with its own header, progress rail, note rail, and footer.
- The template uses `/blog-placeholder-2.jpg` for the figure.
- The display font is loaded from `/fonts/DEMO-caslongrad.otf`.
- Browser screenshot testing was not run because Playwright and a local Chrome/Chromium binary were unavailable in the environment.

## Validation Done

- `npm run build`
- `node check-metadata.js`
- `curl -I http://127.0.0.1:4322/asterisk-article-copy/`

## Next Good Follow-Ups

- Convert hardcoded related links and author fields into data arrays at the top of the Astro file.
- Decide whether this should stay a standalone experiment or become a new reusable layout component.
- Add a real local image/illustration set if this becomes a production page type.
- Run a screenshot pass once Playwright or a local browser is available.
