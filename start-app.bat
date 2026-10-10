@echo off
title Skyline Maintenance and Safety - localhost:3000
cd /d "%~dp0"

echo ======================================================================
echo          STARTING SKYLINE MAINTENANCE ^& SAFETY SYSTEM (SkyMS)
echo ======================================================================

rem Check if app is already running on port 3000
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo The app is already running on http://localhost:3000
  echo Opening in browser...
  start http://localhost:3000
  timeout /t 3 >nul
  exit /b
)

if exist frontend (
  cd /d "%~dp0frontend"
)

echo.
echo Starting development server on http://localhost:3000 ...
echo Browser will automatically open in 5 seconds.
echo.

start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000"
node ".\node_modules\next\dist\bin\next" dev
pause
