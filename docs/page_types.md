# Page Types

**Added:** July 2024

This feature allows different styling modes for blog content based on the type of content. Pages can be styled in different ways by setting a `pageType` in the frontmatter.

## Available Types

- **`blog`** (default): Optimized for text-heavy articles with tighter spacing and focused readability
- **`magazine`**: Optimized for image-rich content with more generous spacing and slightly larger typography
- **`stanza`**: Poem-style flow, wide centred column, stanza helpers for stream-of-consciousness writing
- **`literature`**: Ultra-minimal essay layout (14px, 1.3 line-height, 480px width) - see critical notes below
- **`literature2`**: Fixed variant (15px, 1.3 line-height, 660px width) with paragraph spacing
- **`literature3`**: Tighter variant (14px, 1.1 line-height, 480px width) for maximum density

## Usage

Add the `pageType` and optional `category` fields to your blog post frontmatter:

```md
---
title: "My Blog Post"
description: "Description of my post"
pubDate: "2024-07-10"
pageType: "magazine"  # Optional: 'blog' (default) or 'magazine'
category: "articles"  # Optional: articles, ideas, creative, technical, personal
---

Content goes here...
```

If `pageType` is omitted, it defaults to `blog`.
If `category` is omitted, post appears under "uncategorized" on the index page.

## Type Differences

### Blog Style
- Font weight: 400 (regular)
- `.prose` font size: 16px (base body font is 14px)
- Tighter paragraph spacing (margin-bottom: 1.2em)
- Consistent paragraph sizing (first paragraph matches others)
- Heading spacing: h2 (margin-top: 1.8em), h3 (margin-top: 1.5em)
- Designed for efficient reading of primarily text content

### Magazine Style
- Font weight: 500 (medium)
- `.prose` font size: 15px (base body font is 14px)
- More generous paragraph spacing (margin-bottom: 1.5em)
- First paragraph enlarged (font-size: 1.1em, margin-bottom: 1.8em)
- Heading spacing: h2 (margin-top: 2.5em), h3 (margin-top: 2em)
- Better suited for image-rich content with featured visuals

### Stanza Style
- Font weight: 400 normal body, serif body font
- Line-height: 1.6, font-size 1.05rem (≈18px)
- Stanza paragraphs (`.stanza`) get extra 1.8em top spacing, 0.2em bottom
- Asides (`aside.note`) italic, bordered left accent
- Pull-thoughts (`.pull`) float right on wide screens, accent colour
- Single centered column, hides sidebar/TOC

## Examples

- `blog` style (default): Most text-focused articles, essays, notes
- `magazine` style: Image showcase posts, photo collections, visual tutorials

## Implementation Details

The `pageType` is passed to the `BlogPost.astro` layout where it's applied as a CSS class on the `<body>` element. CSS selectors then apply different styling rules based on the body class.

The type-specific CSS rules are defined at the end of `src/styles/global.css`.

The schema for the blog collection in `src/content.config.ts` includes the `pageType` field as an optional enum:

```ts
pageType: z.enum(['blog', 'magazine', 'stanza', 'essay', 'literature', 'literature2', 'literature3']).optional(),
category: z.string().optional(),  // Category for organization on index page
```

## Adding New Page Types

To add additional page types:

1. Update the schema in `src/content.config.ts` to include the new type
2. Add CSS rules to `src/styles/global.css` for the new body class 

## Book Page Layout

For content that should look like printed pages or photocopied book pages, a dedicated `BookPage.astro` layout is available:

```md
---
layout: "../layouts/BookPage.astro"
title: "Chapter Title"
description: "Chapter description"
photocopy: true  # Optional: adds photocopied effect
perspective: true  # Optional: adds 3D perspective tilt
---

Your chapter content...
```

The book page layout includes:

- Paper texture background
- Justified text with indented paragraphs
- Drop caps on first letter of first heading
- Subtle page curl effect at bottom-right
- Optional "photocopy" effect with xerox noise
- Optional "perspective" effect for 3D page tilt

This layout is perfect for fiction, stories, or any content where a physical book aesthetic enhances the reading experience.

### Accessibility

The book page effects automatically disable when:
- `prefers-reduced-motion` is enabled (disables perspective)
- `prefers-contrast: more` is enabled (disables photocopy effect)

View a sample at [/book-sample](/book-sample)

## CRITICAL: Literature Type Implementation

**Added**: 2025-07-01 - Minimal essay layout mimicking literature.bio

### Non-obvious design decisions:
1. **Font choice**: System sans-serif NOT serif (counterintuitive for essays but matches minimal blog aesthetic)
2. **Ultra-tight spacing**: 14px/1.3 line-height (updated from 1.2) - still dense but readable
3. **Layout trap**: DO NOT center `.layout-wrapper` - breaks left-alignment. Set `max-width: none` on wrapper, constrain only `.prose`
4. **Color**: #000000 pure black for maximum contrast
5. **Line breaks**: Markdown collapses multiple newlines - must use `<br>` tags or converter
6. **Horizontal rules**: TRAP - `---` REQUIRES blank lines before/after or won't render as `<hr>`

### Hidden dependencies:
- `BlogPost.astro:268` conditionally includes `StyleEditor` component ONLY for literature type
- `BlogPost.astro:225-265` heading navigation JS for all literature types - tracks scroll, handles clicks
- CSS variables enable runtime adjustment without recompilation
- StyleEditor defaults MUST match CSS defaults or initial render flickers
- Auto-converter MUST quote title/description or numeric filenames fail frontmatter parsing

### File locations:
- **Styles**: `src/styles/global.css:1354-1569` (search "LITERATURE PAGE TYPE")
- **Literature2**: `src/styles/global.css:1571-1752` (search "LITERATURE2 PAGE TYPE")
- **Editor**: `src/components/StyleEditor.astro` (draggable adjustment panel)
- **Schema**: `src/content.config.ts:23` (pageType enum)
- **Converters**: `src/utils/convert-newlines.js`, `src/utils/auto-convert-literature.js`

### Common failures to avoid:
1. **Centered text**: Initial attempt used `margin: 0 auto` on wrapper - wrong, must be left-aligned
2. **Serif fonts**: Tried Charter/Georgia first - too traditional, use system sans
3. **Comfortable spacing**: Resist urge to increase line-height - density is the aesthetic
4. **Line breaks don't preserve**: Markdown fundamentally collapses newlines. Tried:
   - CSS `white-space: pre-wrap` - only works within elements
   - Empty paragraph CSS - markdown doesn't create them
   - Remark plugins - too late in pipeline
   - Solution: Use `<br>` tags or auto-converter

## Literature2 Type

**Added**: 2025-07-02 - Fixed variant of literature with slightly more relaxed settings

### Key differences from literature:
- **Font**: 15px (vs 14px)
- **Line height**: 1.3 (vs 1.2)
- **Max width**: 660px (vs 600px)
- **Paragraph spacing**: 0.9em between paragraphs (vs 0)
- **No StyleEditor**: Intentionally static settings

Same line break handling as literature - requires `<br>` tags or converter.

### CRITICAL CSS WARNING
**NEVER use `white-space: pre-line` with prose content!**  
- Creates unfixable vertical gaps between HTML elements
- The newline between `</p>` and `<ul>` becomes ~1em of visual space
- No CSS margin/padding can remove this space
- See: css-spacing-pitfalls.md for 2+ hour debugging story

## Literature3 Type

**Added**: 2025-07-03 - Maximum density variant

### Settings:
- **Font**: 14px
- **Line height**: 1.1 (CRITICAL: extremely tight)
- **Max width**: 480px
- **Padding**: 25px
- **Paragraph spacing**: 0.5em
- **No StyleEditor**: Fixed like literature2

## Interactive Heading Features (All Literature Types)

**Added**: 2025-07-03 - Dynamic heading indicators

### Visual design:
- Single `#` with size variation: h1=18px → h6=10px
- Color states: Grey default (#999) → blue hover (#6b8ec5) → grey active (#999)
- **2025-07-04 UPDATE**: Active headings no longer turn blue, only hover
- Vertical centering: `top: 50%; transform: translateY(-50%)`
- Position: 30px left of text

### Interaction traps:
1. **Can't click pseudo-elements**: Hash uses `::before` - JS captures heading clicks instead
2. **Scroll offset**: 20px top spacing prevents tight viewport alignment
3. **Active tracking**: 100px offset in JS ensures heading activates before reaching top

### File locations:
- **Styles**: `global.css:1449-1584` heading indicators
- **JS**: `BlogPost.astro:230-251` click handlers, :253-265 scroll tracking
- **Applies to**: literature, literature2, literature3 (check at line 225)

## Image Support in Literature Types

**Critical**: All literature types (literature, literature2, literature3) support standard image figure classes without modification.

### Implementation:
```html
<div class="figure figure-center">
  <img src="/shared/image.webp" alt="Description">
  <div class="figure-caption">Caption</div>
</div>
```

### Non-obvious insight:
No CSS overrides needed - figure classes (`.figure-*`) work identically across all pageTypes. Literature's constrained width naturally contains images within readable bounds. 