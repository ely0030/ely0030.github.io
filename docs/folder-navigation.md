# Folder Navigation System

Apache-style collapsible folder navigation for blog posts.

## Critical Files
- `src/pages/index.astro:65-641` - Complete implementation (folders, dates, Apache header)
- `src/content.config.ts:27` - Category field schema
- `src/styles/global.css:394-398,1091-1097` - Bullet styling (CRITICAL: font-weight, size)

## Implementation Details

### Category Grouping
Posts grouped by `category` frontmatter field (defaults to "Uncategorized").
```yaml
category: Writing
```

### Folder State
Collapse state persisted in localStorage as `folder-{categoryId}`.

## CSS Pitfalls - CRITICAL

### Double Bullet Issue
**PROBLEM**: Both `list-style: disc` AND `::before` content created double bullets with massive spacing.

**LOCATIONS**:
- `global.css:395` - Must be `list-style: none`
- `global.css:1091` - Custom bullet via `::before`

**FIX**: Always use `list-style: none` when using custom `::before` bullets.

### Flexbox Spacing
**PROBLEM**: Flex + pseudo-elements = unexpected spacing.

**SOLUTION**: 
```css
.post-item {
  display: flex;
  align-items: baseline; /* Critical for bullet alignment */
}
```

### Padding Stack
Multiple padding sources compound:
- `.post-list` padding
- `.post-item` margins
- `::before` margins

**DEBUG**: Check all three locations when fixing spacing.

## Apache Index Features (Added 2025-01-04)

### Visual Improvements
**CRITICAL**: Multiple display properties interact badly. NEVER use both:
- `display: flex` on `.file-entry` AND `padding-left` - causes massive spacing
- `display: none/block` for folder toggle - breaks layout flow between folders

### Working Implementation
1. **Dates**: `src/pages/index.astro:92-96,105` - Right-aligned with 1em margin
2. **Apache Header**: Lines 66-69 - "Index of /" with HR
3. **Instant Toggle**: `transition: max-height 0.05s step-end` - NOT display toggle
4. **Visual Clarity**:
   - Alternating rows: `.post-item:nth-child(even)` - rgba(0,0,0,0.02)
   - Folder borders: `.folder-group` border-bottom #eee
   - Stronger bullets: 1.1em, bold, #333

### Failed Approaches
- `display: none/block` toggle - folders clash/overlap
- `transition: none` with max-height - animation required for proper flow
- `.file-entry { display: flex }` - created unwanted gap before date

## Folder Icons
- 📂 = Open (aria-expanded="true")
- 📁 = Closed (aria-expanded="false")