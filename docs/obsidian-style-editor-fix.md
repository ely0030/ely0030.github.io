# Obsidian-Style Editor Fix

## What Changed

### Before (Block-based editing)
- Multiple separate editable blocks
- Pressing Enter created new blocks
- Each paragraph was its own mini-editor
- Confusing and not like Obsidian at all

### After (Single document editing)
- One continuous editor like Obsidian
- Natural typing experience
- Enter key creates new lines, not blocks
- Click anywhere to start editing the whole document

## Technical Changes

1. **Simplified Note Model**
   - Changed from `blocks: []` array to single `content` string
   - Removed block management methods
   - Much cleaner data structure

2. **Single Editor**
   - Replaced multiple `.editable-block` divs with one `.editor-content`
   - Removed "add block" button
   - Simplified editing logic

3. **Better User Experience**
   - Click once to edit entire document
   - Type naturally with proper line breaks
   - Markdown still renders when you click outside
   - Works exactly like Obsidian now

## Result
The notepad now provides a natural writing experience just like Obsidian - click to edit, type freely, and see your markdown rendered when you're done. No more weird block behavior!