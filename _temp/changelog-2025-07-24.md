# Changelog - 2025-07-24

## Cross-Platform Font System Overhaul

### Summary
Major typography update to achieve consistent rendering across Windows and Mac platforms with an Apple-inspired aesthetic.

### The Problem
- Site looked significantly different on Windows vs Mac
- Windows default monospace (Courier New) appeared "soft and round, almost like Comic Sans"
- Emoji folder icons rendered differently between platforms
- Notepad didn't use full screen width on Windows

### Changes Made

#### 1. Font Stack Updates
**Before:**
```css
font-family: monospace;
```

**After:**
```css
/* Body text */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;

/* Monospace */
font-family: 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
```

#### 2. Apple Design Aesthetic
- Added `-webkit-font-smoothing: antialiased` for smooth rendering
- Letter spacing: `-0.022em` for tighter, elegant typography
- Font weight: 400 (regular) for consistency
- Colors updated:
  - Background: `#ffffff` (pure white)
  - Text: `#1d1d1f` (Apple's subtle dark gray)
  - Links: `#0066CC` (Apple's signature blue)
  - Shadows: Softer, more subtle

#### 3. Emoji Icons Replaced
Replaced all emoji folder icons with text symbols for consistent cross-platform rendering:
- 📝 → `[A]` (Articles)
- 💡 → `[i]` (Ideas)
- 🎨 → `[C]` (Creative)
- ⚙️ → `[T]` (Technical)
- 🌱 → `[P]` (Personal)
- 📋 → `[R]` (Protocols)
- 💭 → `[t]` (Thoughts)
- 📁 → `[+]` (Saved/Collapsed)
- 📂 → `[-]` (Expanded)

#### 4. Notepad Full Width Fix
**Global CSS (`src/styles/global.css`)**:
```css
body.notepad .main-content-area {
  max-width: 100%;  /* Was 1200px */
  margin: 0;
  padding: 0 1em;
}
```

**Notepad Layout (`src/pages/notepad.astro`)**:
```css
.notepad-container {
  grid-template-columns: 250px 1fr;  /* Was 300px 1fr */
  gap: 1.5em;  /* Was 2em */
  width: 100%;
  max-width: 100%;
}
```

### Files Modified
- `src/styles/global.css` - Complete font system overhaul
- `src/pages/notepad.astro` - Font updates and full-width layout
- `src/pages/index.astro` - Font and icon updates
- `src/pages/planning-wall.astro` - Font consistency updates
- `docs/font_system.md` - Documentation updated
- `docs/notepad-layout-fix.md` - Added full-width section

### Result
- Consistent appearance across Windows and Mac
- Clean, minimal Apple-inspired aesthetic
- Better typography with SF fonts
- Full-width notepad utilization
- No more emoji rendering differences

### Testing Notes
The changes were tested by temporarily using Comic Sans MS to verify that font changes were applying correctly, confirming the issue was with the default monospace fallbacks on Windows.