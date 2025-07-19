# Astro CSS Scoping Trap

## The Problem
**Location**: Any Astro component using dynamic JS-generated HTML
**Symptom**: CSS styles don't apply to dynamically created elements
**Root Cause**: Astro adds data-astro attributes to scoped styles - JS-created elements lack these

## Failed Solutions
1. **Making entire `<style>` block global** - Breaks site-wide styling, changes specificity
2. **Adding classes dynamically** - Still won't match Astro's data attributes
3. **Inline styles on every element** - Maintenance nightmare

## Correct Solution
```astro
<style>
  /* Component UI styles - stay scoped */
  .my-component { }
</style>

<style is:global>
  /* ONLY dynamic content styles */
  .my-component .dynamic-element { }
</style>
```

## Critical Insight
- Scoped styles have HIGHER specificity than global styles
- Two style blocks = surgical precision
- Prefix global styles with component class for safety

## Example: Notepad Markdown
**Location**: `src/pages/notepad.astro:14,310-368`
- Scoped block: All UI (sidebar, buttons, layout)
- Global block: ONLY `.editor-content .md-*` for JS-generated markdown