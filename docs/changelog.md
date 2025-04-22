# Changelog

_Last updated: 2025‑04‑22_

## 2025‑04‑22: Code Block Improvements

### Fixed
- Resolved syntax highlighting inconsistency between MDX and Markdown files
- Fixed token coloring in code blocks by removing brute-force color override
- Ensured consistent styling between custom `<CodeBlock>` component and default Markdown code blocks

### Enhanced
- Improved code copy mechanism with better accessibility
  - Copy button now works when directly clicked (not just when clicking the code area)
  - Added fallback for browsers without Clipboard API support
  - Enhanced error handling for more reliable operation
- Added Prism token colors for standard `.astro-code` blocks to match CodeBlock styling
- Made copy button keyboard-accessible with proper click handler

### Technical Details
1. MDX files now use Prism via `mdx({ syntaxHighlight: false })` in astro.config.mjs
2. Removed blanket color override: `pre.astro-code span{color:var(--color-link) !important;}`
3. Added token-specific styling rules for proper syntax highlighting
4. Improved copy function with browser compatibility fallbacks
5. Made click handler work directly on the button element rather than requiring code area click

### Affected Files
- `astro.config.mjs`: Updated MDX integration settings
- `src/styles/global.css`: Improved code block token styling
- `src/components/CodeBlock.astro`: Enhanced copy functionality 