Nav/Header Alignment Module — Homepage + Notepad

What changed (non-obvious only)
- Homepage now opts into literature2 styling to match the “Dreams of Beautiful Sketches” look.
- Notepad renders nav inside its own left column because the global notepad layout hides the standard sidebar.
 - All article page types (blog, magazine, stanza, literature, literature3) now place nav in the same left column position as index/literature2. Previously, stanza/literature/literature3 hid the sidebar or altered the container.

Files (how they work together)
- src/pages/index.astro
  - Body classes: `literature2 no-transitions` (adopts literature2 container/spacing without hiding sidebar).
- src/styles/global.css
  - `body.literature2 .layout-wrapper` controls container width/left padding for the homepage and literature2 posts.
  - Important: literature2 does NOT hide `.sidebar`. Nav stays visible.
  - `body.notepad .sidebar { display: none; }` explains why header must move for notepad.
  - Unified nav position:
    - Show sidebar on: `literature`, `literature3`, `stanza` (removed `.sidebar` from hide rules).
    - Use grid on stanza: `body.stanza .layout-wrapper` set to standard 3‑col grid so nav sits left of content.
    - Align left offset on: `blog`, `magazine`, `literature`, `literature2`, `literature3` via consistent `padding-left: 20px`.
- src/pages/notepad.astro
  - `<Header />` moved into `div.note-sidebar` (top) so nav renders in the visible notepad column.
  - Removed unused `<aside class="sidebar">…</aside>` block.

Why it’s important
- Guarantees nav placement consistency between homepage and literature2 posts without changing literature2 post styling.
- Keeps notepad’s full-width editor while preserving quick nav access.

Gotchas
- Any future changes to `body.literature2 .layout-wrapper` padding/offset will shift homepage nav; keep this in sync with desired index alignment.
- Do not switch homepage to `literature` or `literature3` classes; those hide the sidebar and would remove nav.
