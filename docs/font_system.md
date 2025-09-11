# Font System

This document describes the typography and font system used in the blog.

## Primary Font: System Fonts with Apple Aesthetic

The blog uses a carefully crafted system font stack optimized for cross-platform consistency with an Apple-inspired aesthetic. This approach ensures excellent rendering on both Windows and Mac while maintaining a clean, minimal appearance.

### Font Files

Located in `/public/fonts/et-book/`:
- `et-book-roman-line-figures.woff` - Regular text
- `et-book-bold-line-figures.woff` - Bold text
- `et-book-display-italic-old-style-figures.woff` - Italic display

### Loading

Fonts are loaded via `/public/fonts/et-book.css`:
```css
@import "/fonts/et-book.css";
```

### Cross-Platform Font Strategy

The font system prioritizes native system fonts for optimal rendering:
- **Mac**: SF Pro Display/Text, -apple-system, BlinkMacSystemFont
- **Windows**: Segoe UI with Helvetica Neue fallback
- **Monospace**: SF Mono (Mac), Cascadia Code/Consolas (Windows)
- **Font Smoothing**: -webkit-font-smoothing: antialiased for Mac-like rendering
- **Letter Spacing**: -0.022em for tighter, more elegant typography

## Additional Available Fonts

Several other fonts are available in `/public/fonts/` but not actively used:

### EB Garamond
- Classic serif typeface
- CSS file: `/public/fonts/eb-garamond.css`
- Good alternative for body text

### Atkinson Hyperlegible
- `atkinson-regular.woff`
- `atkinson-bold.woff`
- Designed for maximum readability
- Good for accessibility

### Display Fonts
- `DamingaBold_PERSONAL_USE_ONLY.otf`
- `DamingaLight_PERSONAL_USE_ONLY.otf`
- `DamingaMedium_PERSONAL_USE_ONLY.otf`
- Note: Personal use only license

### Caslon
- `DEMO-caslongracomd.otf`
- `DEMO-caslongrad.otf`
- Demo versions only

## Font Features

### Small Caps
Used in book layout for h2 elements:
```css
font-feature-settings: "smcp";
```

### Line Height
- Body text: 1.7 (base)
- Book layout: 1.55
- Code blocks: 1.5

### Font Sizing
- Base: 18px
- Responsive scaling for larger screens
- Smaller sizes for code (0.85em)

## Typography Hierarchy

1. **Headings**: SF Pro Display/Text, Helvetica Neue (Apple aesthetic)
2. **Body Text**: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Helvetica Neue
3. **Code**: SF Mono, Menlo, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New (monospace)
4. **UI Elements**: Same as body text for consistency

## Custom Font Implementation

To add a new font:

1. Add font files to `/public/fonts/your-font/`
2. Create a CSS file with @font-face rules
3. Import in `global.css` or specific components
4. Update font stacks as needed

Example @font-face:
```css
@font-face {
  font-family: 'Your Font';
  src: url('/fonts/your-font/regular.woff2') format('woff2'),
       url('/fonts/your-font/regular.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

## Performance Considerations

- System fonts load instantly (no network requests)
- Web fonts (Inter) loaded via Google Fonts CDN when needed
- Native font rendering for best performance
- Consistent metrics across platforms with careful font stack ordering

## Accessibility

- Default system fonts as fallbacks
- Sufficient contrast ratios
- Readable font sizes (minimum 16px equivalent)
- Clear hierarchy for screen readers

## Font Licensing

- ET Book: Open source
- Atkinson Hyperlegible: Open source
- Other fonts: Check individual licenses
- Personal use fonts should not be used in production

## Recent Updates (2025-01-24)

- Replaced emoji folder icons with text symbols ([A], [i], [C], etc.) for consistent rendering
- Removed Apache font for better cross-platform consistency
- Applied Apple design aesthetic with SF fonts
- Added font smoothing properties for Mac-like rendering on all platforms
- Optimized monospace stack: Consolas first for Windows, Monaco/Menlo for Mac