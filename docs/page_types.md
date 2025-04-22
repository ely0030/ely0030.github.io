# Page Types

**Added:** July 2024

This feature allows different styling modes for blog content based on the type of content. Pages can be styled in different ways by setting a `pageType` in the frontmatter.

## Available Types

- **`blog`** (default): Optimized for text-heavy articles with tighter spacing and focused readability
- **`magazine`**: Optimized for image-rich content with more generous spacing and slightly larger typography

## Usage

Add the `pageType` field to your blog post frontmatter:

```md
---
title: "My Blog Post"
description: "Description of my post"
pubDate: "2024-07-10"
pageType: "magazine"  # Optional: 'blog' (default) or 'magazine'
---

Content goes here...
```

If `pageType` is omitted, it defaults to `blog`.

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

## Examples

- `blog` style (default): Most text-focused articles, essays, notes
- `magazine` style: Image showcase posts, photo collections, visual tutorials

## Implementation Details

The `pageType` is passed to the `BlogPost.astro` layout where it's applied as a CSS class on the `<body>` element. CSS selectors then apply different styling rules based on the body class.

The type-specific CSS rules are defined at the end of `src/styles/global.css`.

The schema for the blog collection in `src/content.config.ts` includes the `pageType` field as an optional enum:

```ts
pageType: z.enum(['blog', 'magazine']).optional(),
```

## Adding New Page Types

To add additional page types:

1. Update the schema in `src/content.config.ts` to include the new type
2. Add CSS rules to `src/styles/global.css` for the new body class 