# Literature Type - Critical Implementation Notes

**Created**: 2025-07-01
**Purpose**: Document non-obvious implementation details for ultra-minimal essay layout

## Key Insights from Implementation

### 1. Layout Architecture Trap
**Problem**: Initial centered layout using `margin: 0 auto` on `.layout-wrapper`
**Solution**: Set `max-width: none` on wrapper, apply width constraint ONLY to `.prose`
**Why**: Centering breaks the left-aligned minimal aesthetic - content must start from left margin

### 2. Font Selection Paradox
**Attempted**: Charter, Georgia (traditional essay serif fonts)
**Final**: System sans-serif stack
**Rationale**: Minimal blogs (Sam Altman, literature.bio) use sans-serif despite essay content

### 3. Density Over Comfort
**Specification**: 14px font, 1.3 line-height, 0.8em paragraph spacing
**Insight**: Still dense but more readable than original 1.2
**Evolution**: 1.2 → 1.3 line-height, 600px → 1200px → 480px width
**Update 2025-07-03**: Final settings 14px/1.3/480px for literature base

### 4. StyleEditor Integration
**Location**: `BlogPost.astro:222` - conditional render based on pageType
**Coupling**: Editor defaults in `StyleEditor.astro:280-287` MUST match CSS variables
**Why**: Mismatch causes flicker on initial render

### 5. Line Break Preservation Trap (2025-07-02, SOLVED 2025-01-16)
**Problem**: Multiple newlines collapse to single paragraph break
**Failed attempts**:
- CSS `white-space: pre-wrap` - only preserves whitespace WITHIN elements
- Empty paragraph CSS (`p:empty`) - markdown doesn't create empty paragraphs
- Remark plugin inserting HTML between paragraphs - wrong AST level
- Default `.prose p { margin-bottom: 1.2em }` requires `!important` overrides
**Solution**: 
1. Custom remark plugin adds `break` nodes to paragraph children: `src/utils/remark-preserve-newlines.js`
2. CSS rule removes margin after breaks: `p:has(br:last-child) + p { margin-top: 0 }`
**Critical**: Dev server restart required after astro.config.mjs changes

### 6. Horizontal Rule Rendering Trap (2025-07-03)
**Problem**: `---` not rendering as `<hr>` element
**Root cause**: Markdown requires BLANK LINES before/after `---` for hr recognition
**Failed fix**: CSS styling (lines 1755-1762) was correct but element wasn't generated
**Solution**: Add blank lines around `---` in markdown
```markdown
text

---

text
```
**NOT**: `text\n---\ntext` or `---\n00:55 AM`

### 7. Interactive Heading Navigation (2025-07-03)
**Implementation**: Hash indicators with scroll tracking
**Visual hierarchy**: Size-varied hashes (h1:18px → h6:10px)
**Color scheme**: Grey default (#999) → blue active (#6b8ec5)
**Interaction details**:
- Click any heading to smooth scroll (20px offset)
- Active section tracking with 100px scroll offset
- Can't click pseudo-elements - JS captures heading clicks
**Files**: CSS lines 1449-1584, JS in BlogPost.astro:225-265

## File Modifications

1. **CSS**: `src/styles/global.css:1354-1569`
   - Search: "LITERATURE PAGE TYPE"
   - CSS variables for runtime adjustment
   - TRAP: Default `.prose` styles need `!important` to override
   - Heading indicators: lines 1449-1584 (size-varied hashes)

2. **Schema**: `src/content.config.ts:23`
   - Added 'literature', 'literature2', 'literature3' to pageType enum

3. **Editor**: `src/components/StyleEditor.astro`
   - Draggable panel with sliders
   - Copy settings functionality
   - Font size range: 12-18px (default 14px)

4. **Layout**: `BlogPost.astro:167, 225-267`
   - Back button for all literature types
   - StyleEditor only for literature (not literature2/3)
   - Heading navigation JS for scroll tracking and click handling

5. **Converters** (2025-07-02):
   - `src/utils/convert-newlines.js` - Manual converter
   - `src/utils/auto-convert-literature.js` - Auto-converter with frontmatter generation
   - `run-dev.sh` - Runs converter before dev server
   - CRITICAL: Must quote title/description strings

## Common Failure Modes

1. **"Text too centered"**: Don't center wrapper, only constrain prose width
2. **"Needs more breathing room"**: Resist - density is intentional
3. **"Should use serif fonts"**: No - modern minimal uses sans-serif
4. **"Links hard to see"**: Blue (#0000EE) is intentional - classic web aesthetic

## Quick Reference

```yaml
pageType: literature
```

Default values (updated 2025-07-03):
- Font: 14px system sans-serif
- Line height: 1.3 (increased from 1.2)
- Max width: 480px (evolved: 600px → 1200px → 480px)
- Padding: 20px
- Paragraph spacing: 0.8em (now active)
- Text: #000000
- Links: #0066cc (blue)

Literature2 fixed values:
- Font: 15px
- Line height: 1.3
- Max width: 660px
- Paragraph spacing: 0.9em

Literature3 fixed values:
- Font: 14px
- Line height: 1.1 (maximum density)
- Max width: 480px
- Padding: 25px
- Paragraph spacing: 0.5em

StyleEditor CRITICAL:
- Max-width slider: 480-1200px range (line 26)
- Defaults MUST match CSS vars or flicker occurs (lines 281-287)