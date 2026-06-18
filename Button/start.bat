@echo off
setlocal
cd /d "%~dp0"
title Fenster-System

if not exist "%~dp0node\node.exe" (
  echo Portable Node.js wurde nicht gefunden.
  echo Bitte auf einem Rechner mit Internet einmal install-portable.bat ausfuehren.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo node_modules wurde nicht gefunden.
  echo Bitte auf einem Rechner mit Internet einmal install-portable.bat ausfuehren.
  pause
  exit /b 1
)

if not exist "%~dp0public\lib\chart.umd.min.js" (
  echo Lokale Browser-Bibliotheken fehlen.
  echo Bitte auf einem Rechner mit Internet einmal install-portable.bat ausfuehren.
  pause
  exit /b 1
)

start "" "http://localhost:3000"
"%~dp0node\node.exe" --no-warnings "%~dp0server.js"
pause

