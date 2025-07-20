# Handoff: MiniPC Authentication System Debugging

**Created:** 25-07-2024
**Objective:** Resolve a critical security failure where the blog notepad allows saving posts without a password, despite a secure backend being in place.

---

## 1. Current Status

The authentication system is **STILL FAILING**.

-   **Primary Symptom:** Users can save blog posts from `/notepad` without being prompted for a password.
-   **Secondary Symptom:** The site remains accessible via the unproxied HTTP port (`http://localhost:4321` in debug mode), completely bypassing the HTTPS proxy and the secure API server. Any user accessing this URL can save posts without authentication.

All server-side components *appear* to be configured correctly after extensive debugging, yet the client-side code in `src/pages/notepad.astro` is not triggering the authentication modal as expected.

---

## 2. What We've Tried (Chronological)

The debugging session focused on fixing a series of cascading failures.

### a. Initial Server & Script Fixes
-   **Problem:** The original `host-network-https.sh` and `host-network.sh` scripts were launching the **old, insecure** `blog-save-server.js`.
-   **Fix:** Both scripts were patched to launch `blog-save-server-secure.js` instead.

### b. ES Module vs. CommonJS Errors
-   **Problem:** The `https-proxy.js` script used `require()`, which failed because `package.json` specifies `"type": "module"`. Simultaneously, `blog-save-server-secure.js` was missing the `dotenv` dependency.
-   **Fix 1:** Renamed `https-proxy.js` to `https-proxy.cjs` to force CommonJS mode and updated all calling scripts (`start-https-server-DEBUG.bat`, `host-network-https.ps1`) to use the new `.cjs` file.
-   **Fix 2:** Added `dotenv` to the dependencies in `package.json`.

### c. Proxy Port Mismatch
-   **Problem:** The proxy server was crashing with an `ECONNREFUSED` error because the standard and debug startup scripts swap the ports used by Astro and the proxy, but the proxy's target port was hardcoded.
-   **Fix:** Modified `https-proxy.cjs` to read port configuration from environment variables (`LISTEN_PORT`, `ASTRO_PORT`, `API_PORT`). Updated `start-https-server-DEBUG.bat` and `host-network-https.ps1` to set these variables correctly for their respective environments.

### d. Astro HMR (Live-Reload) Failure
-   **Problem:** The browser was showing an "invalid response" error because the Astro dev server's Hot Module Replacement (HMR) websocket was not configured to work behind an HTTPS proxy.
-   **Fix:** Updated `astro.config.mjs` with a `vite.server.hmr` configuration to make it compatible with the proxied setup. This was an iterative process to find the correct, dynamic configuration that works for both standard and debug modes.

### e. Flawed Client-Side Auth Logic
-   **Problem:** The final suspected issue was that the client-side JavaScript in `notepad.astro` correctly identified that the user was not authenticated but failed to properly halt the save operation and wait for the password modal.
-   **Fix:** Patched the `executeSave` and `executeDelete` functions in `src/pages/notepad.astro` to queue the pending operation, show the modal, and retry the operation upon successful login.

---

## 3. Next Steps & Recommended Actions

Despite all the fixes, the core problem persists. The next instance should investigate why the client-side patches are not taking effect.

1.  **Verify Client-Side Code Execution:**
    -   Use browser developer tools (F12) in `https://localhost:4320/notepad`.
    -   Place breakpoints inside the `executeSave` function in `notepad.astro` (it will be in the sources tab).
    -   Step through the code when the save button is clicked. Does it enter the `if (!authManager.isAuthenticated)` block? Does it call `showLoginModal()`? Does it `throw new Error()` as the last patch intended?

2.  **Investigate the `OperationQueue`:**
    -   The `OperationQueue` class in `notepad.astro` is responsible for handling save/delete actions. It's possible the logic flow is preventing the authentication check from being reached correctly.
    -   Specifically, analyze the `processQueue` and `add` methods. Is it possible an operation is being executed before the authentication state is checked?

3.  **Confirm Script Execution Order:**
    -   There are many `<script>` tags in `notepad.astro`. It's possible the main `NotepadApp` is initializing and binding events before the `authManager` is fully instantiated, leading to a race condition.
    -   Review the order of script execution at the bottom of the `notepad.astro` file. Ensure `authManager` exists before `new NotepadApp()` is called and `.init()` is run.

4.  **Force a Hard Refresh:**
    -   It is a small but real possibility that the browser is serving a stale version of `notepad.astro` despite the private window.
    -   Use `Ctrl+Shift+R` (or `Cmd+Shift+R`) to force a hard refresh, bypassing the cache entirely.

The primary goal is to understand why the client-side code, which now *looks* correct, is not behaving as expected in the browser. The answer almost certainly lies within the browser's execution context. 