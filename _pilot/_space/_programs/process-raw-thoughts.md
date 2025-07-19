# Process Raw Thoughts - Enhanced Instructions

This file contains the complete program/instructions for processing raw thoughts from `1-raw-thoughts.md` into the structured priority system.

## Program Overview
When executed, this program will:
1. Read raw thoughts from `1-raw-thoughts.md`
2. **Detect duplicates** against existing archived thoughts and current priorities
3. **Map dependencies** between features to identify implementation order
4. **Group features** by implementation requirements
5. **Validate context preservation** for nuanced interpretations
6. **Rebalance priorities** when new items are added
7. Archive processed thoughts with proper context
8. Clear `1-raw-thoughts.md` for new input

## Execution Steps

### Step 1: Duplicate Detection
- Read `1.5-old-thoughts.md` to identify previously processed requests
- Read `2-priority-list.md` for current priorities
- Read `completed.md` for completed items
- Flag any duplicate or similar requests
- Present duplicates for review before processing

### Step 2: Dependency Mapping
- Analyze each new feature for dependencies:
  - **Nested folders** → Required for drag-and-drop nesting
  - **Emoji display** → Required for emoji management UI
  - **Folder structure** → Required for sections
- Create dependency graph
- Suggest implementation order

### Step 3: Feature Grouping
Group related features by implementation:
- **UI/UX Group**: Blue outline removal, emoji display, scroll persistence
- **Structure Group**: Nested folders, sections, drag-and-drop
- **Content Group**: Literature formatting, notepad page style
- **Management Group**: Category management UI

### Step 4: Context Preservation
- Preserve original emphasis and formatting from raw thoughts
- Maintain high-signal nuance (e.g., "exactly the same" vs "similar")
- Archive with context markers for important details
- Flag ambiguous interpretations for clarification

### Step 5: Priority Rebalancing
- When new items are added:
  - Re-evaluate impact scores relative to existing items
  - Adjust effort scores based on new context
  - Re-sequence priorities if dependencies change
  - Ensure consistent scoring across similar features

### Step 6: Enhancement & Validation
- Enhance descriptions to capture nuances missed in initial processing
- Validate impact/effort scores are consistent
- Update priority list with refined descriptions
- Add dependency notes to priority items

### Step 7: Archival
- Move processed thoughts to `1.5-old-thoughts.md`
- Include timestamp, processing status, and dependency notes
- Maintain original formatting for high-signal content
- Add cross-references to related features

### Step 8: Reset
- Clear `1-raw-thoughts.md` with placeholder text
- Update dependency tracking
- Leave ready for new raw thoughts

## File Structure Requirements
```
_pilot/_space/
├── 1-raw-thoughts.md (source - will be cleared)
├── 1.5-old-thoughts.md (archive - will be appended)
├── 2-priority-list.md (target - will be enhanced)
├── completed.md (reference - may be updated)
├── _programs/
│   └── process-raw-thoughts.md (this file)
```

## Usage
To execute this program, simply say:
"Execute the program in @_pilot/_space/_programs/process-raw-thoughts.md"

The program will automatically process all raw thoughts with enhanced duplicate detection, dependency mapping, and context preservation.
