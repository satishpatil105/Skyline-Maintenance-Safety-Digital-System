@echo off
title Import SkyMS Users Only (Excel to MongoDB)
cd /d "%~dp0"
echo ======================================================================
echo              IMPORTING USERS DATA ONLY (EXCEL TO MONGODB)
echo ======================================================================
node scripts\import-users-only.js
echo.
pause
