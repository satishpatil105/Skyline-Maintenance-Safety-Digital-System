@echo off
title Skyline Maintenance and Safety - localhost
cd /d "%~dp0"

rem If the app is already running on port 3000, open it in browser
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo The app is already running on http://localhost:3000
  echo Opening http://localhost:3000 in your browser...
  start http://localhost:3000
  timeout /t 3 >nul
  exit /b
)

if not exist node_modules\next (
  echo Installing packages...
  call npm install
)

echo.
echo Starting Skyline Maintenance ^& Safety application...
echo The app will automatically open at http://localhost:3000
echo.

start "" cmd /c "timeout /t 5 >nul & start http://localhost:3000"
call npm run dev
pause
