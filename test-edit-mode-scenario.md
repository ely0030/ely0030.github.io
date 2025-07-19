# Test Scenario for Edit Mode Auto-Exit

## Steps to test:
1. Click on the editor to focus it
2. Click the "Cmd/Ctrl+M: edit mode" link (or press Cmd/Ctrl+M)
   - You should see "toggleEditMode called" in console
   - Editor should show raw markdown (images as text)
   - Edit mode indicator should appear briefly
3. Click outside the editor (e.g., on the sidebar)
   - You should see "Editor blur event triggered" 
   - You should see "Edit mode check - isInEditMode: true"
   - You should see "Auto-exiting edit mode"
   - Editor should return to normal mode (images rendered)

## Expected console output when clicking outside while in edit mode:
```
Editor blur event triggered
Blur timeout executing, activeElement: <body...>
Edit mode check - isInEditMode: true checkbox checked: false
Auto-exiting edit mode
```

## If auto-exit doesn't work:
- Check if the "keep" checkbox is checked
- Verify the blur handler is running (you should see the logs)
- Check if edit mode is properly set to "true" before clicking outside