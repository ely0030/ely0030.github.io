@echo off
echo Starting ely0030's Blog Network Server...
echo.

echo Starting Blog Save API Server...
start "Blog Save API" cmd /k "node blog-save-server.js"

echo Starting Astro Development Server...
start "Astro Dev Server" cmd /k "npx astro dev --host 0.0.0.0"

echo.
echo Servers are starting...
echo.
echo Access your blog at:
echo   http://192.168.0.160:4321
echo   http://localhost:4321
echo.
echo Press any key to stop all servers...
pause

taskkill /f /im node.exe
taskkill /f /im cmd.exe 