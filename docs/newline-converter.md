# Newline Converter for Literature Pages

## Overview
The newline converter automatically formats literature pages by converting multiple consecutive newlines into `<br>` tags for precise control over line spacing.

## 🚀 Automatic Conversion (Recommended)

### How It Works
1. Place your markdown files in `src/content/drafts/`
2. Run `npm run dev`
3. Files are automatically:
   - Given frontmatter (if missing or incomplete)
   - Converted (if they're literature pages)
   - Moved to `src/content/blog/`
   - Ready to view in your site

### Auto-Generated Frontmatter
The converter will automatically generate or fix frontmatter:
- **title**: From first `#` heading or filename
- **description**: From first paragraph (up to 150 chars)
- **pubDate**: Today's date
- **pageType**: `literature` (if multiple line breaks detected)

### Example
```bash
# 1. Add your file
cp my-essay.md src/content/drafts/

# 2. Start the dev server
npm run dev

# Output:
# 🔄 Checking for markdown files to convert...
# Found 1 markdown file(s) to process
# 
# Processing: my-essay.md
#   ✓ Converted newlines for literature page
#   ✓ Moved to blog directory
#   ✓ Removed from drafts
# 
# ✅ Successfully processed 1 file(s)
```

## Manual Conversion (Advanced)

## Location
```
src/utils/convert-newlines.js
```

## How to Use

### Basic Usage
```bash
node src/utils/convert-newlines.js "path/to/your/file.md"
```

### Example
```bash
node src/utils/convert-newlines.js "src/content/blog/yin copy.md"
```

## What It Does

The converter:
1. **Only processes literature pages** (files with `pageType: literature` in frontmatter)
2. **Creates a backup** of your original file (adds `.backup` extension)
3. **Converts 3+ consecutive newlines** into appropriate `<br>` tags

### Conversion Rules
- 1 newline → stays as is (ignored by markdown)
- 2 newlines (blank line) → stays as is (creates new line)
- 3 newlines → 2 newlines + `<br>` (blank line + line break)
- 4 newlines → 2 newlines + `<br><br>` (blank line + 2 line breaks)
- etc.

### CRITICAL: Frontmatter Generation
Auto-converter wraps titles/descriptions in QUOTES (lines 33-34, 51, 61)
- Prevents numeric filenames from being parsed as numbers
- Example: `title: "20250702232207"` NOT `title: 20250702232207`

## Example Transformation

**Before:**
```markdown
First paragraph.


Second paragraph with extra space above.
```

**After:**
```markdown
First paragraph.

<br>
Second paragraph with extra space above.
```

## Literature Page Behavior

In literature pages:
- **Single line breaks** in markdown are ignored
- **Blank lines** create a new line (no extra spacing)
- **`<br>` tags** create controlled line breaks

## Workflow

1. Write your literature page naturally with line breaks
2. Use extra newlines (3+) where you want additional spacing
3. Run the converter before committing
4. The converter preserves your markdown readability while adding precise spacing control

## Reverting Changes

If you need to revert:
```bash
mv "your-file.md.backup" "your-file.md"
```

This restores your original file from the backup.