# Visual Post Markers

Visual post markers are iOS Reminders-style indicators that can be displayed next to blog post titles on the homepage. These help visually distinguish different types of content or highlight important posts.

## Overview

Each blog post can display a marker consisting of:
- **Symbol**: Either exclamation marks (!) or question marks (?)
- **Count**: 1 to 3 symbols
- **Color**: Grey, orange, or blue

These markers appear to the left of post titles on the homepage listing.

## Configuration

Add these fields to your blog post's frontmatter:

```yaml
---
title: 'Your Post Title'
description: 'Post description'
pubDate: '2025-07-01'
markType: 'exclamation'  # or 'question'
markCount: 2             # 1, 2, or 3
markColor: 'orange'      # 'grey', 'orange', or 'blue'
---
```

### Field Details

#### `markType`
- **Values**: `'exclamation'` or `'question'`
- **Required**: Yes (if using markers)
- **Purpose**: Determines which symbol to display
  - `exclamation`: Shows `!` symbol(s) - use for important/urgent content
  - `question`: Shows `?` symbol(s) - use for exploratory/uncertain content

#### `markCount`
- **Values**: `1`, `2`, or `3`
- **Required**: Yes (if using markers)
- **Default**: `0` (no marker shown)
- **Purpose**: How many symbols to display
  - `1`: Single symbol (!)
  - `2`: Double symbols (!!)
  - `3`: Triple symbols (!!!)

#### `markColor`
- **Values**: `'grey'`, `'orange'`, or `'blue'`
- **Required**: Yes (if using markers)
- **Purpose**: Visual styling of the marker
  - `grey`: Subtle, for general categorization
  - `orange`: Medium emphasis, for notable content
  - `blue`: High emphasis, for special content

## Examples

### Important Announcement
```yaml
markType: 'exclamation'
markCount: 3
markColor: 'orange'
```
Result: `!!!` in orange

### Question/Exploration Post
```yaml
markType: 'question'
markCount: 1
markColor: 'blue'
```
Result: `?` in blue

### Mild Warning
```yaml
markType: 'exclamation'
markCount: 1
markColor: 'grey'
```
Result: `!` in grey

## Implementation Details

The markers are rendered in `src/pages/index.astro`:

1. **Data Extraction**: The frontmatter fields are read from each post
2. **Symbol Generation**: Based on `markType` and `markCount`, the appropriate string is created
3. **CSS Styling**: The `markColor` determines the CSS class applied

### CSS Classes

The markers use these CSS classes (defined in `src/styles/global.css`):

```css
.mark {
  /* Base marker styles */
  display: inline-block;
  margin-right: 0.5em;
  font-weight: 600;
}

.mark-grey {
  color: #999;
}

.mark-orange {
  color: #ff6b35;
}

.mark-blue {
  color: #4a90e2;
}
```

## Best Practices

1. **Use Sparingly**: Too many marked posts reduce the effectiveness
2. **Be Consistent**: Use the same marker type for similar content categories
3. **Color Meaning**: Establish a color system (e.g., orange for time-sensitive, blue for featured)
4. **Accessibility**: The markers are decorative; ensure post titles are self-descriptive

## Limitations

- Only exclamation and question marks are supported
- Maximum of 3 symbols
- Only 3 predefined colors
- Markers only appear on the homepage listing, not on individual post pages

## Implementation Pitfalls

### JSX Whitespace Rendering (2025-01-04)
**Critical Issue**: Whitespace between JSX elements renders as actual space characters.
- **Location**: src/pages/index.astro:171
- **Symptom**: CSS margin adjustments have no effect on spacing between marker and text
- **Fix**: Remove ALL whitespace between `<span>` and `<a>` tags:
  ```jsx
  // BAD - creates unwanted space
  {markStr && <span class={`mark mark-${markColor}`}>{markStr}</span>}
  <a href={`/${post.id}/`}>{post.data.title}</a>
  
  // GOOD - elements touch
  {markStr && <span class={`mark mark-${markColor}`}>{markStr}</span>}<a href={`/${post.id}/`}>{post.data.title}</a>
  ```
- **Lesson**: JSX whitespace is NOT just formatting - it's rendered content

### CSS Specificity
- **Location**: src/styles/global.css:1098-1112
- **Fix**: Changed from `.post-item .mark` to `.mark` for proper application
- **Note**: Astro uses `class` not `className` (fixed in index.astro:171)

## Future Enhancements

Potential improvements could include:
- Custom symbols beyond ! and ?
- More color options
- Marker tooltips for additional context
- Filtering posts by marker type/color