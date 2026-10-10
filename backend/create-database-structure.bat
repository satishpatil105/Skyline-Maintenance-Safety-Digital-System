@echo off
title Create SkyMS MongoDB Structure Only
cd /d "%~dp0"
echo ======================================================================
echo          CREATING SKYMS MONGODB DATABASE STRUCTURE ONLY (0 DOCS)
echo ======================================================================
node scripts\create-database-structure.js
echo.
pause
