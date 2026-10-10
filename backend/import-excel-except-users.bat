@echo off
title Import All Excel Data to MongoDB (Except Users)
cd /d "%~dp0"
echo ======================================================================
echo    IMPORTING ALL EXCEL SHEETS TO MONGODB (SKIPPING USERS)
echo ======================================================================
node scripts\import-excel-except-users.js
echo.
pause
