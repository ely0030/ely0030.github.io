# Font System

This document describes the typography and font system used in the blog.

## Primary Font: ET Book

The blog uses ET Book as its primary font family, providing a Tufte-inspired reading experience.

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

### Usage

ET Book is set as the primary font family in the global styles, providing:
- Excellent readability for long-form text
- Classic book-like appearance
- Proper line figures for numbers in text
- Old-style figures for display text

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

1. **Headings**: ET Book, various sizes
2. **Body Text**: ET Book Roman
3. **Code**: Source Code Pro, Consolas, Monaco (monospace stack)
4. **UI Elements**: System font stack

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

- WOFF format for broad compatibility
- `font-display: swap` for better loading experience
- Subset fonts if only using specific characters
- Consider variable fonts for multiple weights

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

## Future Enhancements

Consider:
- Variable fonts for better performance
- Font subsetting for faster loads
- System font stack for UI elements
- Dark mode font adjustments