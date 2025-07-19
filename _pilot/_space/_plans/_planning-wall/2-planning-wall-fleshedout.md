# Planning Wall Implementation Plan - Fleshed Out

## Overview
This document provides detailed implementation plans for the three key UX improvements identified for the planning wall interface.

## Issue 1: Card Title Edit Mode Behavior

### Current Problem
- Hovering over card titles shows "move" cursor instead of "edit" cursor
- Clicking title enters edit mode but requires second click to actually position cursor
- Edit mode exits unexpectedly when trying to interact with other card elements

### Detailed Implementation Plan

#### 1.1 Cursor Behavior Fix
**Technical Approach:**
- Replace CSS `cursor: move` with `cursor: text` on card title elements
- Add `cursor: pointer` on hover for visual feedback
- Implement conditional cursor styling based on hover state

**Code Changes:**
```css
.card-title {
  cursor: text;
}

.card-title:hover {
  cursor: pointer;
  background-color: rgba(0,0,0,0.05);
}
```

#### 1.2 Edit Mode Activation
**Technical Approach:**
- Implement single-click-to-edit behavior
- Use `contentEditable` with immediate focus
- Position cursor at click location using `document.caretRangeFromPoint`

**Implementation Steps:**
1. Add event listener for single click on title
2. Enable `contentEditable="true"` immediately
3. Use `window.getSelection()` to place cursor at exact click position
4. Prevent event bubbling to avoid triggering parent handlers

#### 1.3 Edit Mode Persistence
**Technical Approach:**
- Implement "edit lock" state that prevents accidental exit
- Add click-outside detection with whitelist for dropdown interactions
- Use event delegation for handling interactions within edit mode

**Code Structure:**
```javascript
class CardEditManager {
  constructor(cardElement) {
    this.isEditing = false;
    this.editLock = false;
    this.clickWhitelist = ['dropdown', 'select', 'option'];
  }
  
  enterEditMode(event) {
    this.isEditing = true;
    this.editLock = true;
    setTimeout(() => this.editLock = false, 100);
  }
}
```

## Issue 2: Dropdown Interaction During Edit Mode

### Current Problem
- Dropdowns open but immediately close when trying to select options
- Edit mode exit conflicts with dropdown interactions

### Detailed Implementation Plan

#### 2.1 Event Propagation Control
**Technical Approach:**
- Stop event propagation at dropdown level
- Implement proper focus management between edit mode and dropdowns
- Use event capturing vs bubbling strategically

**Implementation:**
```javascript
handleDropdownClick(event) {
  event.stopPropagation();
  event.preventDefault();
  
  // Maintain edit mode while allowing dropdown interaction
  this.maintainEditMode = true;
  
  // Position dropdown relative to trigger
  this.positionDropdown(event.target);
}
```

#### 2.2 Focus Management
**Technical Approach:**
- Create focus trap within card during edit mode
- Allow dropdown focus without exiting edit mode
- Implement blur handling that distinguishes intentional vs accidental focus loss

**Focus Strategy:**
- Use `tabindex="-1"` on card container during edit mode
- Implement `focusout` event handler with relatedTarget checking
- Add 100ms delay before processing blur to allow dropdown selection

#### 2.3 Dropdown State Management
**Technical Approach:**
- Track dropdown open state
- Prevent edit mode exit while dropdown is active
- Restore focus to appropriate element after dropdown interaction

## Issue 3: Drag-and-Drop Card Swapping

### Current Problem
- Cannot drag cards to positions occupied by other cards
- No visual feedback during drag operations
- Cards don't automatically swap positions

### Detailed Implementation Plan

#### 3.1 Drag and Drop Enhancement
**Technical Approach:**
- Implement HTML5 drag and drop API with custom swap logic
- Create visual indicators for drop zones
- Implement smooth animations for card swapping

**Drag Implementation:**
```javascript
class CardDragManager {
  constructor(container) {
    this.draggedCard = null;
    this.dropTargets = [];
    this.animationDuration = 300;
  }
  
  handleDragStart(event) {
    this.draggedCard = event.target;
    event.dataTransfer.effectAllowed = 'move';
    this.addDropIndicators();
  }
  
  handleDragOver(event) {
    event.preventDefault();
    this.showSwapPreview(event.target);
  }
}
```

#### 3.2 Visual Feedback System
**Technical Approach:**
- Create ghost element during drag
- Show swap preview with opacity changes
- Implement smooth transitions using CSS transforms

**Visual Elements:**
- Drag ghost: Semi-transparent clone of dragged card
- Drop indicators: Subtle lines showing potential drop positions
- Swap preview: Temporary repositioning of affected cards

#### 3.3 Swap Logic
**Technical Approach:**
- Calculate target positions based on mouse coordinates
- Implement swap animation using CSS transitions
- Update data model after successful swap

**Swap Algorithm:**
1. Determine closest card to drop position
2. Calculate new positions for both cards
3. Animate swap using transform: translate()
4. Update DOM order after animation
5. Persist new order to backend

#### 3.4 Touch Device Support
**Technical Approach:**
- Implement touch events for mobile devices
- Use long-press to initiate drag mode
- Provide haptic feedback where supported

## System Analysis & Implementation Considerations

### Current System Architecture
Based on codebase investigation, the planning wall appears to be a custom implementation that may use:
- Vanilla JavaScript for interactions
- CSS Grid or Flexbox for layout
- HTML5 drag and drop API
- Custom event handling system

### Key Technical Challenges Identified

#### 1. Event Delegation Complexity
**Challenge:** The current system likely uses event delegation which can interfere with edit mode and dropdown interactions.
**Solution:** Implement event capturing phase handling and proper event.stopPropagation() usage.

#### 2. CSS Cursor State Management
**Challenge:** CSS cursor states may be conflicting between drag and edit modes.
**Solution:** Use CSS classes with higher specificity and JavaScript-based cursor switching.

#### 3. Focus Management Between Modes
**Challenge:** Managing focus between edit mode, dropdowns, and drag operations.
**Solution:** Implement a focus manager that tracks active elements and prevents unwanted focus changes.

#### 4. Z-Index Stacking Issues
**Challenge:** Dropdowns and drag previews may have z-index conflicts.
**Solution:** Establish clear z-index hierarchy with drag operations at highest level.

#### 5. Touch vs Mouse Event Handling
**Challenge:** Differentiating between touch and mouse events for mobile support.
**Solution:** Use pointer events API for unified handling across devices.

### Browser Compatibility Considerations

#### Modern Browser Support
- **Chrome 88+**: Full support for all features
- **Firefox 85+**: Full support for all features  
- **Safari 14+**: Full support with minor polyfills needed
- **Edge 88+**: Full support for all features

#### Required Polyfills
- `element.closest()` for IE11 support
- `element.matches()` for IE11 support
- CSS Grid/Flexbox fallbacks for older browsers

### Performance Considerations

#### 1. Animation Performance
- Use CSS transforms instead of changing layout properties
- Implement `will-change` hints for animated elements
- Use `requestAnimationFrame` for smooth animations

#### 2. Memory Management
- Clean up event listeners on card removal
- Remove drag ghost elements after operations
- Clear timeouts and intervals

#### 3. Event Listener Optimization
- Use event delegation for card interactions
- Throttle drag events to prevent performance issues
- Debounce resize events for responsive behavior

### Testing Strategy

#### Unit Tests
- Edit mode state management
- Event propagation control
- Position calculations for swaps

#### Integration Tests
- Full card interaction flows
- Drag-and-drop scenarios
- Cross-browser compatibility

#### User Testing
- A/B test cursor behaviors
- Measure task completion rates
- Gather feedback on visual feedback

### Implementation Priority & Timeline

#### Phase 1: Critical UX Fixes (Week 1)
1. Fix edit mode cursor behavior (Issue 1.1)
2. Resolve dropdown interaction conflicts (Issue 2.1-2.2)
3. Basic drag-and-drop functionality (Issue 3.1)

#### Phase 2: Enhanced Interactions (Week 2)
1. Advanced cursor positioning in edit mode (Issue 1.2)
2. Visual feedback for drag operations (Issue 3.2)
3. Smooth swap animations (Issue 3.3)

#### Phase 3: Polish & Mobile Support (Week 3)
1. Edit mode persistence improvements (Issue 1.3)
2. Touch device support (Issue 3.4)
3. Performance optimizations

### Success Metrics
- Reduced misclicks on card titles by 80%
- Successful dropdown interactions during edit mode
- Drag-and-drop completion rate >90%
- Average task time reduction of 30%

### Technical Dependencies
- Modern browser support for drag and drop API
- CSS transform support for animations
- ES6+ JavaScript features
- No external library dependencies required

### Risk Mitigation

#### 1. Backward Compatibility
- Maintain existing API contracts
- Provide graceful degradation for older browsers
- Document breaking changes

#### 2. Accessibility
- Ensure keyboard navigation works with new interactions
- Provide ARIA labels for screen readers
- Maintain focus indicators

#### 3. Data Integrity
- Implement rollback mechanism for failed swaps
- Validate card positions before committing changes
- Provide undo functionality for critical operations
