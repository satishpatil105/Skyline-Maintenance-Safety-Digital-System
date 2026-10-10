@echo off
title SkyMS - Clean Reset MongoDB skyms Database
cd /d "%~dp0"

echo ========================================================
echo Dropping ALL collections inside MongoDB database [skyms]...
echo (Database name [skyms] will remain available)
echo ========================================================
node scripts\clean-reset-db.js

echo.
pause
