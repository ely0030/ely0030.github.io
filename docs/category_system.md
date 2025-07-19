# Category System

Critical implementation details for the visual category system in `index.astro`.

## Core Components

### categoryMeta object (lines 40-50)
Maps category names to visual properties:
```javascript
articles: { icon: '📝', color: '#2563eb', description: 'Long-form articles and essays' }
```

### sections object (lines 54-59)
Groups categories under section headers:
```javascript
'Writing': ['articles', 'creative', 'ideas'],
'Miscellaneous': ['uncategorized', 'archive']
```

### Dynamic Category Fallback (lines 61-69)
**CRITICAL**: Unknown categories auto-populate to Miscellaneous section
```javascript
const unknownCategories = Object.keys(postsByCategory).filter(cat => !categoryMeta[cat]);
if (unknownCategories.length > 0) {
  sections['Miscellaneous'].push(...unknownCategories);
  unknownCategories.forEach(cat => {
    categoryMeta[cat] = { icon: '📁', color: '#6b7280', description: cat };
  });
}
```
- Any category not in categoryMeta gets default 📁 icon and gray color
- Automatically added to Miscellaneous section
- No manual config needed for new categories

## Key Implementation Details

### Visual Hierarchy
- Section headers use `.section-name` with 600 weight, 1.05em size, 0.7 opacity
- Categories indented 1.2em under sections via `.section-content`
- Files indented 1.5em via `.post-item` padding (lines 312-316)
- Alternating backgrounds REMOVED - was `:nth-child(odd)` with 4% color tint

### Post Count Implementation
- Wrapped in separate span outside button: `<span class="post-count">({postCount})</span>`
- `pointer-events: none` prevents clicking (lines 245-254)
- Archive category hardcoded to 1 post (line 111)

### Color System  
- CSS custom property `--category-color` propagates via inline style (lines 88,96)
- Folder headers have NO background (removed lines 197-207)
- Category colors defined in `categoryMeta` object (lines 40-49)

## Common Pitfalls

1. **Case sensitivity**: Frontmatter uses lowercase `category:`, not `Category:`
2. **Missing categories**: Only 1/17 posts categorized - most show as "uncategorized"
3. **Archive handling**: Special case in template - shows hardcoded content if category='archive'
4. **Icon behavior**: Category icons don't change on expand/collapse (removed folder icon toggle)
5. **Bullet points**: NOT from index.astro - defined in `global.css:1091-1097` via `.post-item::before`
6. **Edit persistence**: Multiple edits to same line may revert - use `replace_all` flag or verify with grep
7. **Visual jump on load**: TRAP - Two scripts set heights (inline:455 + DOMContentLoaded:700) causing flicker
   - FIX: `<body class="no-transitions">` + CSS `.no-transitions .post-list { transition: none !important; }`
   - Remove class after load via `requestAnimationFrame` (line 461-463)
8. **Filesystem folders ≠ Visual categories**: 
   - File at `saved/post.md` with `category: "ideas"` → Shows in ideas folder, URL is `/saved/post/`
   - Subfolders are ONLY for file organization and URL structure
   - Visual grouping controlled ONLY by frontmatter `category:` field

## Adding Categories to Posts

In frontmatter:
```yaml
---
category: "articles"  # lowercase, matches categoryMeta keys
---
```

## Modifying Structure

1. Edit `categoryMeta` to add/change category properties
2. Edit `sections` to reorganize section groupings
3. Visual changes primarily in CSS (lines 196-219 for sections, 178-189 for folders)