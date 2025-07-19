# MiniPC HTTPS Setup Log - 2025-07-19

This document details the steps, issues, and resolutions encountered while setting up the HTTPS development environment on the Windows MiniPC.

## Goal

The primary objective was to enable HTTPS for the local development server, following the instructions in `MINIPC-IMPLEMENT-NOW.md` and `MINIPC-SETUP-GUIDE.md`.

## New & Changed Files

*   **`certs/key.pem`**: (New) The private key for the SSL certificate.
*   **`certs/cert.pem`**: (New) The self-signed SSL certificate.
*   **`https-proxy.js`**: (New) A dedicated Node.js script to run the HTTPS proxy, created to resolve PowerShell parsing issues.
*   **`host-network-https.ps1`**: (New/Modified) The main PowerShell script to launch the server stack. It was heavily modified from its original concept.

## Summary of Work

The process involved generating a self-signed certificate and then creating and debugging a PowerShell script to launch the necessary servers.

### 1. Certificate Generation

*   **Initial Action**: Attempted to generate the certificate using the `openssl` command provided in the setup guide.
*   **Problem 1**: The command `openssl` was not found, as it was not in the Windows `PATH` environment variable.
*   **Resolution 1**: The full path to the `openssl.exe` bundled with Git for Windows was used instead: `"C:\Program Files\Git\usr\bin\openssl.exe"`.
*   **Problem 2**: PowerShell's `PSReadLine` module repeatedly crashed or failed when trying to execute the long, single-line `openssl` command.
*   **Resolution 2**: After several attempts, a final clean execution of the command succeeded, creating `key.pem` and `cert.pem` in the `certs/` directory.

### 2. HTTPS Server Script (`host-network-https.ps1`)

*   **Initial Action**: Created `host-network-https.ps1` based on the setup guide, which embedded the JavaScript proxy code inside a PowerShell here-string (`@'...'@`).
*   **Problem 1**: This script failed with numerous parser errors. PowerShell was unable to correctly interpret the JavaScript syntax (arrow functions, object literals) inside the string.
*   **Problem 2**: Further investigation revealed the script was also failing due to a character encoding issue. PowerShell was misinterpreting emoji characters (like 🔒 and ✅) in the `Write-Host` commands, causing the script to be read as corrupt.
*   **Final Resolution**:
    1.  The embedded JavaScript was moved into its own dedicated file: `https-proxy.js`. This completely separated the Node.js and PowerShell logic, resolving all parsing errors.
    2.  The `host-network-https.ps1` script was simplified to just launch the external `node https-proxy.js` process.
    3.  All emoji characters were removed from the `host-network-https.ps1` script to prevent any further encoding issues.

## Outcome

After these changes, running `powershell -ExecutionPolicy Bypass -File host-network-https.ps1` successfully launched the full HTTPS server stack.

The "Not Secure" warning in the browser is expected with a self-signed certificate, but the connection is now properly encrypted for local development. 