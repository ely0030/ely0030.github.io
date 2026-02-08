# Private Posts & Password Protection

_Last updated: 8.2.26 6:59 PM_

## Enabling

Frontmatter:
```yaml
private: true
passwordHash: "<sha256 hex digest>"
```
Generate hash: `echo -n "yourPassword" | shasum -a 256`

## How it works

Two independent systems protect the same post. Both use the same localStorage key (`pw:/slug`) so unlocking via one authorizes the other.

### 1. Index page inline password (`src/pages/index.astro`)

The script uses **event delegation** — a single click listener on `document` checks `e.target.closest('.private-link')`. This was necessary because earlier approaches (attaching handlers to individual elements via `querySelectorAll`) silently failed. Astro hoists `<script>` tags and processes them as deferred ES modules; by the time they executed, the `DOMContentLoaded` event had already fired in dev mode, so handlers attached inside that callback never ran. Event delegation sidesteps the timing problem entirely.

The script uses a **static** `import { sha256 } from` the js-sha256 CDN. Dynamic `import()` was tried but Vite's dev-mode transform interfered. The static import matches the pattern used by PasswordGate.astro, which already worked.

**Click flow:**
- `e.preventDefault()` stops navigation
- Checks localStorage for prior authorization → if found, plays unlock animation and navigates (no form)
- Otherwise: stores `link.outerHTML`, replaces the link with an inline `<form>`, adds `.has-active-form` to the `<li>`
- On correct password: stores hash in localStorage, plays unlock, navigates
- On wrong password: `.error` class triggers shake animation, clears input
- Clicking outside the `<li>`: `restore()` re-injects the stored `outerHTML` back into the DOM

**Lock emoji** sits inline to the right of the link (`margin-left: 0.4em`), hidden by default (`opacity: 0`), shown on hover via `~` sibling combinator (not `+`, because the lock isn't necessarily the immediate next sibling). On unlock: 120ms pause, emoji swaps 🔒→🔓, tiny upward nudge via CSS `transform: translateY(-1px)`, then navigates at 350ms. The emoji swap is subtle on Windows (the two lock emojis look nearly identical) but the timing pause gives tactile feedback regardless.

**Styles use `<style is:global>`** because the password `<form>` and `<input>` are created by JavaScript. Astro scopes component styles with `data-astro-cid-*` attributes; JS-created elements don't get these attributes and won't match scoped selectors. (CLAUDE.md pitfall #7.)

### 2. Direct URL password gate (`src/components/PasswordGate.astro`)

For when someone navigates directly to `/slug/` without going through the index.

Shows a centered password form over a white background (`position: fixed`, `z-index: 9999`). On correct password: removes the overlay, unhides the `<div id="protected">` containing the article, scrolls to top. Styles live in `src/styles/global.css` under `.protected-content`.

### 3. Content collection filter (`src/pages/index.astro` + `src/pages/[...slug].astro`)

Both files filter posts with the same logic:
```js
const isHiddenPrivate = data.private === true && !data.passwordHash;
```
Posts with `private: true` but **no** `passwordHash` are excluded entirely (truly hidden). Posts with both `private: true` **and** `passwordHash` are included — they appear on the index and get static pages generated. This distinction matters: without it, password-protected posts either don't show on the index or return 404 on direct access.

### 4. Layout nesting order (`[...slug].astro`)

```
BlogPost > PasswordGate > Content
```

BlogPost **must** be the outer wrapper. PasswordGate wraps only the `<Content />` inside BlogPost's slot. Earlier, PasswordGate wrapped BlogPost — this broke character encoding because BlogPost contains the `<html>`, `<head>`, and `<meta charset="utf-8">` tags. Wrapping BlogPost inside a `<div>` buried the charset declaration inside the body; the browser couldn't find it and rendered UTF-8 multibyte characters (curly quotes, em dashes, ł) as mojibake.

## Files

| File | Role |
|------|------|
| `src/pages/index.astro` | Inline password UI, event delegation script, lock CSS (all in `<style is:global>`) |
| `src/pages/[...slug].astro` | Routing, collection filter, layout nesting order |
| `src/components/PasswordGate.astro` | Full-page password overlay for direct URL access |
| `src/styles/global.css` | `.protected-content` styles for PasswordGate's form |
| `src/content.config.ts` | Schema defines `private` (boolean) and `passwordHash` (string) fields |

## localStorage

Key format: `pw:/slug/` → value is the sha256 hash.
Shared between index page and PasswordGate. Entering the password on either one authorizes the other.

## Gotchas

- **js-sha256 is not an npm dependency.** It's loaded from CDN (`https://cdn.jsdelivr.net/npm/js-sha256@0.9.0/+esm`) at runtime. The `astro.config.mjs` has `ssr: { noExternal: ['js-sha256'] }` which is vestigial — it doesn't do anything since the package isn't installed. Don't remove it either, it's harmless.
- **Astro strips dots from slugs.** A file named `7.2.26f.md` generates the path `/words/7226f/`, not `/words/7.2.26f/`. The `post.id` used in href templates goes through the same sanitization, so links and pages match. But if you ever construct URLs manually, use `post.id` not the filename.
- **The `restore()` function re-injects raw HTML** (`link.outerHTML` stored before replacement). This means the restored link won't have an event listener — but it doesn't need one, because event delegation on `document` catches the click regardless.
- **Client-side only.** The hash is visible in the page source. This is casual privacy, not security.
