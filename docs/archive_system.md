# Archive System

This document describes the archive system for preserving older content outside the main blog flow.

## Overview

The archive system allows you to preserve static HTML versions of older posts or content that you want to keep accessible but not part of the main blog collection.

## Directory Structure

```
/archive/
  /master/
    concept1.html
    worldview-summary.html
```

## Features

- Static HTML files preserved exactly as they were
- Not processed by Astro's build system
- Accessible via direct URL paths
- Manually linked from the homepage

## Adding Archived Content

1. Create static HTML files in `/archive/master/` (or create new subdirectories)
2. Add manual links to these files where needed

Example from `src/pages/index.astro`:

```html
<li class="post-item">
  <h2>
    <a href="/you-should-exercise.html">You Should Exercise (Archived)</a>
  </h2>
</li>
```

## Use Cases

- Preserving content from previous versions of the site
- Keeping historically important posts in their original format
- Storing content that doesn't fit the current blog structure
- Maintaining legacy URLs for backwards compatibility

## Static File Handling

Archived HTML files can also be placed directly in the `/public/` directory:
- Example: `/public/you-should-exercise.html`
- Accessible at the root URL path
- Not processed by Astro, served as-is

## Best Practices

1. **Naming**: Use descriptive filenames that indicate the content
2. **Organization**: Group related archives in subdirectories
3. **Linking**: Always indicate when content is archived
4. **Preservation**: Keep the original formatting and structure
5. **Documentation**: Note why content was archived and when

## Limitations

- No automatic index generation for archived content
- Must manually maintain links to archived files
- No RSS feed inclusion for archived content
- No sitemap entries (unless manually configured)

## Future Considerations

- Could implement an archive index page
- Might add metadata files for archived content
- Consider adding redirects from old URLs if needed