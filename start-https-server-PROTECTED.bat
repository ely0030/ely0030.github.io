@echo off
echo ========================================
echo STARTING PROTECTED HTTPS SERVER
echo ========================================
echo.
echo This mode requires authentication to view ANY page.
echo.
echo Killing any existing node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo Starting servers...
echo.

REM Set the execution policy for this session
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force"

REM Run the PowerShell script with the protected proxy
powershell -File host-network-https-protected.ps1

pause