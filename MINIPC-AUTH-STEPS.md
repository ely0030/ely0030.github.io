# Mini PC Auth Setup - Quick Steps

1. **Pull latest**
   ```bash
   git pull origin main
   ```

2. **Create password file**
   ```bash
   echo "BLOG_AUTH_PASSWORD=choose-strong-password-here" > .env
   ```

3. **Update Windows scripts**
   
   In `start-servers.bat`, change:
   ```batch
   start "Blog Save API" cmd /k "node blog-save-server.js"
   ```
   To:
   ```batch
   start "Blog Save API" cmd /k "node blog-save-server-secure.js"
   ```

   In `host-network.ps1`, find and change same line.

4. **Test it works**
   ```bash
   start-servers.bat
   ```
   - Go to http://localhost:4321/notepad
   - Try to save something
   - You should see a login popup
   - Enter your password from .env

5. **Add to notepad** (if login doesn't appear)
   - Open `src/pages/notepad.astro`
   - After line ~850 where `<script>` starts
   - Copy ALL content from `notepad-auth-patch.js`
   - Paste it there

That's it. Your blog is now password protected.