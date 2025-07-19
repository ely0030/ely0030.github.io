# CodeBlock Component

This document describes the custom CodeBlock component for Tufte-style code display.

## Overview

The CodeBlock component provides an enhanced code display with:
- Tufte-inspired styling with left border
- Dark theme with syntax highlighting
- One-click copy functionality
- Optional captions
- Fullwidth display option

## Usage

### Basic Usage

```astro
---
import CodeBlock from '../components/CodeBlock.astro';
---

<CodeBlock 
  code={`console.log('Hello, world!');`}
  lang="javascript" 
/>
```

### With Caption

```astro
<CodeBlock 
  code={`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`}
  lang="javascript"
  caption="Recursive Fibonacci implementation" 
/>
```

### Fullwidth Display

```astro
<CodeBlock 
  code={longCodeSnippet}
  lang="python"
  caption="Data processing pipeline"
  full={true} 
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | string | required | The code to display |
| `lang` | string | `'text'` | Language for syntax highlighting |
| `caption` | string | `''` | Optional caption below the code |
| `full` | boolean | `false` | Enable fullwidth display |

## Features

### Copy Functionality

- Click anywhere on the code to copy
- Dedicated "Copy" button in top-right
- Visual feedback when copied
- Fallback for older browsers

### Syntax Highlighting

Uses Prism.js with a custom dark theme:
- Comments in muted blue italic
- Punctuation in lighter blue
- All other tokens in theme blue
- Optimized for readability on dark background

### Visual Design

- Dark background (#0b0d12)
- Blue left border matching link color
- No border radius for print-like appearance
- Subtle padding and margins
- Smaller font size (0.85em) for code

### Fullwidth Mode

When `full={true}`:
- Extends beyond normal text width
- Width: 166% of container
- Left margin: -33%
- Useful for wide code examples

## Styling Classes

- `.tufte-code` - Main container
- `.tufte-code.fullwidth` - Fullwidth variant
- `.copy-btn` - Copy button styling
- Custom `.token` classes for syntax highlighting

## Implementation Details

### Copy Logic

The component includes inline JavaScript for copy functionality:
1. Tries modern Clipboard API first
2. Falls back to `document.execCommand('copy')`
3. Provides visual feedback
4. Handles errors gracefully

### Accessibility

- Proper `tabindex` on code blocks
- Aria-label on copy button
- Semantic figure/figcaption structure
- Keyboard accessible

## Customization

To modify the component:
1. Edit `/src/components/CodeBlock.astro`
2. Adjust colors in the style section
3. Modify Prism token colors
4. Change animation timings

## Integration with Markdown

While this component is designed for direct use in Astro files, regular markdown code blocks use the default Astro/Prism styling defined in `global.css`.

## Browser Support

- Modern browsers: Full functionality
- Older browsers: Graceful degradation for copy feature
- All browsers: Syntax highlighting works