# Troubleshooting Guide

This guide covers common issues and their solutions when working with the ely0030 blog site.

## Markdown Rendering Issues

### Horizontal Rules Not Appearing
**Problem**: `---` in markdown not rendering as horizontal line
**Cause**: Markdown requires blank lines before AND after `---`
**Solution**:
```markdown
content

---

more content
```
**NOT**: `content\n---\nmore content`

### Numeric Titles Causing Build Errors
**Problem**: `title: Expected type "string", received "number"`
**Cause**: Unquoted numeric values in frontmatter
**Solution**: Always quote titles/descriptions in auto-converter
- `src/utils/auto-convert-literature.js` lines 33-34, 51, 61

## Development Issues

### Port Already in Use

**Problem**: Error message "Port 4321 is already in use"

**Solutions**:
1. Kill the process using the port:
   ```bash
   # Find and kill process on port 4321
   lsof -ti:4321 | xargs kill -9
   ```

2. Use a different port:
   ```bash
   npx astro dev --port 3000
   ```

### NVM Not Found

**Problem**: `run-dev.sh` fails with "nvm: command not found"

**Solutions**:
1. Install NVM:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

2. Or run Astro directly without the script:
   ```bash
   npx astro dev
   ```

### PowerShell Script Failures on Windows

**Problem**: Running a `.ps1` script fails with parser errors, "missing terminator" errors, or appears to garble long commands.

**Cause 1: PowerShell Execution Policy**: By default, PowerShell can't run scripts.
**Solution 1**: Bypass the policy for a single run.
```powershell
powershell -ExecutionPolicy Bypass -File your-script.ps1
```

**Cause 2: PSReadLine Module Bug**: The line-editing module in PowerShell can crash when handling very long, single-line commands or complex, multi-line strings.
**Solution 2**: The most robust solution is to simplify the script.
*   **Separate Languages**: Instead of embedding JavaScript inside a PowerShell here-string, move the JS code to its own `.js` file and have the PowerShell script execute it with `node your-script.js`.
*   **Use Full Paths**: For commands not on the system `PATH` (like `openssl`), use the full, absolute path in your script (e.g., `"C:\Program Files\Git\usr\bin\openssl.exe"`).

**Cause 3: Character Encoding Issues**: PowerShell can misinterpret special characters or emojis in script files if the encoding is not standard.
**Solution 3**: Remove any non-standard characters (like 🔒, ✅) from your script files and save them with standard UTF-8 encoding.

### Node Version Errors

**Problem**: "Error: Node version X does not satisfy >=18.17.1"

**Solution**:
1. With NVM:
   ```bash
   nvm install 18.17.1
   nvm use 18.17.1
   ```

2. Without NVM: Download and install Node.js 18.17.1+ from [nodejs.org](https://nodejs.org)

## Build Issues

### Build Failures

**Problem**: Build command fails with various errors

**Solutions**:
1. Clear cache and rebuild:
   ```bash
   rm -rf .astro/
   rm -rf dist/
   rm -rf node_modules/
   npm install
   npm run build
   ```

2. Check for syntax errors in markdown files:
   - Unclosed code blocks
   - Invalid frontmatter YAML
   - Missing required fields

### Missing Dependencies

**Problem**: "Cannot find module" errors

**Solution**:
```bash
rm -rf node_modules/
rm package-lock.json
npm install
```

## Content Issues

### Character Encoding Problems

**Problem**: Smart quotes or special characters appear as mojibake (â€™, â€œ, etc.)

**Solutions**:
1. Ensure `smartypants: false` in `astro.config.mjs`
2. Check file encoding is UTF-8
3. Use straight quotes in markdown: `"` instead of `""`

### Private Posts Not Working

**Problem**: Password protection not functioning

**Checklist**:
1. Include both fields in frontmatter:
   ```yaml
   private: true
   passwordHash: 'your-sha256-hash'
   ```

2. Generate correct hash:
   ```javascript
   // Browser console
   const password = 'your-password';
   const hash = await crypto.subtle.digest('SHA-256', 
     new TextEncoder().encode(password));
   const hashHex = Array.from(new Uint8Array(hash))
     .map(b => b.toString(16).padStart(2, '0'))
     .join('');
   console.log(hashHex);
   ```

### Visual Markers Not Appearing

**Problem**: Post markers (!, ?) not showing on homepage

**Requirements**:
All three fields must be present:
```yaml
markType: 'exclamation'  # or 'question'
markCount: 2             # 1, 2, or 3
markColor: 'orange'      # 'grey', 'orange', or 'blue'
```

## Styling Issues

### CSS Specificity Failures in Astro
**CRITICAL**: Astro's CSS compilation order is unpredictable. Page-specific styles load BEFORE general styles.

**Failed approaches (2025-01-04)**:
- `body.literature2 .prose h4 { margin: 0 !important }` - overridden by `.prose ul`
- Inline styles in BlogPost.astro - still overridden
- Adjacent sibling selectors `h4 + ul` - no effect
- `:where()` pseudo-class - no effect
- JavaScript style injection - only Reset worked (too aggressive)

**Root cause**: `global.css:861-863` `.prose ul, .prose ol { margin: 1em 0 1.5em }` loads AFTER literature2 styles in build.

**Working solutions**:
1. Use CSS layers: `@layer base, components, utilities`
2. Move general .prose rules to load first
3. Apply styles at component level where .prose is rendered
4. Use CSS-in-JS or Astro's scoped styles

### Excessive Spacing Between Elements
**Problem**: Large gap between paragraphs and lists/bullet points that CSS margin/padding changes won't fix

**Root cause**: `white-space: pre-line` in `.prose` (BlogPost.astro:105) preserves newlines as visual space
- The newline between `</p>` and `<ul>` in HTML becomes actual rendered space
- No amount of negative margin will fix this because it's not margin - it's preserved whitespace

**Failed debugging attempts (2025-01-04, 2+ hours)**:
- Reduced heading margins from 0.5rem → 0.2rem - no effect
- Set `p + ul { margin-top: 0 !important }` - no effect  
- Used negative margins (-0.5em, -1em) - no effect
- Added `position: relative; top: -0.5em` - no effect
- Forgot to add `is:global` to BlogPost.astro styles - they were scoped

**Solution**: Remove `white-space: pre-line` from `.prose` selector
```css
/* BlogPost.astro line 105 */
.prose {
  /* white-space: pre-line; */ /* REMOVED: Causes unfixable spacing */
}
```

**Key insight**: When spacing seems impossible to fix with margin/padding, check `white-space` property first

### Code Blocks Not Styled

**Problem**: Code blocks appear unstyled or with default colors

**Solutions**:
1. Ensure Prism CSS is loaded in `global.css`
2. Check syntax highlighting is enabled:
   ```javascript
   // astro.config.mjs
   markdown: {
     syntaxHighlight: 'prism',
   }
   ```

3. Use supported language identifiers:
   ````markdown
   ```javascript
   // Code here
   ```
   ````

### Fonts Not Loading

**Problem**: ET Book or other custom fonts not displaying

**Checklist**:
1. Font files exist in `/public/assets/fonts/`
2. Font-face declarations in CSS
3. Clear browser cache
4. Check network tab for 404s

## Deployment Issues

### Netlify Build Failures

**Problem**: Site builds locally but fails on Netlify

**Common causes**:
1. **Node version mismatch**: Add to `netlify.toml`:
   ```toml
   [build.environment]
     NODE_VERSION = "20.3.0"
   ```

2. **Case sensitivity**: File paths are case-sensitive on Linux (Netlify)
   - Check import paths match actual filenames
   - Verify image references

3. **Missing environment variables**: Set in Netlify UI if needed

### RSS/Sitemap Not Generating

**Problem**: `/rss.xml` or `/sitemap-index.xml` returns 404

**Solution**: These only generate during build:
```bash
npm run build
npm run preview
# Now check localhost:4321/rss.xml
```

## Performance Issues

### Slow Development Server

**Problem**: Hot reload takes too long

**Solutions**:
1. Exclude large directories from watch:
   ```javascript
   // astro.config.mjs
   vite: {
     server: {
       watch: {
         ignored: ['**/node_modules/**', '**/dist/**']
       }
     }
   }
   ```

2. Reduce number of open files
3. Restart dev server periodically

### Large Bundle Size

**Problem**: Site loads slowly in production

**Analysis**:
```bash
npm run build
# Check dist/_astro/ folder sizes
```

**Solutions**:
1. Lazy load images
2. Minimize JavaScript usage
3. Use static generation (already configured)

## Browser Issues

### Password Entry Not Working

**Problem**: Can't enter password for private posts

**Checklist**:
1. JavaScript enabled in browser
2. Check browser console for errors
3. Try different browser
4. Clear localStorage: `localStorage.clear()`

### Countdown Timer Not Updating

**Problem**: Browser tab title shows static text

**Solutions**:
1. Check for JavaScript errors
2. Ensure `BaseHead.astro` is included in layout
3. Verify date calculation logic

## Common Error Messages

### "Collection does not exist"

**Cause**: Content collection not properly defined

**Fix**: Check `src/content.config.ts` has blog collection

### "Cannot read properties of undefined"

**Common causes**:
1. Missing frontmatter field
2. Typo in property access
3. Undefined variable in template

**Debug**: Add defensive checks:
```javascript
{post.data.title || 'Untitled'}
```

### Notepad Issues

**See**: `/docs/notepad-critical-knowledge.md` for comprehensive notepad troubleshooting including:
- Map vs Object confusion in refactored code
- localStorage key pattern requirements
- Cursor preservation in live markdown rendering
- Missing init() call fixes

### "Expected a default export"

**Cause**: Layout file missing default export

**Fix**: Ensure layouts export component as default

## Authentication Issues (2025-01-19)

### "Authentication required" when saving

**Problem**: Can't save posts in notepad, getting auth error
**Cause**: Using `blog-save-server-secure.js` without password setup

**Solutions**:
1. **Set password in .env**:
   ```bash
   BLOG_AUTH_PASSWORD=your-password-here
   ```

2. **Check token in browser**: Open DevTools > Application > Local Storage
   - Look for `blog_auth_token`
   - Delete if corrupted and login again

### "Too many login attempts"

**Problem**: Rate limited after failed logins
**Cause**: 5 failed attempts triggers 15-minute lockout

**Solutions**:
1. Wait 15 minutes, OR
2. Restart the blog save server
3. Check password in `.env` file

### Auth not working after setup

**Critical locations to check**:
- Server using secure version? `blog-save-server-secure.js` not `blog-save-server.js`
- Password env loaded? Check line 20-26 in secure server
- Notepad has auth patch? See `notepad-auth-patch.js`
- CORS headers include Authorization? Line 77 in secure server

## Getting Help

If these solutions don't resolve your issue:

1. **Check the console**: Browser and terminal for specific errors
2. **Search error messages**: Often leads to solutions
3. **Minimal reproduction**: Create simplest case that shows the problem
4. **Astro Discord/GitHub**: Active communities for framework-specific issues

Remember to always test in both development and production builds, as behavior can differ between environments.