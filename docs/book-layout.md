# Book Page Layout

The Book Page layout provides an alternative presentation style that mimics the appearance of a physical book page, complete with paper texture, realistic shadows, and optional visual effects.

## Overview

The Book Page layout (`BookPage.astro`) creates a reading experience reminiscent of printed books, with:
- Paper texture background
- Realistic drop shadows and page curl effect
- Optional photocopy effect (grayscale, high contrast)
- Optional perspective tilt
- Automatic page numbering
- Drop caps for first letters

## Usage

### Basic Setup

Create a markdown file using the Book Page layout:

```markdown
---
layout: "../layouts/BookPage.astro"
title: "Your Page Title"
description: "A description of your content"
---

# Your Content Here

<section>
Your first section of content...
</section>

<section>
Your second section...
</section>
```

### Layout Options

The Book Page layout accepts these frontmatter options:

#### `photocopy` (boolean)
- **Default**: `false`
- **Effect**: Applies a photocopy aesthetic with:
  - Grayscale filter
  - Increased contrast
  - Slight darkening
  - Xerox-style noise texture overlay
  
```yaml
photocopy: true
```

#### `perspective` (boolean)
- **Default**: `false`
- **Effect**: Adds a 3D perspective tilt to the page, making it appear as if viewed at an angle

```yaml
perspective: true
```

### Combined Effects

You can use both effects together for a photocopied page viewed at an angle:

```yaml
photocopy: true
perspective: true
```

## Sections and Page Numbers

The layout uses `<section>` tags to organize content and enable automatic page numbering:

```markdown
<section>
First page content...
</section>

<section>
Second page content...
</section>
```

Each section:
- Increments the page counter
- Displays a page number at the bottom right
- Should contain roughly one page worth of content

## Visual Features

### Paper Texture
- Background uses `/textures/paper-fibers.svg`
- Cream-colored base (#fdfbf7)
- Subtle fiber pattern for realism

### Drop Shadow
- Multi-layer shadow effect
- Creates illusion of lifted page
- Inset shadow for depth

### Page Curl
- Bottom-right corner effect
- Simulates slightly curled page edge
- Adds to realistic appearance

### Drop Caps
- First letter of `<h1>` elements
- 3.8em size
- Floats to the left of text

### Typography
- Justified text alignment
- 1.55 line height for readability
- Small caps for `<h2>` headings
- Text indent for paragraphs

## Styling Details

### Colors
- Background: #d8d1c3 (body)
- Page: #fdfbf7 (cream)
- Text: #111 (near black)

### Dimensions
- Max width: 42rem
- Padding: 3.5rem 2.75rem
- Responsive font size increase at 60rem viewport

### Effects CSS

**Photocopy effect:**
```css
filter: grayscale(1) contrast(1.15) brightness(.92);
```

**Perspective effect:**
```css
transform: perspective(1300px) rotateX(3deg) rotateY(-4deg);
```

## Accessibility

The layout includes accessibility considerations:

### Reduced Motion
- Perspective transform disabled for users who prefer reduced motion
- Ensures comfortable reading experience

### High Contrast Mode
- Photocopy effects disabled
- Noise texture removed
- Maintains readability

## File Structure

The Book Page layout requires:
- `/src/layouts/BookPage.astro` - The layout component
- `/public/textures/paper-fibers.svg` - Paper texture
- `/public/textures/xerox-noise.svg` - Photocopy noise texture

## Example Implementation

See `/src/pages/book-sample.md` for a working example that demonstrates:
- Proper section usage
- Both visual effects enabled
- Narrative content formatting

## Best Practices

1. **Content Length**: Each `<section>` should contain roughly 300-500 words
2. **Images**: Center images with 90% max-width for margins
3. **Headings**: Use `<h1>` sparingly to maximize drop cap impact
4. **Sections**: Always wrap content in `<section>` tags for page numbering

## Use Cases

The Book Page layout is ideal for:
- Fiction or creative writing
- Historical documents
- Academic papers requiring a formal presentation
- Any content that benefits from a physical book aesthetic

## Limitations

- Fixed width layout (not full-width responsive)
- Page numbers are sequential per page load (not persistent)
- Textures require SVG support
- Transform effects may impact performance on older devices

## Future Enhancements

Potential improvements could include:
- Multiple paper texture options
- Customizable page colors
- Two-page spread layout
- Margin notes support
- Custom fonts for different book styles