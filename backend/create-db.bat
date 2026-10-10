@echo off
title Creating MongoDB Database - Skyline System
cd /d "%~dp0"

echo ========================================================
echo Installing dependencies (if needed)...
echo ========================================================
if not exist node_modules\mongodb (
  call npm install
)

echo.
echo ========================================================
echo Creating SkyMS Database Structure...
echo ========================================================
node scripts\create-database-structure.js

echo.
pause
