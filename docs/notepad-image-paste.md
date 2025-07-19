# Notepad Image Paste Implementation

## Overview
Added copy/paste image functionality to the notepad editor, allowing users to paste images directly from their clipboard. Images are stored using IndexedDB with a localStorage base64 fallback.

## Technical Implementation

### Storage Architecture
1. **Primary Storage**: IndexedDB for blob storage
   - Database: `notepadImages`
   - Object Store: `images`
   - Indexes: `noteId`, `created`
   - Size limits: 5MB per image, 50MB total

2. **Fallback Storage**: localStorage with base64 encoding
   - Keys: `notepad:image-{imageId}`
   - Used when IndexedDB is unavailable

### Image Reference Format
Images are stored with markdown syntax:
```markdown
![alt text](notepad-image:{imageId})
```

### Key Components

#### ImageStorage Class
- Manages IndexedDB operations for image blobs
- Provides async methods for save, get, delete operations
- Includes fallback to base64 localStorage
- Tracks images by note ID for bulk operations

#### Paste Handler Enhancement
- Detects image items in clipboard data
- Shows loading indicator during upload
- Inserts markdown reference after successful save
- Creates object URLs for immediate display

#### Markdown Formatting
- Extended `formatMarkdownLine` to render stored images
- Converts `notepad-image:` references to img tags
- Manages object URLs to prevent memory leaks

#### Export Functionality
- Converts stored images to base64 data URLs
- Embeds images inline for portable markdown export
- Preserves image references in exported content

### Browser Compatibility
- Modern browsers: Full support via Clipboard API
- Safari: Basic functionality works
- Fallback: Base64 storage when IndexedDB unavailable

### Performance Considerations
- Object URLs are created on-demand and cleaned up when switching notes
- Images are lazy-loaded when rendering markdown
- Size limits prevent storage bloat

## Usage

### Pasting Images
1. Copy an image to clipboard (screenshot, image from web, etc.)
2. Click in the editor where you want the image
3. Paste (Cmd/Ctrl + V)
4. Image uploads and markdown reference appears

### Image Display
- Images render inline with max-width: 100%
- Responsive sizing maintains aspect ratio
- Block display with vertical margins

### Limitations
- No image editing capabilities
- No drag-and-drop support (paste only)
- Images tied to specific notes
- Size limits: 5MB per image

## Future Enhancements
- Drag-and-drop support
- Image resizing/compression
- Gallery view for all images
- Import images from URLs