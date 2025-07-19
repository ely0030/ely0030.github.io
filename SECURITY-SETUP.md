# 🔒 Security Setup - Protect Against IoT Devices

Quick setup to protect your blog from compromised devices on your network (like that Xiaomi air filter 😅).

## 1. Create Environment File

Create `.env` file in your project root:
```bash
BLOG_AUTH_PASSWORD=your-super-strong-password-here
```

**IMPORTANT**: 
- Use a strong password (12+ characters, mix of letters/numbers/symbols)
- Don't use the same password as your WiFi
- Add `.env` to `.gitignore` if not already there

## 2. Switch to Secure Server

Replace the server in your startup scripts:

### For Linux/Mac (run-dev.sh, host-network.sh):
```bash
# Change this line:
node blog-save-server.js &

# To this:
node blog-save-server-secure.js &
```

### For Windows (start-servers.bat):
```batch
REM Change this line:
start "Blog Save API" cmd /k "node blog-save-server.js"

REM To this:
start "Blog Save API" cmd /k "node blog-save-server-secure.js"
```

## 3. Update Notepad for Authentication

Add this to `src/pages/notepad.astro` right after the opening `<script>` tag (around line 850):

```javascript
// Add authentication support
${await Deno.readTextFile('./notepad-auth-patch.js')}
```

Or manually copy the contents of `notepad-auth-patch.js` into the script section.

## 4. Update Save/Delete Functions

In `notepad.astro`, update the `queueBlogSave` function (around line 3111) to use the authenticated API:

Find:
```javascript
const response = await fetch('/api/save-blog-post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
```

Replace with:
```javascript
const response = await fetch('/api/save-blog-post', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...authManager.getAuthHeaders()
  },
```

Do the same for the delete function.

## 5. Test It

1. Start the servers:
   ```bash
   npm run dev
   ```

2. Go to `/notepad`

3. Try to save a post - you'll see a login prompt

4. Enter your password from the `.env` file

5. Now you can edit! The password is saved in your browser.

## What This Protects Against

✅ **IoT devices** trying to edit your blog
✅ **Brute force attacks** (5 attempts per 15 minutes limit)
✅ **Path traversal** attempts to escape the blog directory
✅ **Unauthorized access** from any device without the password

## Security Status

**Before**: Any device on your network could edit/delete posts
**After**: Only you with the password can edit

**Privacy Level**: Good enough for personal thoughts, diary entries, etc.

## Optional: Even More Security

If you want military-grade security for super private thoughts:
1. See `_OPS/BLUEPRINTS/security-enhancement/3-data-encryption.md`
2. Implement client-side encryption
3. Your thoughts will be encrypted even from the server

But honestly, with just this authentication + your WiFi password, you're already pretty safe from your air filter! 🛡️

## Troubleshooting

**"Too many login attempts"**: Wait 15 minutes or restart the server
**"Authentication required"**: Your session expired, just login again
**Forgot password**: Check your `.env` file

---

That's it! Your blog is now protected from rogue IoT devices. 🎉