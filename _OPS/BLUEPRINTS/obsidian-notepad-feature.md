# Obsidian-Style Notepad Feature Blueprint (Revised)

## Overview
An interactive notepad feature that allows users to create, edit, and manage markdown notes directly in the browser with Obsidian-style inline editing. Notes are stored in localStorage and displayed in a special section on the homepage. Designed for a static Astro site with minimal JavaScript footprint.

## Core Features

### 1. Obsidian-Style Editing
- **Click-to-edit**: Click any rendered text to instantly edit it inline
- **Live markdown rendering**: As you type `**bold**`, it renders as **bold** immediately
- **Seamless transitions**: No buttons, no escape key - just click to edit, click elsewhere to finish
- **Mobile-first design**: Large touch targets, no hover dependencies
- **Lightweight implementation**: Custom contentEditable solution, no heavy editors

### 2. Note Management
- **Flat structure**: Simple list of notes, no folders
- **Custom titles**: Users can set meaningful titles for their notes
- **Automatic "Untitled" note**: Always available as entry point (orange styled)
- **Note operations**: Create, rename, delete, duplicate
- **Data export/import**: Download as .md files, import from files
- **Accidental deletion protection**: Confirm dialog + temporary undo

### 3. Homepage Integration
- **Apache-style section**: New collapsible "Local Notes" folder
- **Visual differentiation**: Subtle orange tint for local notes
- **Orange "Untitled" entry**: Special entry point to notepad
- **Note count display**: Shows (X notes) like other categories
- **Consistent styling**: Uses existing folder navigation patterns

### 4. Distinct Page Type
- **New page type**: `notepad` added to existing enum
- **Minimalist design**: Clean, distraction-free writing environment
- **Follows site patterns**: Consistent with literature page types
- **Mobile responsive**: Works perfectly on phones/tablets

## Technical Implementation

### 1. Routes & Pages
```
/notepad - Single page with client-side routing via hash
/notepad#note-id - Direct link to specific note
/notepad#new - Create new note
```

### 2. Component Structure
```
src/
├── pages/
│   └── notepad.astro          # Main notepad page
├── components/
│   └── NotepadInit.astro      # Client-side initialization
└── styles/
    └── global.css             # Add body.notepad styles
```

### 3. Data Structure
```javascript
// localStorage keys following site patterns:
// notepad:index - Array of note IDs
// notepad:note-{id} - Individual note data
// notepad:settings - User preferences

// Example note structure
localStorage.setItem('notepad:note-abc123', JSON.stringify({
  id: 'abc123',
  title: 'My First Note',
  content: '# Welcome\n\nThis is my first note...',
  created: '2024-01-15T10:00:00Z',
  modified: '2024-01-15T10:30:00Z',
  protected: false // Optional password protection
}));

// Note index
localStorage.setItem('notepad:index', JSON.stringify([
  'untitled',
  'abc123',
  'def456'
]));
```

### 4. Key Features Implementation

#### Lightweight Obsidian-Style Editing
```javascript
// Use contentEditable with custom markdown parsing
class EditableBlock {
  constructor(element) {
    this.element = element;
    this.markdown = element.dataset.markdown;
    this.setupEditing();
  }
  
  setupEditing() {
    this.element.addEventListener('click', (e) => {
      if (!this.element.isContentEditable) {
        this.startEdit();
      }
    });
    
    this.element.addEventListener('blur', () => {
      this.endEdit();
    });
    
    this.element.addEventListener('input', () => {
      this.livePreview();
    });
  }
  
  startEdit() {
    this.element.contentEditable = true;
    this.element.textContent = this.markdown;
    this.element.focus();
    // Position cursor at click point
    this.setCursorPosition(event);
  }
  
  endEdit() {
    this.element.contentEditable = false;
    this.markdown = this.element.textContent;
    this.render();
    this.save();
  }
  
  livePreview() {
    // Debounced markdown parsing for performance
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      this.renderPreview();
    }, 100);
  }
}
```

#### Minimal Markdown Parser
```javascript
// Use markdown-it (30KB) or custom ultra-light parser
import markdownit from 'https://cdn.jsdelivr.net/npm/markdown-it@13/dist/markdown-it.min.js';

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true
});

// Custom renderer for live preview
function renderMarkdown(text) {
  // Basic replacements for speed during typing
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    // Full parse on blur for complex markdown
}
```

#### Homepage Integration
```astro
<!-- In index.astro after line ~260 where categories are displayed -->
<div class="category-folder local-notes-folder">
  <div class="folder-header" data-category="local-notes">
    <span class="folder-icon">📝</span>
    <span class="folder-name">Local Notes</span>
    <span class="post-count" id="local-notes-count">(0)</span>
  </div>
  <ul class="post-list folder-contents" id="local-notes-list" style="display: none;">
    <li class="post-item local-note untitled">
      <a href="/notepad">Untitled</a>
    </li>
  </ul>
</div>

<script>
  // Load local notes on page load
  const noteIndex = JSON.parse(localStorage.getItem('notepad:index') || '[]');
  const notesList = document.getElementById('local-notes-list');
  const notesCount = document.getElementById('local-notes-count');
  
  // Update count
  notesCount.textContent = `(${noteIndex.length})`;
  
  // Add notes to list
  noteIndex.forEach(noteId => {
    if (noteId === 'untitled') return; // Skip untitled, already shown
    
    const noteData = JSON.parse(localStorage.getItem(`notepad:note-${noteId}`) || '{}');
    const li = document.createElement('li');
    li.className = 'post-item local-note';
    li.innerHTML = `<a href="/notepad#${noteId}">${noteData.title || 'Untitled'}</a>`;
    notesList.appendChild(li);
  });
</script>
```

### 5. Styling Approach

#### CSS Variables for Notepad
```css
/* Add to global.css around line 2400 after literature3 styles */
:root {
  --notepad-font-size: 16px;
  --notepad-line-height: 1.6;
  --notepad-max-width: 700px;
  --notepad-bg: #fafafa;
  --notepad-text: #333;
  --notepad-accent: #ff8c00; /* Orange */
  --notepad-tint: rgba(255, 140, 0, 0.05);
}

/* Notepad page type */
body.notepad {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Arial', sans-serif;
  background: var(--notepad-bg);
  color: var(--notepad-text);
}

body.notepad .layout-wrapper {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2em;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2em;
}

/* Note list sidebar */
body.notepad .note-list {
  border-right: 1px solid #e0e0e0;
  padding-right: 2em;
}

body.notepad .note-item {
  padding: 0.5em;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 0.25em;
}

body.notepad .note-item:hover {
  background: var(--notepad-tint);
}

body.notepad .note-item.active {
  background: var(--notepad-accent);
  color: white;
}

/* Editor area */
body.notepad .editor-area {
  min-height: 80vh;
}

body.notepad .editable-block {
  font-size: var(--notepad-font-size);
  line-height: var(--notepad-line-height);
  max-width: var(--notepad-max-width);
  margin: 0 auto;
  padding: 1em;
  cursor: text;
}

body.notepad .editable-block[contenteditable="true"] {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1em;
  font-family: 'Consolas', 'Monaco', monospace;
  white-space: pre-wrap;
}

/* Local note styling on homepage */
.local-note {
  background: var(--notepad-tint);
}

.local-note.untitled a {
  color: var(--notepad-accent);
  font-weight: 600;
}

.local-notes-folder .folder-icon {
  color: var(--notepad-accent);
}

/* Mobile styles */
@media (max-width: 768px) {
  body.notepad .layout-wrapper {
    grid-template-columns: 1fr;
  }
  
  body.notepad .note-list {
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
    padding-right: 0;
    padding-bottom: 1em;
    margin-bottom: 1em;
  }
  
  body.notepad .editable-block {
    font-size: 18px; /* Larger for mobile */
  }
}
```

### 6. User Flow

1. **Entry Point**: User clicks orange "Untitled" link in "Local Notes" folder
2. **Notepad Opens**: Shows list of notes on left (or top on mobile), editor on right
3. **Click to Edit**: Click any paragraph/heading to edit that block inline
4. **Live Preview**: Markdown renders as you type (bold, italic, headers)
5. **Auto-save**: Debounced save to localStorage every 500ms
6. **Note Management**: Click "+" to create new note, "×" to delete (with confirmation)
7. **Return Home**: Click "Home" link or browser back - notes appear in Local Notes folder

### 7. Progressive Enhancement

- **No-JS fallback**: Show message explaining JavaScript requirement
- **Feature detection**: Check localStorage availability
- **Graceful degradation**: Fall back to textarea if contentEditable unsupported
- **Data recovery**: Export all notes as .zip if localStorage corrupted

### 8. Implementation Phases

#### Phase 1: Basic Infrastructure (Week 1)
- Add `notepad` to pageType enum in `content.config.ts`
- Create `/src/pages/notepad.astro` with basic layout
- Implement localStorage wrapper with error handling
- Add "Local Notes" section to homepage

#### Phase 2: Core Editing (Week 2)
- Implement contentEditable blocks
- Add basic markdown parsing (bold, italic, headers)
- Create auto-save functionality
- Add note list navigation

#### Phase 3: Full Features (Week 3)
- Complete markdown support (lists, code, quotes)
- Add note management (create, rename, delete)
- Implement export/import functionality
- Add mobile optimizations

#### Phase 4: Polish & Integration (Week 4)
- Password protection integration (optional)
- Keyboard shortcuts (Cmd/Ctrl+S to save explicitly)
- Performance optimizations (virtual scrolling for many notes)
- Comprehensive testing

## Critical Implementation Notes

### Following Site Patterns
1. **Use inline script tags** in Astro components (not separate .js files)
2. **Follow localStorage patterns**: `notepad:` prefix for all keys
3. **Use existing CSS variables** where possible
4. **Match Apache-style listing** for homepage integration
5. **No external dependencies** except small markdown parser from CDN

### Avoiding Common Pitfalls
1. **Don't use `white-space: pre-line`** - causes unfixable spacing issues
2. **Test on Node 18.17.1** as specified in `.nvmrc`
3. **Use `requestAnimationFrame`** for smooth animations
4. **Check for localStorage quota** before saving
5. **Handle JSON parse errors** gracefully

### Mobile Considerations
1. **Touch-friendly targets**: Minimum 44px height
2. **No hover states**: Click/tap only interactions
3. **Responsive grid**: Stack on small screens
4. **Larger fonts**: 18px minimum on mobile
5. **Viewport meta tag**: Already set in BaseHead.astro

### Performance Guidelines
1. **Lazy load markdown parser**: Only when entering notepad
2. **Debounce saves**: 500ms delay to reduce writes
3. **Virtual scroll**: For users with 50+ notes
4. **Minimal CSS**: Add only necessary styles
5. **Code splitting**: Dynamic import for editor code

## Testing Checklist

- [ ] Create, edit, save notes
- [ ] Markdown rendering (all CommonMark features)
- [ ] Mobile editing experience
- [ ] Homepage integration displays correctly
- [ ] Export/import functionality
- [ ] localStorage quota handling
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] No console errors
- [ ] Performance (< 50ms edit transitions)
- [ ] Accessibility (keyboard navigation)

## Security Considerations

1. **XSS Prevention**: Sanitize markdown output
2. **localStorage isolation**: Use structured key names
3. **Password protection**: Reuse existing SHA-256 system if needed
4. **Data validation**: Verify JSON structure on load
5. **Export safety**: Sanitize filenames

## Success Metrics

1. **Seamless editing**: < 50ms transition between view/edit
2. **Fast saves**: < 10ms localStorage write
3. **Responsive UI**: No lag during typing
4. **Data safety**: Zero data loss scenarios
5. **Mobile usable**: Full functionality on phones
6. **Small footprint**: < 50KB added JavaScript