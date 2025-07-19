# Blueprint: Notepad to Blog Post Export Feature

## Overview
Enable the notepad to create properly formatted blog posts with frontmatter, organized images, and export functionality.

## Current State
- Notepad stores content in localStorage (text) and IndexedDB (images)
- Images use custom `notepad-image:id` format
- Export creates single markdown file with base64 images
- No frontmatter support

## Proposed Implementation

### Phase 1: Frontmatter UI
Add metadata fields to notepad for blog post properties:

```javascript
// Add to NotepadApp class
this.noteMetadata = new Map(); // noteId -> metadata

// Metadata structure
{
  title: '',
  description: '',
  pubDate: new Date().toISOString(),
  pageType: 'blog', // dropdown: blog, magazine, stanza, literature, book
  category: '', // optional
  private: false,
  passwordHash: '', // if private
  markType: '', // optional: question, exclamation
  markCount: 1,
  markColor: ''
}
```

#### UI Components
1. **Metadata Panel** (collapsible, above editor)
   - Title input (required)
   - Description textarea (required)
   - Date picker (defaults to today)
   - Page type dropdown
   - Category input (lowercase validation)
   - Private checkbox + password field
   - Visual markers section

2. **Storage Integration**
   - Store metadata in localStorage: `notepad:metadata-{noteId}`
   - Include in export/import

### Phase 2: Export System

#### Export Options
1. **"Export as Blog Post" button**
   - Generates proper frontmatter
   - Converts images to file references
   - Creates downloadable .md file

2. **File Structure**
```
post-title.md
post-title/
  ├── image1.jpg
  ├── image2.png
  └── ...
```

#### Export Process
```javascript
async exportAsBlogPost(noteId) {
  const note = this.notes.get(noteId);
  const metadata = this.noteMetadata.get(noteId);
  
  // 1. Generate frontmatter
  const frontmatter = this.generateFrontmatter(metadata);
  
  // 2. Process content
  let content = note.content;
  const imageMap = new Map(); // old id -> new filename
  
  // 3. Extract and rename images
  const images = await this.extractImages(content);
  images.forEach((img, index) => {
    const ext = this.getImageExtension(img.blob);
    const filename = `image-${index + 1}.${ext}`;
    imageMap.set(img.id, filename);
  });
  
  // 4. Update image references
  content = content.replace(
    /!\[([^\]]*)\]\(notepad-image:([^)]+)\)/g,
    (match, alt, id) => {
      const filename = imageMap.get(id);
      return `![${alt}](/${metadata.title}/${filename})`;
    }
  );
  
  // 5. Create blog post
  const blogPost = `---\n${frontmatter}---\n\n${content}`;
  
  // 6. Package for download
  return this.createDownloadPackage(blogPost, images, imageMap);
}
```

### Phase 3: Image Handling

#### Image Export Format
- Convert blobs to actual image files
- Use sensible naming: `image-1.jpg`, `image-2.png`
- Maintain aspect ratios and quality

#### Download Methods
1. **ZIP Archive** (recommended)
   ```javascript
   // Using JSZip library
   const zip = new JSZip();
   zip.file(`${slug}.md`, blogPost);
   
   const imgFolder = zip.folder(slug);
   images.forEach((img, filename) => {
     imgFolder.file(filename, img.blob);
   });
   
   zip.generateAsync({type: 'blob'})
     .then(blob => download(blob, `${slug}.zip`));
   ```

2. **Individual Files** (fallback)
   - Download .md file
   - Show instructions for image placement

### Phase 4: Integration

#### Filename Generation
```javascript
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

#### Validation
- Ensure required fields (title, description, date)
- Validate date format
- Check category lowercase
- Warn if images exceed reasonable size

### Phase 5: Future Enhancements

1. **Direct File System Access** (when available)
   - Use File System Access API
   - Write directly to `src/content/blog/`

2. **Preview Mode**
   - Show how post will look with selected pageType
   - Validate frontmatter

3. **Import Existing Posts**
   - Load .md files into notepad for editing
   - Parse frontmatter back to UI

## Technical Considerations

### Dependencies
- No external libraries initially
- Consider JSZip for archive creation
- File System Access API for future

### Storage Limits
- localStorage: ~5MB (text + metadata)
- IndexedDB: ~50MB (images)
- Show usage indicators

### Performance
- Lazy load images during export
- Stream large files if possible
- Progress indicator for exports

## Implementation Order
1. Add metadata UI (2-3 hours)
2. Update storage to include metadata (1 hour)
3. Create export function with frontmatter (2 hours)
4. Implement image extraction and renaming (3 hours)
5. Add ZIP packaging (2 hours)
6. Testing and polish (2 hours)

Total estimate: 12-15 hours

## Alternative Approach: Server-Side API
If static limitations are too restrictive:
1. Create API endpoint that accepts notepad exports
2. Server processes and saves to file system
3. Requires dynamic Astro setup or separate service