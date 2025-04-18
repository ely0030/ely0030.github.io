# Styling Code Blocks in Astro (Tufte/Dark Theme)

This document outlines the process and challenges encountered while attempting to implement custom Tufte-inspired, dark-mode code blocks in the Astro project.

## Goal

- Apply a consistent, aesthetically pleasing style to Markdown code fences (` ``` `).
- Achieve a "Tufte-like" minimalist aesthetic.
- Implement a dark background with white text and minimal syntax highlighting (primarily using the site's main link color).
- Ensure code is easily copyable, ideally with a button.

## Initial Approach (Following External Guide)

1.  **Install Dependencies:**
    - `tufte-css`: For base Tufte styles (though later disabled globally).
    - `rehype-prism-plus`: To process Markdown code fences using PrismJS.
2.  **Configure Astro:**
    - Updated `astro.config.mjs` to set `markdown.syntaxHighlight: 'prism'` and add `rehypePrism` to `rehypePlugins`.
3.  **Assets:**
    - Added ET Book fonts (`public/fonts/`).
    - Created a custom Prism theme (`src/styles/prism-tufte.css`) aiming for a "pale ink" (initially light, later dark) look.
    - Imported `et-book.css` and `prism-tufte.css` in `src/styles/global.css`.
4.  **Component:**
    - Created a `<CodeBlock.astro>` component (`src/components/CodeBlock.astro`) intended to wrap code blocks, styled with CSS resembling Tufte figures.

## Implemented Features

### Copy Button
The copy feature lives inside `src/components/CodeBlock.astro`:

```js
// Inside the component's script section
const copy = (el) => {
  navigator.clipboard.writeText(el.innerText).then(() => {
    const btn = el.closest('figure').querySelector('.copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1000);
  });
};
```

A `<button class="copy-btn">Copy</button>` is absolutely-positioned in the figure and shares site-blue styles.

### CodeBlock Component Structure

```astro
<figure class={`tufte-code${full ? ' fullwidth' : ''}`}>
  <button class="copy-btn" aria-label="Copy code">Copy</button>
  {caption && <figcaption>{caption}</figcaption>}
  <pre class={`language-${lang}`} tabindex="0" on:click={(e)=>copy(e.currentTarget)}>
    <code class={`language-${lang}`}>{code}</code>
  </pre>
</figure>
```

## Challenges & Debugging Steps

1.  **Initial Tufte CSS Conflict:** Importing `tufte.min.css` globally drastically altered the entire site's appearance. 
    - **Resolution:** Commented out the global `@import` for `tufte-css/tufte.min.css` in `global.css`.
2.  **Dependency Resolution Issues:** Encountered errors where Astro couldn't find installed packages (`rehype-prism-plus`, `tufte-css`).
    - **Resolution:** Removed `node_modules` and `package-lock.json`, then ran `npm install`. Adjusted `@import` path for `tufte-css` based on actual package structure.
3.  **Dark Mode Styles Not Applying:** Despite configuring Prism, creating a dark theme (`prism-tufte.css`), and styling the `<CodeBlock>` component, the code blocks rendered with a light background and dark text.
    - **Attempt 1:** Moved dark theme styles directly into `<CodeBlock.astro>`'s `<style>` tag, scoping them to `.tufte-code` and using `!important` to increase specificity.
    - **Attempt 2:** Added override rules directly targeting `pre.astro-code` (Astro's default class for Shiki-processed blocks) in `global.css`, again using `!important`.
4.  **Incorrect Coloring:** The latest attempt resulted in *all* text within the code block turning a grayish/blue color, indicating the `span` override worked, but the base white text color did not.

### Attempt to Scope Dark Theme Inside CodeBlock
We tried to implement highly-specific selectors within `CodeBlock.astro`'s styles:

```css
/* --- Begin Scoped Dark Theme --- */
figure.tufte-code pre,
figure.tufte-code code {
  background: transparent !important; /* Ensure dark bg from figure shows */
  color: #fff !important; /* White base text */
  /* ... other styles ... */
}

/* Scoped Token Styling */
figure.tufte-code .token.comment,
figure.tufte-code .token.prolog,
/* ... many more token selectors ... */ {
  color: var(--color-link);
}
```

These were still overridden, suggesting inline styles or higher specificity elsewhere.

### Fallback Override in global.css
As a last resort, we added the following to `src/styles/global.css`:

```css
/* --- Dark mode override for Astro default code blocks --- */
pre.astro-code{
  background:#0b0d12 !important;
  color:#fff !important;
  border-left:2px solid var(--color-link);
  padding:1.2rem 1.5rem;
  overflow-x:auto;
  font-size:0.85em;
  font-family:'Source Code Pro', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
}
pre.astro-code span{color:var(--color-link) !important;}
```

This approach attempts to override any Shiki-generated HTML but is heavy-handed and still only partially successful.

## Likely Root Cause

The persistent issues strongly suggest a conflict between multiple styling mechanisms:

- **Astro's Default (Shiki):** Astro defaults to the Shiki highlighter, which applies colors via *inline styles* directly on `<span>` elements within the code. These inline styles have very high specificity and are difficult to override with external CSS.
- **Prism Configuration:** Although we configured Astro to use Prism, it's possible Shiki is still processing the code blocks first, or that Prism's CSS isn't being applied correctly due to the Shiki inline styles.
- **CSS Specificity/Loading Order:** The browser might be prioritizing default styles or Shiki's inline styles over our custom rules in `global.css`, `prism-tufte.css`, or the `<CodeBlock>` component, regardless of `!important`.
- **Astro Configuration Nuance:** Setting `markdown.syntaxHighlight: 'prism'` *should* disable Shiki—but only for Markdown, not MDX. Astro docs warn that MDX still uses Shiki unless you also set `syntaxHighlight: false` in the MDX integration or install an alternative.

## Current Status (As of last check)

- Code blocks are *not* displaying in dark mode.
- Text within code blocks appears grayish/blue, not white text with blue highlights.
- The copy button functionality was added but hasn't been visually confirmed against the correct background.

## Next Steps

### Inspect Rendered Output
Use browser developer tools to precisely determine:
- The actual class names being applied to the `<pre>` element.
- Whether inline `style` attributes are present on the `<span>` elements inside.
- Which CSS rules are winning the specificity battle for `color` and `background-color`.

### Potential Fixes Not Yet Attempted
1. **Completely Disable Shiki:**
   ```js
   // In astro.config.mjs
   markdown: { syntaxHighlight: false },
   integrations: [
     mdx({ syntaxHighlight: false })
   ]
   ```
2. **Explore Alternative Approaches:**
   - Use `astro-mdx-code-blocks` or a custom `rehype` plugin to swap `<pre>` → `<CodeBlock>` automatically.
   - Render raw Prism markup (`dangerouslySetInnerHTML`) to avoid inline styles.
   - Consider applying new-generation Astro slot-based syntax highlighting that allows more control.

3. **If all else fails:**
   - Consider starting fresh with a different approach, such as the native `@astrojs/prism` integration.
   - Temporarily remove all overriding styles from `global.css` and work with one styling mechanism at a time.

### Lessons Learned
- Astro's default syntax highlighter (Shiki) aggressively applies inline styles that are difficult to override with external CSS.
- Trying to use multiple syntax highlighters (Shiki + Prism) simultaneously can lead to conflicts.
- Consider testing with a minimal example when implementing complex styling changes.
- Browser inspection is crucial for diagnosing CSS specificity conflicts.

## Additional Tips

- **Clear Build Cache**  
  Sometimes Astro's dev server caches CSS aggressively. Stop the server, delete the `.astro` cache folder (e.g. `.astro`, `node_modules/.cache`), then restart with `npm run dev`.

- **MDX vs Markdown**  
  MDX files may still use Shiki unless you pass `syntaxHighlight: false` to the MDX integration:
  ```js
  // In astro.config.mjs
  import mdx from '@astrojs/mdx';
  export default defineConfig({
    markdown: { syntaxHighlight: 'prism' },
    integrations: [mdx({ syntaxHighlight: false })]
  });
  ```

- **Use a Single Highlighter**  
  Disable all built-in highlighting and rely solely on Prism or manual HTML:
  ```js
  // In astro.config.mjs
  export default defineConfig({
    markdown: { syntaxHighlight: false }
  });
  ```

- **Try @astrojs/prism Integration**  
  The official `@astrojs/prism` integration can be an alternative to `rehype-prism-plus` with potentially fewer conflicts.

- **Isolate in a Minimal Example**  
  Create a barebones Astro page with just one code block to experiment without other project CSS interfering. 