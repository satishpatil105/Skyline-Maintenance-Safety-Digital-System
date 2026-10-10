@echo off
title SkyMS - Read-Only Excel vs MongoDB Audit
cd /d "%~dp0"

echo ========================================================
echo Running READ-ONLY Excel vs MongoDB Atlas Audit...
echo (NO DATA WILL BE MODIFIED, INSERTED, OR DELETED)
echo ========================================================
node scripts\audit-excel-mongodb.js

echo.
pause
