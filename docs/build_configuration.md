# Build Configuration

This document describes the build configuration and technical setup of the blog.

## Astro Configuration

The main configuration is in `astro.config.mjs`:

### Site Configuration

```javascript
site: 'https://ely0030.github.io',
base: '/',
output: 'static',
```

### Integrations

1. **MDX Support**
   ```javascript
   mdx({ syntaxHighlight: false })
   ```
   - Enables MDX file support
   - Syntax highlighting handled by rehype-prism-plus

2. **Sitemap**
   ```javascript
   sitemap()
   ```
   - Automatically generates sitemap files

### Markdown Processing

```javascript
markdown: {
  remarkPlugins: [remarkBreaks],
  syntaxHighlight: 'prism',
  rehypePlugins: [[rehypePrism, { ignoreMissing: true }]],
  smartypants: false,
}
```

Features:
- `remarkBreaks`: Converts line breaks to `<br>` tags
- `rehypePrism`: Enhanced syntax highlighting
- `smartypants: false`: Disables smart quote conversion

### Vite Configuration

```javascript
vite: {
  build: {
    assetsInlineLimit: 0  // Disable asset inlining
  },
  ssr: {
    noExternal: ['js-sha256']  // Bundle js-sha256 for SSR
  },
  css: {
    postcss: {
      plugins: []  // Ensure proper UTF-8 handling
    }
  }
}
```

## TypeScript Configuration

In `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "strictNullChecks": true
  }
}
```

Features:
- Extends Astro's strict configuration
- Enables strict null checking
- Includes all project files
- Excludes build output

## Dependencies

### Core Dependencies

- `astro`: Main framework
- `@astrojs/mdx`: MDX file support
- `@astrojs/rss`: RSS feed generation
- `@astrojs/sitemap`: Sitemap generation
- `remark-breaks`: Line break processing
- `tufte-css`: Base Tufte CSS (though custom styles are used)

### Dev Dependencies

- `rehype-prism-plus`: Enhanced syntax highlighting
- `unist-util-visit`: AST traversal utility

## Content Collections

Configured in `src/content.config.ts`:

```typescript
const blog = defineCollection({
  loader: glob({ 
    base: './src/content/blog', 
    pattern: '**/*.{md,mdx}' 
  }),
  schema: z.object({
    // ... schema fields
  })
});
```

## Asset Handling

### Fonts

- ET Book fonts in `/public/fonts/`
- Additional fonts available but not actively used
- Loaded via CSS `@import`

### Images

- Static images in `/public/`
- Blog images in subfolders
- No automatic optimization (could be added)

### Textures

- SVG textures for book layout effects
- Located in `/public/textures/`

## Build Output

- Output directory: `dist/`
- Static HTML generation
- All assets copied to output
- Ready for static hosting

## Performance Optimizations

1. **Asset Handling**
   - `assetsInlineLimit: 0` prevents small asset inlining
   - Ensures consistent asset URLs

2. **CSS Processing**
   - PostCSS configured for UTF-8 handling
   - Custom CSS organization with imports

3. **JavaScript**
   - Minimal client-side JavaScript
   - Only essential interactivity (copy buttons, password forms)

## Security Considerations

- `js-sha256` bundled for password hashing
- No server-side processing (static site)
- Client-side password validation only

## Future Improvements

Consider adding:
- Image optimization integration
- CSS purging for smaller builds
- Bundle analysis tools
- Progressive enhancement features