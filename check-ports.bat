@echo off
echo ========================================
echo CHECKING PORTS USED BY BLOG
echo ========================================
echo.

echo Checking port 4320 (HTTPS Proxy)...
netstat -an | findstr :4320
echo.

echo Checking port 4321 (Astro Dev Server)...
netstat -an | findstr :4321
echo.

echo Checking port 4322 (Secure Blog Save Server)...
netstat -an | findstr :4322
echo.

echo Checking port 3001 (Old Blog Save Server)...
netstat -an | findstr :3001
echo.

echo ========================================
echo CHECKING RUNNING NODE PROCESSES
echo ========================================
echo.
tasklist | findstr node.exe

echo.
echo ========================================
echo If ports show LISTENING, servers are running.
echo If you see multiple node.exe processes, you may have duplicate servers.
echo.
echo To kill all node processes: taskkill /F /IM node.exe
echo.
pause