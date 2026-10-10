@echo off
title SkyMS - Final Excel to MongoDB Migration
cd /d "%~dp0"

echo ========================================================
echo [1/2] Verifying and Installing Dependencies...
echo ========================================================
if not exist node_modules\mongodb (
  call npm install mongodb
)
if not exist node_modules\exceljs (
  call npm install exceljs
)

echo.
echo ========================================================
echo [2/2] Running Final SkyMS Migration to MongoDB Atlas...
echo ========================================================
node scripts\migrate-data.js

echo.
echo ========================================================
echo Process Finished! Press any key to exit.
echo ========================================================
pause
