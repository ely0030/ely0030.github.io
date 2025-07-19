# Test Plan for Newline Rendering Fix

## What Was Fixed

The issue where multiple consecutive newlines were rendering with one less line than expected has been fixed. 

### Root Cause
- JavaScript's `split('\n')` creates N-1 empty strings for N consecutive newlines between text
- Example: "A\n\n\n\n\n\nB" splits to ["A", "", "", "", "", "", "B"] - only 5 empty strings for 6 newlines

### Solution Implemented
Modified the `applyMarkdownFormatting()` function in `notepad.astro` to:
1. Handle the special case of text containing only newlines
2. Properly count and render all newlines in mixed content

## Test Cases to Verify

1. **Basic newlines** (should show 3 lines of space):
   ```
   Hello
   
   
   
   Test123
   ```

2. **Six newlines** (should show 6 lines of space):
   ```
   Test123
   
   
   
   
   
   
   TEST124
   ```

3. **Seven newlines** (should show 7 lines of space):
   ```
   TEST124
   
   
   
   
   
   
   
   end
   ```

4. **Only newlines** (should show exact count):
   - Type only Enter keys and verify each one creates a new line

5. **Mixed content** (proper spacing throughout):
   ```
   Line 1
   
   Line 3 (1 empty line above)
   
   
   Line 6 (2 empty lines above)
   
   
   
   Line 10 (3 empty lines above)
   ```

## How to Test

1. Go to `/notepad` in your browser
2. Create a new note or use an existing one
3. Switch to edit mode (Cmd/Ctrl+M)
4. Type or paste the test cases above
5. Switch to view mode (Cmd/Ctrl+M)
6. Verify the correct number of empty lines appear
7. Switch back to edit mode and verify the newlines are preserved

## Expected Results

- Each `\n` should produce exactly one line of vertical space
- No "off by one" errors with consecutive newlines
- Switching between edit and view modes preserves exact newline count