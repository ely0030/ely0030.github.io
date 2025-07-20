@echo off
echo.
echo Restarting HTTPS Proxy Server...
echo.

:: Set environment variables
set LISTEN_PORT=4320
set ASTRO_PORT=4321
set API_PORT=4322

:: Start the HTTPS proxy
echo Starting HTTPS proxy on port %LISTEN_PORT%...
node https-proxy.cjs

pause