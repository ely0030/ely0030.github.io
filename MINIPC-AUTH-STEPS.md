# Handoff Guide: HTTPS & Auth Setup - 2025-07-19

This document details the work completed to set up a secure, authenticated local development server on Windows, and the final manual step required to complete the implementation.

## I. Summary of Work Completed

The goal was to implement HTTPS and then add password authentication. This was successful, but required significant troubleshooting of the Windows PowerShell environment.

The final outcome is a robust system launched by a single batch file.

---

## II. All Changes Made in This Session

### 1. Secure Certificate Generation
- **Action**: Generated a self-signed SSL certificate (`key.pem`, `cert.pem`) in the `/certs` directory.
- **Key Detail**: Used the `openssl.exe` bundled with Git for Windows to bypass system PATH issues and PowerShell's `PSReadLine` bugs.

### 2. HTTPS Server Scripts
- **Action**: Created a stable, two-file system for running the server.
- **New Files**:
    - `host-network-https.ps1`: The main PowerShell script that orchestrates starting all servers.
    - `https-proxy.js`: A dedicated Node.js script for the HTTPS proxy, created to avoid PowerShell parsing errors.
- **Deleted Files**: Obsolete and redundant scripts were removed to avoid confusion.
    - `host-network.ps1` (old HTTP-only version)
    - `start-servers.bat` (old HTTP-only version)

### 3. Authentication Backend
- **Action**: The main server script was updated to use the secure API.
- **File Modified**: `host-network-https.ps1` now launches `blog-save-server-secure.js` instead of the non-secure version.

### 4. Documentation Overhaul
- **Action**: Updated all relevant documentation to reflect the new setup.
- **New Log File**: `docs/minipc-https-setup-log-2025-07-19.md` was created to document the entire troubleshooting session.
- **Updated Docs**:
    - `docs/https-setup.md`: Now includes a detailed Windows-specific guide.
    - `docs/troubleshooting.md`: Now includes a section for PowerShell errors.
    - `docs/DOCS.MAP.MD`: Updated to reflect all new and changed files and scripts.

### 5. Easy-Launch Batch File
- **Action**: Created a simple batch file for one-click server startup.
- **New File**: `start-https-server.bat` now executes the PowerShell script with the correct parameters.

---

## III. Final Manual Step Required

The `notepad.astro` component is too complex to be reliably patched automatically. The final step is to manually add the authentication UI and logic.

**You will need two files open: `src/pages/notepad.astro` and `notepad-auth-patch.js`**

### Step 1: Add the Auth Modal HTML
- In `notepad.astro`, find the opening `<body>` tag.
- Paste the following HTML snippet directly after it:
```html
<div id="auth-modal" class="auth-modal" style="display: none;">
  <div class="auth-modal-content">
    <h2>🔒 Authentication Required</h2>
    <p>Enter your password to edit blog posts:</p>
    <input type="password" id="auth-password" placeholder="Password" autocomplete="current-password">
    <button id="auth-login-btn">Login</button>
    <div id="auth-error" class="auth-error"></div>
  </div>
</div>
```

### Step 2: Add the Auth CSS
- In `notepad.astro`, find the first `<style>` block.
- Copy all the CSS rules from `notepad-auth-patch.js` (lines 80-165).
- Paste them inside the `<style>` block, just before the closing `</style>` tag.

### Step 3: Add the Auth JavaScript
This is the most critical part.
- In `notepad.astro`, find the main `<script>` tag (it is not a `<script setup>`).
- **At the very top, right after the opening `<script>` tag**, copy and paste the entire JavaScript auth logic from `notepad-auth-patch.js` (lines 4-312), but **EXCLUDE** the original `saveToAPI` and `deleteFromAPI` functions that are already in `notepad.astro`. You will be replacing them.

- **REPLACE the existing `saveNote` and `deleteNote` functions** in `notepad.astro` with these new versions, which call the secure API functions:
```javascript
async function saveNote(noteId, title, content) {
    const metadata = {}; // No metadata handling for now
    const result = await saveToAPI(noteId, title, content, metadata);
    if (result && result.success) {
        console.log('Note saved successfully:', result.filename);
        const postIndex = posts.findIndex(p => p.id === noteId);
        if (postIndex > -1) posts[postIndex].content = content;
        return true;
    } else {
        console.error('Failed to save note:', result ? result.error : 'Unknown error');
        if (result && result.error === 'Authentication required') {
            window.pendingAuthAction = () => saveNote(noteId, title, content);
        }
        return false;
    }
}

async function deleteNote(noteId) {
    const result = await deleteFromAPI(noteId);
    if (result && result.success) {
        console.log('Note deleted successfully:', noteId);
        posts = posts.filter(p => p.id !== noteId);
        renderNoteList();
        clearEditor();
        return true;
    } else {
        console.error('Failed to delete note:', result ? result.error : 'Unknown error');
        if (result && result.error === 'Authentication required') {
            window.pendingAuthAction = () => deleteNote(noteId);
        }
        return false;
    }
}
```

---

## IV. How to Run the Server

After completing the manual patch:
1.  Ensure the `.env` file exists in the root with the `BLOG_AUTH_PASSWORD`.
2.  Double-click `start-https-server.bat`.

The server will start. When you try to save or delete a post in the notepad, a login modal will now appear.

---

## V. Proposed Git Commit Message

**Subject:**
`feat: Add HTTPS and password auth for Windows local dev`

**Body:**
```
Implements a secure, authenticated local development environment for Windows, featuring HTTPS and password-protected API endpoints.

Key Changes:
- Adds a robust set of scripts to launch the server stack (`start-https-server.bat`, `host-network-https.ps1`, `https-proxy.js`).
- Updates the server to use `blog-save-server-secure.js`, which requires a password from a `.env` file to authorize save/delete actions.
- Requires a manual patch for `src/pages/notepad.astro` to add the client-side authentication modal and logic, due to file complexity.
- Cleans up the repository by deleting old, redundant HTTP-only server scripts (`host-network.ps1`, `start-servers.bat`).

Documentation has been heavily updated to reflect these changes, including a new Windows-specific setup guide, troubleshooting steps for PowerShell, and a log of the implementation process.
```