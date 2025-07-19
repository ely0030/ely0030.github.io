@echo off
echo ========================================
echo HTTPS SERVER DEBUG MODE
echo ========================================
echo This will open 3 separate console windows:
echo 1. Secure Blog Save Server (Port 4322)
echo 2. Astro Dev Server (Port 4321)
echo 3. HTTPS Proxy (Port 4320)
echo.
echo Press any key to start all servers...
pause >nul

echo.
echo Starting servers in separate windows...
echo.

REM Kill any existing node processes first
echo Killing any existing node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

REM Start Secure Blog Save Server in its own window
echo [1/3] Starting Secure Blog Save Server on port 4322...
start "Secure Blog Save Server - Port 4322" cmd /k "echo SECURE BLOG SAVE SERVER && echo ====================== && echo. && echo If you see 'Authentication required' messages, auth is working! && echo. && node blog-save-server-secure.js"

REM Wait a bit for the server to start
timeout /t 2 >nul

REM Start Astro Dev Server in its own window
echo [2/3] Starting Astro Dev Server on port 4321...
start "Astro Dev Server - Port 4321" cmd /k "echo ASTRO DEV SERVER && echo ================ && echo. && echo This should show Astro startup messages && echo. && npx astro dev --port 4321 --host"

REM Wait a bit for Astro to start
timeout /t 5 >nul

REM Start HTTPS Proxy in its own window
echo [3/3] Starting HTTPS Proxy on port 4320...
start "HTTPS Proxy - Port 4320" cmd /k "echo HTTPS PROXY SERVER && echo ================== && echo. && echo Access the site at: https://localhost:4320 && echo. && echo This proxies: && echo   /api/* requests to port 4322 (secure blog server) && echo   all other requests to port 4321 (Astro) && echo. && node https-proxy.js"

echo.
echo ========================================
echo ALL SERVERS STARTED IN DEBUG MODE
echo ========================================
echo.
echo You should now have 3 console windows open.
echo Check each window for errors.
echo.
echo Access your site at: https://localhost:4320
echo.
echo To stop all servers:
echo   1. Close this window
echo   2. Close all 3 server windows
echo   OR run: taskkill /F /IM node.exe
echo.
echo Press any key to keep this window open...
pause >nul