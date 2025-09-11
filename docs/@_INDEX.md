Module: Homepage literature2 style + Notepad nav + Uniform nav across page types

- Homepage: `src/pages/index.astro` → body uses `literature2 no-transitions`.
- CSS: `src/styles/global.css` → `body.literature2 .layout-wrapper` (container/offset); literature2 keeps `.sidebar` visible.
- CSS: `src/styles/global.css` → Show sidebar on `literature`, `literature3`, `stanza`; use grid on stanza; align left offset on `blog`, `magazine`, `literature*`.
- Notepad: `src/pages/notepad.astro` → `<Header />` inside `div.note-sidebar`; standard sidebar removed (hidden by `body.notepad .sidebar`).
