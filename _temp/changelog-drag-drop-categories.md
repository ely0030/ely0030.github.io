# Changelog - Drag & Drop Category Organization

## Date: 2025-01-24

### Feature Added: Drag & Drop Category Organization in Notepad

#### What Changed
- Implemented drag and drop functionality for reorganizing blog post categories between sections
- Users can now drag categories from one section (e.g., "Personal") to another (e.g., "Technical")
- Visual feedback during drag operations with hover states and drop indicators
- Automatic persistence to localStorage so organization is maintained across sessions

#### Files Modified
- `src/pages/notepad.astro`
  - Added drag and drop event handlers (handleCategoryDragStart, handleCategoryDrop, etc.)
  - Added visual indicators for drag states
  - Integrated with existing section management system

#### Technical Details
- Categories become draggable when hovering over them
- Drop zones highlight when dragging over valid sections
- Position-aware dropping allows precise placement between existing categories
- Immediate UI update with populateBlogPosts() after successful drop
- User feedback via showMessage() method

#### Known Issues
- Minor console error from cached version may appear but doesn't affect functionality
- Clear browser cache if drag and drop doesn't work initially

#### User Impact
- More intuitive organization of blog post categories
- No need to manually edit sections through other means
- Visual, user-friendly interface for content organization
