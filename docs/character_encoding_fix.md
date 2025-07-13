# Character Encoding Issue & Fix (April 2025)

## Problem Statement
Users noticed that certain punctuation marks (especially apostrophes, quotation marks, em‑dashes) were rendered as garbled sequences such as:

```
Whatâ€™s the purpose of an article?
```

The raw Markdown files were correct (`What's`), but the browser displayed mojibake characters (â€™, â€”, â€�, etc.). This indicated that UTF‑8 bytes were being interpreted as Latin‑1 / Windows‑1252.

## Investigation Timeline
| Step | Observation |
|------|-------------|
|1|Verified each layer (Markdown file, hex dump, built HTML, browser). Markdown & `dist/` HTML contained **UTF‑8 bytes for curly quotes** (0xE2 0x80 0x99 → ’).|
|2|Confirmed that `<meta charset="utf‑8">` was already present, so browser mis‑decoding wasn't the culprit.|
|3|Searched codebase for packages/plugins that auto‑convert punctuation. Discovered `remark-smartypants` is installed indirectly and **enabled by default in Astro**.|
|4|Curly quotes are fine in UTF‑8, but they become mojibake when copy‑pasted into contexts assuming Latin‑1 (e.g. macOS Preview thumbnails, some social previews). To keep posts ASCII‑clean we disabled the feature.|

## Fixes Applied
1. **Disabled smart‑quotes globally**
   ```diff
   // astro.config.mjs
   export default defineConfig({
     markdown: {
       remarkPlugins: [remarkBreaks],
       syntaxHighlight: 'prism',
       rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
   +   smartypants: false,   // 🚫 disable remark-smartypants
     },
   })
   ```
   ‑ This prevents automatic replacement of straight `' " -- ...` with typographic variants.

2. **Extra UTF‑8 guard in BaseHead** (optional but harmless)
   ```html
   <meta charset="utf-8">
   <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
   ```

3. **Repository‑wide encoding enforcement**
   Added `.gitattributes` so Git always stores text files as UTF‑8 and normalises line endings:
   ```gitattributes
   * text=auto eol=lf encoding=utf-8
   *.md  text eol=lf encoding=utf-8
   *.astro text eol=lf encoding=utf-8
   ```

4. **Node version locking**
   Local dev server failed with `Node.js v18.17.0 is not supported by Astro!`.
   Use the exact version specified in `.nvmrc`:
   ```bash
   nvm use 18.17.1
   ```
   or upgrade Node if you're outside `nvm`.

## Verification
- `npm run dev` → localhost preview shows straight quotes exactly as typed.
- `npm run build && npx serve dist` renders correctly.
- No `â€™` sequences appear in `dist/**/*.html` (checked via `grep`).
- Deployed site on GitHub Pages now shows correct characters after cache clear.

## Future Guidelines
* **Keep `smartypants: false`** unless you explicitly want curly punctuation.
* When adding new plugins, check if they re‑enable smart‑quotes.
* Prefer plain ASCII punctuation in source Markdown if you need maximum portability.
* Always inspect the built HTML (`dist/`) if you suspect encoding issues—if it looks good there, the problem is downstream (browser, cache, copy‑paste context).

---
_Last updated: 2025‑04‑21_ 