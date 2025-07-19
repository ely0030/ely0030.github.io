# MiniPC Server Setup Guide (Windows)

This guide provides detailed, step-by-step instructions for setting up the blog's network hosting environment on a fresh Windows machine. It covers everything from installing Node.js to running the servers and troubleshooting common issues.

## 1. Install Node.js

The project requires a specific version of Node.js to function correctly. Astro, the site generator, has minimum version requirements.

1.  **Check Astro's Requirements:** Look for a `node` version specified in the `package.json` file or check for error messages when running `npx astro dev`. As of this writing, Astro requires **Node.js v18.20.8 or higher**.
2.  **Download Node.js:** Go to the [official Node.js website](https://nodejs.org/en/download/releases) and download the correct installer for your version of Windows (e.g., `node-v18.20.8-x64.msi`).
3.  **Install Node.js:** Run the installer. Ensure that the option to "Automatically install the necessary tools" (which includes Chocolatey and Python build tools) is checked. This will help with installing dependencies later.
4.  **Verify Installation:** Open a **new** PowerShell or Command Prompt window (it's important to open a new one to get the updated PATH) and run:
    ```powershell
    node --version
    npm --version
    ```
    This should print the versions of Node.js and npm, confirming they are installed correctly.

## 2. Install Project Dependencies

Once Node.js is installed, you can install the project's dependencies.

1.  **Navigate to Project Directory:** Open a PowerShell terminal in the root of the project folder.
2.  **Run NPM Install:** Execute the following command:
    ```powershell
    npm install
    ```
    This will download all the necessary packages defined in `package.json` into a `node_modules` folder.

### Troubleshooting `npm install`

If you encounter errors during or after installation (e.g., commands like `npx` not working), the `node_modules` folder or `package-lock.json` file may be corrupted. A clean reinstall usually fixes this:

```powershell
# 1. Delete the existing modules and the lock file
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 2. Re-run the installation
npm install
```

## 3. Configure the Astro Dev Server Proxy

To avoid issues with browser ad-blockers and cross-origin requests, the Astro development server needs to proxy API requests to the backend save-server.

1.  **Open the Astro Config:** Edit the `astro.config.mjs` file in the root of the project.
2.  **Add the Proxy Setting:** Locate the `vite` configuration object and add a `server.proxy` section. Crucially, set the target to the IPv4 loopback address `127.0.0.1` to avoid potential IPv6 issues.

    ```javascript
    // astro.config.mjs
    export default defineConfig({
        // ... other configs
        vite: {
            // ...
            server: {
                proxy: {
                    '/api': {
                        target: 'http://127.0.0.1:4322', // Use 127.0.0.1, not localhost
                        changeOrigin: true
                    }
                }
            }
        },
        // ...
    });
    ```
3. **Update API URLs:** Ensure that any `fetch` calls in the frontend code (e.g., in `src/pages/notepad.astro`) use relative URLs like `/api/save-blog-post` instead of hardcoded `http://localhost:4322` URLs.

## 4. Running the Servers

To run the blog, you need to start two separate servers in two separate terminals.

1.  **Start the API Save Server:**
    In your first PowerShell terminal, run:
    ```powershell
    node blog-save-server.js
    ```
    You should see the output: `📝 Blog save API running on http://0.0.0.0:4322`. Leave this terminal running.

2.  **Start the Astro Dev Server:**
    In a **second** PowerShell terminal, run:
    ```powershell
    npx astro dev --host 0.0.0.0
    ```
    This will start the main web server. Once it's ready, you will see output like:
    ```
     ┃ Local    http://localhost:4321/
     ┃ Network  http://192.168.X.X:4321/
    ```

## 5. Accessing Your Blog

Your blog is now live on your local network!

-   **On your MiniPC:** You can access it at `http://localhost:4321`.
-   **From any other device on the same WiFi:** Use the "Network" URL provided by Astro (e.g., `http://192.168.0.160:4321`).

You can now browse the site, edit posts in the `/notepad`, and save changes from any device. 