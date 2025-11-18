# Prompt Files

These markdown files control the system prompts for each chat mode.

**Prompt Files:**
- `assistant.md` - Assistant mode (planning/daily tasks)
- `tasks.md` - Tasks mode (project management)
- `free.md` - Free mode (general chat)
- `composer.md` - Composer mode instructions (appended when composer mode active)

**How it works:**
- These files are auto-created with stock prompts if they don't exist
- You can edit them to customize Carl's behavior
- Date placeholders like `{D.M.YY}` are automatically replaced
- File-based prompts take priority over settings-based prompts

**To customize a prompt:**
1. Edit the corresponding .md file
2. Reload the plugin or restart Obsidian
3. Your custom prompt will be used

**To reset a prompt:**
- Delete the file - it will be recreated with the stock prompt on next plugin load
- Or manually replace the content with the default from settings

**Current prompt sources** (check console logs):
- Look for: `📊 [System Prompt Stats] ... Source: file` or `Source: settings`
